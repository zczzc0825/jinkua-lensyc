from __future__ import annotations

import os
import re
import secrets
import hashlib
import io
import shutil
import tempfile
import threading
import time
import uuid
import httpx
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs, urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import Body, Depends, FastAPI, File, Header, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, ConfigDict
from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, create_engine, func, inspect, or_, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker
from openpyxl import Workbook
from openpyxl.drawing.image import Image as XLImage
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
try:
    from qiniu import Auth, put_file
except ImportError:  # pragma: no cover - optional dependency for local-only storage
    Auth = None
    put_file = None

BASE_DIR = Path(__file__).resolve().parents[1]
STORAGE_DIR = BASE_DIR / "storage"
STORAGE_DIR.mkdir(exist_ok=True)
MEDIA_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".webm", ".mov"}
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'plynook.db'}")
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"
STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local").strip().lower()
QINIU_ACCESS_KEY = os.getenv("QINIU_ACCESS_KEY", "").strip()
QINIU_SECRET_KEY = os.getenv("QINIU_SECRET_KEY", "").strip()
QINIU_BUCKET = os.getenv("QINIU_BUCKET", "plynook").strip()
QINIU_DOMAIN = os.getenv("QINIU_DOMAIN", "").strip().rstrip("/")
QINIU_PREFIX = os.getenv("QINIU_PREFIX", "uploads").strip().strip("/")
SITE_URL = os.getenv("SITE_URL", "https://cooolmake.com").rstrip("/")
logger = logging.getLogger("uvicorn.error")
DEDUPE_ANALYTICS_EVENTS = {"page_view", "product_view", "whatsapp_click"}
SLUG_FALLBACK_PREFIX = "item"
SUPER_ADMIN_USERNAMES = {"17605901054@163.com", "1263898899@qq.com", "zz1019511489@qq.com"}

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    nickname: Mapped[Optional[str]] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(50), default="admin")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Category(Base):
    __tablename__ = "categories"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    name_en: Mapped[str] = mapped_column(String(255))
    name_ja: Mapped[Optional[str]] = mapped_column(String(255))
    name_ko: Mapped[Optional[str]] = mapped_column(String(255))
    name_zh: Mapped[Optional[str]] = mapped_column(String(255))
    description_en: Mapped[Optional[str]] = mapped_column(Text)
    description_ja: Mapped[Optional[str]] = mapped_column(Text)
    description_ko: Mapped[Optional[str]] = mapped_column(Text)
    description_zh: Mapped[Optional[str]] = mapped_column(Text)
    banner_image: Mapped[Optional[str]] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_id: Mapped[Optional[int]] = mapped_column(Integer)
    updated_by_id: Mapped[Optional[int]] = mapped_column(Integer)


class Tag(Base):
    __tablename__ = "tags"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    name_en: Mapped[str] = mapped_column(String(255))
    name_ja: Mapped[Optional[str]] = mapped_column(String(255))
    name_ko: Mapped[Optional[str]] = mapped_column(String(255))
    name_zh: Mapped[Optional[str]] = mapped_column(String(255))
    color: Mapped[str] = mapped_column(String(50), default="#7C5CFF")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_id: Mapped[Optional[int]] = mapped_column(Integer)
    updated_by_id: Mapped[Optional[int]] = mapped_column(Integer)


class ProductTag(Base):
    __tablename__ = "product_tags"
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)


class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    product_code: Mapped[Optional[str]] = mapped_column(String(100), unique=True, index=True)
    create_request_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True, index=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(50), default="draft")
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"))
    main_image: Mapped[Optional[str]] = mapped_column(Text)
    gallery_images: Mapped[list] = mapped_column(JSON, default=list)
    detail_images: Mapped[list] = mapped_column(JSON, default=list)
    video_url: Mapped[Optional[str]] = mapped_column(Text)
    price: Mapped[Optional[float]] = mapped_column(Float)
    show_price: Mapped[bool] = mapped_column(Boolean, default=False)
    is_free_shipping: Mapped[bool] = mapped_column(Boolean, default=False)
    stock_quantity: Mapped[int] = mapped_column(Integer, default=0)
    color_variants: Mapped[list] = mapped_column(JSON, default=list)
    source_platform: Mapped[Optional[str]] = mapped_column(String(100))
    source_url: Mapped[Optional[str]] = mapped_column(Text)
    stock_status: Mapped[str] = mapped_column(String(50), default="in_stock")
    material: Mapped[Optional[str]] = mapped_column(String(255))
    size: Mapped[Optional[str]] = mapped_column(String(255))
    weight: Mapped[Optional[str]] = mapped_column(String(255))
    color: Mapped[Optional[str]] = mapped_column(String(255))
    package_info: Mapped[Optional[str]] = mapped_column(String(255))
    usage_scene: Mapped[Optional[str]] = mapped_column(String(255))
    material_en: Mapped[Optional[str]] = mapped_column(String(255))
    size_en: Mapped[Optional[str]] = mapped_column(String(255))
    package_info_en: Mapped[Optional[str]] = mapped_column(String(255))
    usage_scene_en: Mapped[Optional[str]] = mapped_column(String(255))
    title_en: Mapped[str] = mapped_column(String(255))
    title_ja: Mapped[Optional[str]] = mapped_column(String(255))
    title_ko: Mapped[Optional[str]] = mapped_column(String(255))
    title_zh: Mapped[Optional[str]] = mapped_column(String(255))
    short_description_en: Mapped[Optional[str]] = mapped_column(Text)
    short_description_ja: Mapped[Optional[str]] = mapped_column(Text)
    short_description_ko: Mapped[Optional[str]] = mapped_column(Text)
    short_description_zh: Mapped[Optional[str]] = mapped_column(Text)
    description_en: Mapped[Optional[str]] = mapped_column(Text)
    description_ja: Mapped[Optional[str]] = mapped_column(Text)
    description_ko: Mapped[Optional[str]] = mapped_column(Text)
    description_zh: Mapped[Optional[str]] = mapped_column(Text)
    features_en: Mapped[list] = mapped_column(JSON, default=list)
    features_ja: Mapped[list] = mapped_column(JSON, default=list)
    features_ko: Mapped[list] = mapped_column(JSON, default=list)
    features_zh: Mapped[list] = mapped_column(JSON, default=list)
    seo_title_en: Mapped[Optional[str]] = mapped_column(String(255))
    seo_description_en: Mapped[Optional[str]] = mapped_column(Text)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_new: Mapped[bool] = mapped_column(Boolean, default=False)
    is_best_seller: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    allow_whatsapp: Mapped[bool] = mapped_column(Boolean, default=True)
    whatsapp_message_template: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_by_id: Mapped[Optional[int]] = mapped_column(Integer)
    updated_by_id: Mapped[Optional[int]] = mapped_column(Integer)
    category: Mapped[Optional[Category]] = relationship()
    tags: Mapped[List[Tag]] = relationship(secondary="product_tags")


class Article(Base):
    __tablename__ = "articles"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    summary: Mapped[Optional[str]] = mapped_column(Text)
    content: Mapped[Optional[str]] = mapped_column(Text)
    category: Mapped[Optional[str]] = mapped_column(String(255))
    keywords: Mapped[Optional[str]] = mapped_column(String(500))
    cover_image: Mapped[Optional[str]] = mapped_column(Text)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_id: Mapped[Optional[int]] = mapped_column(Integer)
    updated_by_id: Mapped[Optional[int]] = mapped_column(Integer)


class Banner(Base):
    __tablename__ = "banners"

    id: Mapped[int] = mapped_column(primary_key=True)
    title_en: Mapped[str] = mapped_column(String(255))
    title_ja: Mapped[Optional[str]] = mapped_column(String(255))
    title_ko: Mapped[Optional[str]] = mapped_column(String(255))
    title_zh: Mapped[Optional[str]] = mapped_column(String(255))
    subtitle_en: Mapped[Optional[str]] = mapped_column(Text)
    subtitle_ja: Mapped[Optional[str]] = mapped_column(Text)
    subtitle_ko: Mapped[Optional[str]] = mapped_column(Text)
    subtitle_zh: Mapped[Optional[str]] = mapped_column(Text)
    image: Mapped[str] = mapped_column(Text)
    link_url: Mapped[str] = mapped_column(Text, default="/products")
    button_text_en: Mapped[str] = mapped_column(String(100), default="Shop now")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_id: Mapped[Optional[int]] = mapped_column(Integer)
    updated_by_id: Mapped[Optional[int]] = mapped_column(Integer)


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    event_type: Mapped[str] = mapped_column(String(100), index=True)
    product_id: Mapped[Optional[int]] = mapped_column(Integer)
    category_id: Mapped[Optional[int]] = mapped_column(Integer)
    locale: Mapped[Optional[str]] = mapped_column(String(20))
    page_url: Mapped[Optional[str]] = mapped_column(Text)
    referrer: Mapped[Optional[str]] = mapped_column(Text)
    search_keyword: Mapped[Optional[str]] = mapped_column(String(255))
    inquiry_items: Mapped[list] = mapped_column(JSON, default=list)
    utm_source: Mapped[Optional[str]] = mapped_column(String(255))
    utm_medium: Mapped[Optional[str]] = mapped_column(String(255))
    utm_campaign: Mapped[Optional[str]] = mapped_column(String(255))
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    ip: Mapped[Optional[str]] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class SiteSetting(Base):
    __tablename__ = "site_settings"
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(100), unique=True)
    value: Mapped[Any] = mapped_column(JSON)


class CustomerOrder(Base):
    __tablename__ = "customer_orders"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_code: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    access_password: Mapped[str] = mapped_column(String(100))
    locale: Mapped[str] = mapped_column(String(20), default="en")
    status: Mapped[str] = mapped_column(String(50), default="pending_confirm")
    items: Mapped[list] = mapped_column(JSON, default=list)
    payment_method: Mapped[Optional[str]] = mapped_column(String(100))
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    customer_name: Mapped[Optional[str]] = mapped_column(String(255))
    customer_phone: Mapped[Optional[str]] = mapped_column(String(100))
    customer_country: Mapped[Optional[str]] = mapped_column(String(100))
    customer_province: Mapped[Optional[str]] = mapped_column(String(100))
    customer_city: Mapped[Optional[str]] = mapped_column(String(100))
    customer_district: Mapped[Optional[str]] = mapped_column(String(100))
    customer_detail_address: Mapped[Optional[str]] = mapped_column(Text)
    customer_address: Mapped[Optional[str]] = mapped_column(Text)
    customer_note: Mapped[Optional[str]] = mapped_column(Text)
    customer_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    customer_confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    product_cost: Mapped[float] = mapped_column(Float, default=0)
    first_leg_cost: Mapped[float] = mapped_column(Float, default=0)
    last_leg_cost: Mapped[float] = mapped_column(Float, default=0)
    total_price: Mapped[float] = mapped_column(Float, default=0)
    currency: Mapped[str] = mapped_column(String(20), default="CNY")
    first_logistics_company: Mapped[Optional[str]] = mapped_column(String(255))
    first_tracking_no: Mapped[Optional[str]] = mapped_column(String(255))
    first_logistics_note: Mapped[Optional[str]] = mapped_column(Text)
    last_logistics_company: Mapped[Optional[str]] = mapped_column(String(255))
    last_tracking_no: Mapped[Optional[str]] = mapped_column(String(255))
    last_logistics_note: Mapped[Optional[str]] = mapped_column(Text)
    admin_note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    confirmed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by_id: Mapped[Optional[int]] = mapped_column(Integer)
    updated_by_id: Mapped[Optional[int]] = mapped_column(Integer)


class ProcurementQuote(Base):
    __tablename__ = "procurement_quotes"
    id: Mapped[int] = mapped_column(primary_key=True)
    quote_code: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    access_password: Mapped[str] = mapped_column(String(100))
    title: Mapped[str] = mapped_column(String(255), default="商品采购报价单")
    status: Mapped[str] = mapped_column(String(50), default="draft")
    customer_name: Mapped[Optional[str]] = mapped_column(String(255))
    items: Mapped[list] = mapped_column(JSON, default=list)
    first_leg_cost_cny: Mapped[float] = mapped_column(Float, default=0)
    last_leg_cost_cny: Mapped[float] = mapped_column(Float, default=0)
    additional_expenses: Mapped[list] = mapped_column(JSON, default=list)
    preferred_currency: Mapped[str] = mapped_column(String(10), default="USD")
    exchange_rates: Mapped[dict] = mapped_column(JSON, default=dict)
    rates_date: Mapped[Optional[str]] = mapped_column(String(50))
    expected_arrival_local: Mapped[Optional[str]] = mapped_column(String(50))
    customer_timezone: Mapped[Optional[str]] = mapped_column(String(100))
    expected_arrival_china: Mapped[Optional[datetime]] = mapped_column(DateTime)
    internal_note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    owner_id: Mapped[Optional[int]] = mapped_column(Integer)
    created_by_id: Mapped[Optional[int]] = mapped_column(Integer)
    updated_by_id: Mapped[Optional[int]] = mapped_column(Integer)


class Input(BaseModel):
    model_config = ConfigDict(extra="ignore")


class AdminActionLog(Base):
    __tablename__ = "admin_action_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, index=True)
    username: Mapped[Optional[str]] = mapped_column(String(200))
    nickname: Mapped[Optional[str]] = mapped_column(String(100))
    action: Mapped[str] = mapped_column(String(200), index=True)
    detail: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[int] = mapped_column(Integer, default=200)
    ok: Mapped[bool] = mapped_column(Boolean, default=True)
    ip: Mapped[Optional[str]] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class LoginInput(Input):
    username: str
    password: str


class ProfileInput(Input):
    nickname: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


class AdminCreateInput(Input):
    username: str
    password: str
    nickname: Optional[str] = None


class CategoryInput(Input):
    slug: str
    name_en: str
    name_ja: Optional[str] = None
    name_ko: Optional[str] = None
    name_zh: Optional[str] = None
    description_en: Optional[str] = None
    description_ja: Optional[str] = None
    description_ko: Optional[str] = None
    description_zh: Optional[str] = None
    banner_image: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class TagInput(Input):
    slug: str
    name_en: str
    name_ja: Optional[str] = None
    name_ko: Optional[str] = None
    name_zh: Optional[str] = None
    color: str = "#7C5CFF"
    sort_order: int = 0
    is_active: bool = True


class ProductInput(Input):
    sku: Optional[str] = None
    slug: Optional[str] = None
    status: str = "draft"
    category_id: Optional[int] = None
    tag_ids: List[int] = []
    main_image: Optional[str] = None
    gallery_images: List[str] = []
    detail_images: List[str] = []
    video_url: Optional[str] = None
    price: Optional[float] = None
    show_price: bool = True
    is_free_shipping: bool = False
    stock_quantity: int = 0
    color_variants: List[dict] = []
    source_platform: Optional[str] = None
    source_url: Optional[str] = None
    stock_status: str = "in_stock"
    material: Optional[str] = None
    size: Optional[str] = None
    weight: Optional[str] = None
    color: Optional[str] = None
    package_info: Optional[str] = None
    usage_scene: Optional[str] = None
    title_en: Optional[str] = None
    title_ja: Optional[str] = None
    title_ko: Optional[str] = None
    title_zh: str
    short_description_en: Optional[str] = None
    short_description_ja: Optional[str] = None
    short_description_ko: Optional[str] = None
    short_description_zh: Optional[str] = None
    description_en: Optional[str] = None
    description_ja: Optional[str] = None
    description_ko: Optional[str] = None
    description_zh: Optional[str] = None
    features_en: List[str] = []
    features_ja: List[str] = []
    features_ko: List[str] = []
    features_zh: List[str] = []
    seo_title_en: Optional[str] = None
    seo_description_en: Optional[str] = None
    is_featured: bool = False
    is_new: bool = False
    is_best_seller: bool = False
    sort_order: int = 0
    allow_whatsapp: bool = True
    auto_translate: bool = True


class ArticleInput(Input):
    slug: str
    title: str
    summary: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    keywords: Optional[str] = None
    cover_image: Optional[str] = None
    is_published: bool = False


class BannerInput(Input):
    title_en: str
    title_ja: Optional[str] = None
    title_ko: Optional[str] = None
    title_zh: Optional[str] = None
    subtitle_en: Optional[str] = None
    subtitle_ja: Optional[str] = None
    subtitle_ko: Optional[str] = None
    subtitle_zh: Optional[str] = None
    image: str
    link_url: str = "/products"
    button_text_en: str = "Shop now"
    sort_order: int = 0
    is_active: bool = True


class EventInput(Input):
    session_id: Optional[str] = None
    event_type: str
    product_id: Optional[int] = None
    category_id: Optional[int] = None
    locale: Optional[str] = None
    page_url: Optional[str] = None
    referrer: Optional[str] = None
    search_keyword: Optional[str] = None
    inquiry_items: List[dict] = []
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None


class CustomerOrderInput(Input):
    locale: str = "en"
    status: str = "pending_confirm"
    items: List[dict] = []
    payment_method: Optional[str] = None
    is_paid: bool = False
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_country: Optional[str] = None
    customer_province: Optional[str] = None
    customer_city: Optional[str] = None
    customer_district: Optional[str] = None
    customer_detail_address: Optional[str] = None
    customer_address: Optional[str] = None
    customer_note: Optional[str] = None
    product_cost: float = 0
    first_leg_cost: float = 0
    last_leg_cost: float = 0
    total_price: Optional[float] = None
    currency: str = "CNY"
    first_logistics_company: Optional[str] = None
    first_tracking_no: Optional[str] = None
    first_logistics_note: Optional[str] = None
    last_logistics_company: Optional[str] = None
    last_tracking_no: Optional[str] = None
    last_logistics_note: Optional[str] = None
    admin_note: Optional[str] = None


class PublicOrderPasswordInput(Input):
    password: str


class PublicOrderCustomerInput(Input):
    password: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_country: Optional[str] = None
    customer_province: Optional[str] = None
    customer_city: Optional[str] = None
    customer_district: Optional[str] = None
    customer_detail_address: Optional[str] = None
    customer_address: Optional[str] = None
    customer_note: Optional[str] = None


class ProcurementQuoteInput(Input):
    title: str = "商品采购报价单"
    status: str = "draft"
    customer_name: Optional[str] = None
    items: List[dict] = []
    first_leg_cost_cny: float = 0
    last_leg_cost_cny: float = 0
    additional_expenses: List[dict] = []
    preferred_currency: str = "USD"
    internal_note: Optional[str] = None
    owner_id: Optional[int] = None
    updated_at: Optional[str] = None


class ProcurementPasswordInput(Input):
    password: str


class ProcurementPublicItemInput(Input):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = None
    image: Optional[str] = None
    quantity: int = 1
    customer_note: Optional[str] = None


class ProcurementDecisionInput(Input):
    decision: str


class ProcurementArrivalInput(Input):
    expected_arrival_local: str
    customer_timezone: str = "UTC"
    timezone_offset_minutes: Optional[int] = None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def localized(obj: Any, field: str, locale: str):
    return getattr(obj, f"{field}_{locale}", None) or getattr(obj, f"{field}_en", None)


import time as _time

_translation_cache: Dict[str, str] = {}
_provider_cooldown: Dict[str, float] = {}
PROVIDER_COOLDOWN_SECONDS = 300
TRANSLATION_LANGPAIRS = {"en": "zh-CN|en", "ja": "zh-CN|ja", "ko": "zh-CN|ko"}
TRANSLATION_TARGETS = {"en": "en", "ja": "ja", "ko": "ko"}


def _translate_via_mymemory(text_value: str, langpair: str) -> Optional[str]:
    translated_parts = []
    for start in range(0, len(text_value), 140):
        chunk = text_value[start:start + 140]
        response = httpx.get("https://api.mymemory.translated.net/get", params={"q": chunk, "langpair": langpair}, headers={"User-Agent": "cooolmake/1.0"}, timeout=8)
        response.raise_for_status()
        payload = response.json()
        translated_parts.append(payload["responseData"]["translatedText"])
    return " ".join(translated_parts)


def _translate_via_google(text_value: str, target: str) -> Optional[str]:
    translated_parts = []
    for start in range(0, len(text_value), 400):
        chunk = text_value[start:start + 400]
        response = httpx.get("https://translate.googleapis.com/translate_a/single", params={"client": "gtx", "sl": "zh-CN", "tl": target, "dt": "t", "q": chunk}, headers={"User-Agent": "Mozilla/5.0"}, timeout=8)
        response.raise_for_status()
        payload = response.json()
        translated_parts.append("".join(part[0] for part in payload[0] if part and part[0]))
    return " ".join(translated_parts)


def translate_zh(value: Optional[str], target: str = "en") -> Optional[str]:
    """Translate Chinese copy to the requested locale; return None when every provider fails so callers can fall back."""
    if not value or not value.strip():
        return None
    target = TRANSLATION_TARGETS.get(target) or "en"
    text_value = value.strip()
    cache_key = f"{target}:{text_value}"
    if cache_key in _translation_cache:
        return _translation_cache[cache_key]
    if not os.getenv("AUTO_TRANSLATE", "true").lower() in ("1", "true", "yes"):
        return None
    providers = (("mymemory", _translate_via_mymemory, TRANSLATION_LANGPAIRS[target]), ("google", _translate_via_google, target))
    now = _time.monotonic()
    for name, provider, arg in providers:
        if _provider_cooldown.get(name, 0) > now:
            continue
        try:
            translated = (provider(text_value, arg) or "").strip().strip("\"'‘’“”")
        except Exception:
            _provider_cooldown[name] = now + PROVIDER_COOLDOWN_SECONDS
            continue
        if translated and translated != text_value and translated != "INVALID LANGUAGE PAIR SPECIFIED":
            _translation_cache[cache_key] = translated
            return translated
    return None


def translate_zh_to_en(value: Optional[str]) -> Optional[str]:
    return translate_zh(value, "en")


def has_cjk(value: Optional[str]) -> bool:
    return any("\u4e00" <= char <= "\u9fff" for char in value or "")


def title_from_slug(slug: Optional[str]) -> str:
    return " ".join(part.capitalize() for part in (slug or "").replace("_", "-").split("-") if part)


def normalize_slug(value: Optional[str], fallback: str = SLUG_FALLBACK_PREFIX) -> str:
    slug = (value or "").strip().lower()
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"[^a-z0-9-]+", "", slug)
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    return slug or f"{fallback}-{uuid.uuid4().hex[:8]}"


COMMON_CATEGORY_TRANSLATIONS = {
    "en": {
        "居家潮玩": "Home Trendy",
        "潮玩摆件": "Art Toys",
        "家居装饰": "Home Decor",
        "桌面用品": "Desk Accessories",
        "礼品": "Gifts",
    },
    "ja": {
        "居家潮玩": "ホームトレンド雑貨",
        "潮玩摆件": "アートトイ",
        "家居装饰": "ホームデコ",
        "桌面用品": "デスク用品",
        "礼品": "ギフト",
    },
    "ko": {
        "居家潮玩": "홈 트렌디 소품",
        "潮玩摆件": "아트 토이",
        "家居装饰": "홈 데코",
        "桌面用品": "데스크 용품",
        "礼品": "선물",
    },
}


def translated_fallback(chinese_value: Optional[str], current_value: Optional[str], slug: Optional[str], target: str = "en") -> str:
    current_text = (current_value or "").strip()
    chinese_text = (chinese_value or "").strip()
    if current_text and current_text != chinese_text and not has_cjk(current_text):
        return current_text
    if chinese_text in COMMON_CATEGORY_TRANSLATIONS.get(target, {}):
        return COMMON_CATEGORY_TRANSLATIONS[target][chinese_text]
    translated = translate_zh(chinese_text, target) if chinese_text else None
    if translated and translated != chinese_text:
        return translated
    return title_from_slug(slug) or current_text or chinese_text


def normalize_admin_i18n_payload(data: Dict[str, Any], model) -> Dict[str, Any]:
    if model not in (Category, Tag):
        return data
    values = dict(data)
    name_zh = (values.get("name_zh") or values.get("name_en") or "").strip()
    values["slug"] = normalize_slug(values.get("slug") or values.get("name_en") or name_zh, "category" if model is Category else "tag")
    values["name_zh"] = name_zh
    values["name_en"] = translated_fallback(name_zh, values.get("name_en"), values.get("slug"), "en")
    values["name_ja"] = translated_fallback(name_zh, values.get("name_ja"), values.get("slug"), "ja") if name_zh else None
    values["name_ko"] = translated_fallback(name_zh, values.get("name_ko"), values.get("slug"), "ko") if name_zh else None
    if model is Category:
        description_zh = (values.get("description_zh") or values.get("description_en") or "").strip()
        values["description_zh"] = description_zh or None
        description_en = (values.get("description_en") or "").strip()
        if description_zh and (not description_en or description_en == description_zh or has_cjk(description_en)):
            translated = translate_zh(description_zh, "en")
            values["description_en"] = translated if translated and not has_cjk(translated) else None
        else:
            values["description_en"] = description_en or None
        values["description_ja"] = values.get("description_ja") or translate_zh(description_zh, "ja") if description_zh else None
        values["description_ko"] = values.get("description_ko") or translate_zh(description_zh, "ko") if description_zh else None
    return values


def serialize_category(c: Category, locale: str = "en"):
    return {"id": c.id, "slug": c.slug, "name": localized(c, "name", locale), "description": localized(c, "description", locale), "banner_image": c.banner_image, "sort_order": c.sort_order, "is_active": c.is_active, **{k: getattr(c, k) for k in ("name_en", "name_ja", "name_ko", "name_zh", "description_en", "description_ja", "description_ko", "description_zh")}}


def serialize_tag(t: Tag, locale: str = "en"):
    return {"id": t.id, "slug": t.slug, "name": localized(t, "name", locale), "color": t.color, "sort_order": t.sort_order, "is_active": t.is_active, **{k: getattr(t, k) for k in ("name_en", "name_ja", "name_ko", "name_zh")}}


def serialize_article(a: Article, include_content: bool = True):
    data = {
        "id": a.id, "slug": a.slug, "title": a.title, "summary": a.summary,
        "category": a.category, "keywords": a.keywords, "cover_image": a.cover_image,
        "is_published": a.is_published,
        "published_at": a.published_at.strftime("%Y-%m-%d") if a.published_at else None,
        "created_at": a.created_at.isoformat() + "Z" if a.created_at else None,
        "updated_at": a.updated_at.isoformat() + "Z" if a.updated_at else None,
    }
    if include_content: data["content"] = a.content
    return data


def order_total_from_costs(product_cost: float = 0, first_leg_cost: float = 0, last_leg_cost: float = 0) -> float:
    return round(float(product_cost or 0) + float(first_leg_cost or 0) + float(last_leg_cost or 0), 2)


def generate_order_code(db: Session) -> str:
    prefix = datetime.utcnow().strftime("PO%Y%m%d")
    for _ in range(20):
        code = f"{prefix}-{secrets.token_hex(5).upper()}"
        if not db.query(CustomerOrder).filter(CustomerOrder.order_code == code).first():
            return code
    return f"{prefix}-{uuid.uuid4().hex[:12].upper()}"


def compose_customer_address(source) -> Optional[str]:
    parts = [
        getattr(source, "customer_country", None),
        getattr(source, "customer_province", None),
        getattr(source, "customer_city", None),
        getattr(source, "customer_district", None),
        getattr(source, "customer_detail_address", None),
    ]
    clean_parts = [str(part).strip() for part in parts if str(part or "").strip()]
    return " / ".join(clean_parts) if clean_parts else getattr(source, "customer_address", None)


def generate_order_password() -> str:
    return secrets.token_urlsafe(6).replace("-", "").replace("_", "")[:8]


def serialize_order(order: CustomerOrder, db: Optional[Session] = None, public: bool = False):
    hide_customer = public and order.customer_confirmed
    data = {
        "id": order.id,
        "order_code": order.order_code,
        "access_password": None if public else order.access_password,
        "locale": order.locale,
        "status": order.status,
        "items": order.items or [],
        "payment_method": order.payment_method,
        "is_paid": order.is_paid,
        "customer_confirmed": order.customer_confirmed,
        "customer_confirmed_at": order.customer_confirmed_at.isoformat() if order.customer_confirmed_at else None,
        "customer_name": None if hide_customer else order.customer_name,
        "customer_phone": None if hide_customer else order.customer_phone,
        "customer_country": None if hide_customer else order.customer_country,
        "customer_province": None if hide_customer else order.customer_province,
        "customer_city": None if hide_customer else order.customer_city,
        "customer_district": None if hide_customer else order.customer_district,
        "customer_detail_address": None if hide_customer else order.customer_detail_address,
        "customer_address": None if hide_customer else order.customer_address,
        "customer_note": None if hide_customer else order.customer_note,
        "product_cost": order.product_cost or 0,
        "first_leg_cost": order.first_leg_cost or 0,
        "last_leg_cost": order.last_leg_cost or 0,
        "total_price": order.total_price or 0,
        "currency": order.currency or "CNY",
        "first_logistics_company": order.first_logistics_company,
        "first_tracking_no": order.first_tracking_no,
        "first_logistics_note": order.first_logistics_note,
        "last_logistics_company": order.last_logistics_company,
        "last_tracking_no": order.last_tracking_no,
        "last_logistics_note": order.last_logistics_note,
        "admin_note": None if public else order.admin_note,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "updated_at": order.updated_at.isoformat() if order.updated_at else None,
        "confirmed_at": order.confirmed_at.isoformat() if order.confirmed_at else None,
        "created_by_id": order.created_by_id,
        "updated_by_id": order.updated_by_id,
    }
    if db and not public:
        data = attach_operator_names(data, db)
    return data


_exchange_rate_cache: Dict[str, Any] = {}


def generate_procurement_code(db: Session) -> str:
    prefix = datetime.utcnow().strftime("PQ%Y%m%d")
    for _ in range(20):
        code = f"{prefix}-{secrets.token_hex(5).upper()}"
        if not db.query(ProcurementQuote).filter(ProcurementQuote.quote_code == code).first():
            return code
    return f"{prefix}-{uuid.uuid4().hex[:12].upper()}"


def normalize_procurement_item(item: Dict[str, Any], existing: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    current = dict(existing or {})
    current.update(item or {})
    current["id"] = str(current.get("id") or uuid.uuid4().hex)
    current["name"] = str(current.get("name") or "").strip()
    current["image"] = str(current.get("image") or "").strip()
    current["quantity"] = max(1, int(current.get("quantity") or 1))
    current["unit_price_cny"] = max(0, round(float(current.get("unit_price_cny") or 0), 2))
    current["cost_price_cny"] = max(0, round(float(current.get("cost_price_cny") or 0), 2))
    current["procurement_source_text"] = str(current.get("procurement_source_text") or "").strip()
    current["admin_note"] = str(current.get("admin_note") or "").strip()
    current["customer_note"] = str(current.get("customer_note") or "").strip()
    decision = str(current.get("decision") or "pending")
    current["decision"] = decision if decision in {"pending", "confirmed"} else "pending"
    current["added_by"] = "customer" if current.get("added_by") == "customer" else "admin"
    return current


def translate_procurement_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """Keep the admin-entered Chinese copy and prepare a separate English customer-facing copy."""
    translated = dict(item)
    for source_key, english_key in (("name", "name_en"), ("admin_note", "admin_note_en")):
        source = str(translated.get(source_key) or "").strip()
        source_marker = f"{english_key}_source"
        if translated.get(source_marker) == source and translated.get(english_key):
            continue
        translated[english_key] = (translate_zh(source, "en") if has_cjk(source) else source) or source
        translated[source_marker] = source
    return translated


def public_procurement_items(items: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    result = []
    for raw_item in items or []:
        item = translate_procurement_item(raw_item)
        item["name"] = item.get("name_en") or item.get("name") or ""
        item.pop("name_en_source", None)
        # Internal notes, finance and sourcing data must never leave the admin API.
        for internal_key in ("admin_note", "admin_note_en", "admin_note_en_source", "cost_price_cny", "procurement_source_text", "profit_cny"):
            item.pop(internal_key, None)
        result.append(item)
    return result


def fetch_daily_exchange_rates(existing: Optional[Dict[str, Any]] = None, existing_date: Optional[str] = None) -> tuple[Dict[str, float], str]:
    today = datetime.utcnow().date().isoformat()
    if _exchange_rate_cache.get("date") == today and _exchange_rate_cache.get("rates"):
        return dict(_exchange_rate_cache["rates"]), today
    try:
        response = httpx.get("https://open.er-api.com/v6/latest/CNY", headers={"User-Agent": "cooolmake/1.0"}, timeout=15)
        response.raise_for_status()
        payload = response.json()
        if payload.get("result") != "success" or not payload.get("rates"):
            raise ValueError(payload.get("error-type") or "Exchange rate service returned no rates")
        rates = {str(code).upper(): float(rate) for code, rate in payload["rates"].items() if float(rate) > 0}
        rates["CNY"] = 1.0
        rates_date = datetime.fromtimestamp(int(payload.get("time_last_update_unix") or 0), tz=timezone.utc).date().isoformat() if payload.get("time_last_update_unix") else today
        _exchange_rate_cache.update({"date": today, "rates": rates, "rates_date": rates_date})
        return rates, rates_date
    except Exception as exc:
        logger.error("Exchange rate fetch failed: %s", exc)
        if existing:
            return {str(code).upper(): float(rate) for code, rate in existing.items()}, existing_date or "历史锁定汇率"
        raise HTTPException(502, "今日汇率获取失败，请稍后重试后再发布报价单")


def procurement_totals(quote: ProcurementQuote) -> Dict[str, float]:
    products_total = round(sum(float(item.get("unit_price_cny") or 0) * int(item.get("quantity") or 1) for item in (quote.items or [])), 2)
    product_cost_total = round(sum(float(item.get("cost_price_cny") or 0) * int(item.get("quantity") or 1) for item in (quote.items or [])), 2)
    confirmed_products_total = round(sum(float(item.get("unit_price_cny") or 0) * int(item.get("quantity") or 1) for item in (quote.items or []) if item.get("decision") == "confirmed"), 2)
    shipping_total = round(float(quote.first_leg_cost_cny or 0) + float(quote.last_leg_cost_cny or 0), 2)
    additional_expense_total = round(sum(max(0, float(expense.get("amount_cny") or 0)) for expense in (quote.additional_expenses or [])), 2)
    total_cny = round(products_total + shipping_total, 2)
    profit_cny = round(total_cny - product_cost_total - shipping_total - additional_expense_total, 2)
    return {
        "products_total_cny": products_total,
        "product_cost_total_cny": product_cost_total,
        "confirmed_products_total_cny": confirmed_products_total,
        "shipping_total_cny": shipping_total,
        "additional_expense_total_cny": additional_expense_total,
        "total_cny": total_cny,
        "profit_cny": profit_cny,
        "display_profit_cny": profit_cny if quote.status == "customer_confirmed" else 0,
        "confirmed_total_cny": round(confirmed_products_total + shipping_total, 2) if confirmed_products_total else 0,
    }


def procurement_items_with_totals(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    result = []
    for raw_item in items:
        item = dict(raw_item)
        item["line_total_cny"] = round(float(item.get("unit_price_cny") or 0) * int(item.get("quantity") or 1), 2)
        if "cost_price_cny" in item:
            item["line_cost_cny"] = round(float(item.get("cost_price_cny") or 0) * int(item.get("quantity") or 1), 2)
            item["profit_cny"] = round(item["line_total_cny"] - item["line_cost_cny"], 2)
        result.append(item)
    return result


def procurement_excel(quote: ProcurementQuote, db: Session) -> io.BytesIO:
    """Create an internal Excel workbook with quote metadata, formulas and all line items."""
    workbook = Workbook()
    summary = workbook.active
    summary.title = "报价概要"
    items_sheet = workbook.create_sheet("商品明细")
    expenses_sheet = workbook.create_sheet("额外支出")
    rates_sheet = workbook.create_sheet("锁定汇率")

    orange = "FF6A1A"
    dark = "151515"
    warm = "FFF0E5"
    border_color = "E8E0D6"
    white = "FFFFFF"
    thin = Side(style="thin", color=border_color)
    header_fill = PatternFill("solid", fgColor=dark)
    accent_fill = PatternFill("solid", fgColor=orange)
    soft_fill = PatternFill("solid", fgColor=warm)
    header_font = Font(color=white, bold=True)
    title_font = Font(color=dark, bold=True, size=18)
    label_font = Font(color="666666", bold=True)
    money_format = '¥#,##0.00'

    summary.merge_cells("A1:E1")
    summary["A1"] = f"cooolmake 采购报价单 · {quote.quote_code}"
    summary["A1"].font = title_font
    summary["A1"].fill = soft_fill
    summary["A1"].alignment = Alignment(vertical="center")
    summary.row_dimensions[1].height = 34

    operator_data = attach_operator_names({"created_by_id": quote.created_by_id, "updated_by_id": quote.updated_by_id}, db)
    summary_rows = [
        ("报价单号", quote.quote_code, "状态", quote.status),
        ("报价单标题", quote.title, "客户名称", quote.customer_name or ""),
        ("客户访问地址", f"{SITE_URL}/en/procurement/{quote.quote_code}", "打开密码", quote.access_password),
        ("默认币种", quote.preferred_currency or "USD", "汇率日期", quote.rates_date or ""),
        ("客户预期到货时间", quote.expected_arrival_local or "", "客户时区", quote.customer_timezone or ""),
        ("换算后北京时间", quote.expected_arrival_china or "", "发布时间", quote.published_at or ""),
        ("创建人", operator_data.get("created_by") or "", "最后处理人", operator_data.get("updated_by") or ""),
        ("创建时间", quote.created_at or "", "更新时间", quote.updated_at or ""),
        ("后台内部备注", quote.internal_note or "", "", ""),
    ]
    for row_index, row in enumerate(summary_rows, start=3):
        for column_index, value in enumerate(row, start=1):
            summary.cell(row_index, column_index, value)
        for column_index in (1, 3):
            cell = summary.cell(row_index, column_index)
            cell.font = label_font
            cell.fill = soft_fill
        for column_index in range(1, 5):
            summary.cell(row_index, column_index).border = Border(bottom=thin)
            summary.cell(row_index, column_index).alignment = Alignment(vertical="top", wrap_text=True)

    totals_start = 14
    summary[f"A{totals_start}"] = "人民币报价汇总"
    summary[f"A{totals_start}"].font = header_font
    summary[f"A{totals_start}"].fill = accent_fill
    summary.merge_cells(start_row=totals_start, start_column=1, end_row=totals_start, end_column=2)
    total_labels = ["商品报价合计", "头程运费", "尾程运费", "报价总计", "商品成本合计", "额外支出合计", "预计利润"]
    totals = procurement_totals(quote)
    for offset, label in enumerate(total_labels, start=1):
        row = totals_start + offset
        summary.cell(row, 1, label)
        summary.cell(row, 1).font = label_font
        summary.cell(row, 1).fill = soft_fill
        summary.cell(row, 2).number_format = money_format
        summary.cell(row, 1).border = summary.cell(row, 2).border = Border(bottom=thin)
    summary.cell(totals_start + 1, 2, totals["products_total_cny"])
    summary.cell(totals_start + 2, 2, float(quote.first_leg_cost_cny or 0))
    summary.cell(totals_start + 3, 2, float(quote.last_leg_cost_cny or 0))
    summary.cell(totals_start + 4, 2, totals["total_cny"])
    summary.cell(totals_start + 5, 2, totals["product_cost_total_cny"])
    summary.cell(totals_start + 6, 2, totals["additional_expense_total_cny"])
    summary.cell(totals_start + 7, 2, totals["profit_cny"])
    summary.cell(totals_start + 7, 1).font = Font(color="D92D20", bold=True)
    summary.cell(totals_start + 7, 2).font = Font(color="D92D20", bold=True, size=13)

    item_headers = ["序号", "商品ID", "图片地址", "商品名称（中文）", "商品名称（英文）", "数量", "成本单价（人民币）", "客户报价单价（人民币）", "成本小计", "报价小计", "单品利润", "采购链接 / 文本", "内部报价备注", "英文报价备注", "客户备注", "客户状态", "添加方"]
    items_sheet.append(item_headers)
    for cell in items_sheet[1]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
    image_streams: List[io.BytesIO] = []
    for index, raw_item in enumerate(quote.items or [], start=1):
        item = translate_procurement_item(dict(raw_item))
        row = index + 1
        items_sheet.append([
            index,
            item.get("id") or "",
            item.get("image") or "",
            item.get("name") or "",
            item.get("name_en") or "",
            int(item.get("quantity") or 1),
            float(item.get("cost_price_cny") or 0),
            float(item.get("unit_price_cny") or 0),
            None,
            None,
            None,
            item.get("procurement_source_text") or "",
            item.get("admin_note") or "",
            item.get("admin_note_en") or "",
            item.get("customer_note") or "",
            "客户已确认" if item.get("decision") == "confirmed" else "待客户确认",
            "客户添加" if item.get("added_by") == "customer" else "内部添加",
        ])
        quantity = int(item.get("quantity") or 1)
        line_cost = round(quantity * float(item.get("cost_price_cny") or 0), 2)
        line_quote = round(quantity * float(item.get("unit_price_cny") or 0), 2)
        items_sheet.cell(row, 9, line_cost)
        items_sheet.cell(row, 10, line_quote)
        items_sheet.cell(row, 11, round(line_quote - line_cost, 2))
        for money_column in range(7, 12):
            items_sheet.cell(row, money_column).number_format = money_format
        items_sheet.cell(row, 11).font = Font(color="D92D20", bold=True)
        image_url = str(item.get("image") or "").strip()
        if image_url:
            image_cell = items_sheet.cell(row, 3)
            image_cell.value = "打开原图"
            image_cell.hyperlink = image_url
            image_cell.style = "Hyperlink"
            try:
                response = httpx.get(image_url, timeout=12, follow_redirects=True)
                response.raise_for_status()
                if len(response.content) <= 8 * 1024 * 1024:
                    stream = io.BytesIO(response.content)
                    image_streams.append(stream)
                    picture = XLImage(stream)
                    picture.width = 86
                    picture.height = 86
                    items_sheet.add_image(picture, f"C{row}")
                    items_sheet.row_dimensions[row].height = 70
            except Exception as exc:
                logger.warning("Could not embed procurement image %s: %s", image_url, exc)
        for cell in items_sheet[row]:
            cell.alignment = Alignment(vertical="top", wrap_text=True)
            cell.border = Border(bottom=thin)

    expenses_sheet.append(["序号", "费用说明", "金额（人民币）"])
    for cell in expenses_sheet[1]:
        cell.fill = header_fill
        cell.font = header_font
    for index, expense in enumerate(quote.additional_expenses or [], start=1):
        expenses_sheet.append([index, expense.get("description") or "", float(expense.get("amount_cny") or 0)])
        expenses_sheet.cell(index + 1, 3).number_format = money_format
    expenses_sheet.append(["", "合计", totals["additional_expense_total_cny"]])
    expenses_sheet.cell(expenses_sheet.max_row, 2).font = label_font
    expenses_sheet.cell(expenses_sheet.max_row, 3).number_format = money_format

    rates_sheet.append(["币种", "1 人民币兑换", "报价总额（该币种）", "汇率锁定日期"])
    for cell in rates_sheet[1]:
        cell.fill = header_fill
        cell.font = header_font
    total_cny = procurement_totals(quote)["total_cny"]
    for code, rate in sorted((quote.exchange_rates or {}).items()):
        rates_sheet.append([str(code), float(rate), round(total_cny * float(rate), 2), quote.rates_date or ""])
    for row in rates_sheet.iter_rows(min_row=2):
        row[1].number_format = "0.000000"
        row[2].number_format = "#,##0.00"
        for cell in row:
            cell.border = Border(bottom=thin)

    widths = {
        "报价概要": [20, 46, 20, 36, 4],
        "商品明细": [8, 34, 16, 30, 30, 10, 18, 22, 16, 16, 16, 38, 32, 32, 32, 16, 14],
        "额外支出": [10, 46, 20],
        "锁定汇率": [14, 20, 24, 18],
    }
    for sheet in workbook.worksheets:
        sheet.freeze_panes = "A2" if sheet.title != "报价概要" else "A3"
        sheet.sheet_view.showGridLines = False
        for column_index, width in enumerate(widths[sheet.title], start=1):
            sheet.column_dimensions[get_column_letter(column_index)].width = width
        sheet.auto_filter.ref = sheet.dimensions if sheet.title != "报价概要" else None

    output = io.BytesIO()
    workbook.save(output)
    output.seek(0)
    return output


def serialize_procurement_quote(quote: ProcurementQuote, db: Optional[Session] = None, public: bool = False) -> Dict[str, Any]:
    serialized_items = public_procurement_items(quote.items) if public else [dict(item) for item in quote.items or []]
    totals = procurement_totals(quote)
    data = {
        "id": quote.id,
        "quote_code": quote.quote_code,
        "access_password": None if public else quote.access_password,
        "title": "Procurement quotation" if public else quote.title,
        "status": quote.status,
        "customer_name": None if public else quote.customer_name,
        "items": procurement_items_with_totals(serialized_items),
        "first_leg_cost_cny": float(quote.first_leg_cost_cny or 0),
        "last_leg_cost_cny": float(quote.last_leg_cost_cny or 0),
        "additional_expenses": None if public else [dict(expense) for expense in (quote.additional_expenses or [])],
        "preferred_currency": quote.preferred_currency or "USD",
        "exchange_rates": quote.exchange_rates or {},
        "rates_date": quote.rates_date,
        "expected_arrival_local": quote.expected_arrival_local,
        "customer_timezone": quote.customer_timezone,
        "expected_arrival_china": quote.expected_arrival_china.isoformat(timespec="minutes") if quote.expected_arrival_china else None,
        "internal_note": None if public else quote.internal_note,
        "created_at": quote.created_at.isoformat() if quote.created_at else None,
        "updated_at": quote.updated_at.isoformat() if quote.updated_at else None,
        "published_at": quote.published_at.isoformat() if quote.published_at else None,
        "owner_id": None if public else quote.owner_id,
        "created_by_id": quote.created_by_id,
        "updated_by_id": quote.updated_by_id,
        "products_total_cny": totals["products_total_cny"],
        "shipping_total_cny": totals["shipping_total_cny"],
        "total_cny": totals["total_cny"],
        "confirmed_products_total_cny": totals["confirmed_products_total_cny"],
        "confirmed_total_cny": totals["confirmed_total_cny"],
    }
    if not public:
        data.update({
            "product_cost_total_cny": totals["product_cost_total_cny"],
            "additional_expense_total_cny": totals["additional_expense_total_cny"],
            "profit_cny": totals["profit_cny"],
            "display_profit_cny": totals["display_profit_cny"],
        })
    else:
        data.pop("additional_expenses", None)
    if db and not public:
        data = attach_operator_names(data, db)
        data["owner"] = admin_label_map(db, data.get("owner_id")).get(data.get("owner_id"))
    return data


def procurement_token_version(quote: ProcurementQuote) -> str:
    return hashlib.sha256((quote.access_password or "").encode()).hexdigest()[:16]


def procurement_access_token(quote: ProcurementQuote) -> str:
    return jwt.encode({
        "sub": str(quote.id),
        "scope": "procurement_quote",
        "code": quote.quote_code,
        "ver": procurement_token_version(quote),
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }, SECRET_KEY, algorithm=ALGORITHM)


def public_procurement_from_token(code: str, authorization: Optional[str], db: Session) -> ProcurementQuote:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Password required")
    try:
        payload = jwt.decode(authorization[7:], SECRET_KEY, algorithms=[ALGORITHM])
        quote = db.get(ProcurementQuote, int(payload["sub"]))
    except (JWTError, ValueError, KeyError):
        raise HTTPException(401, "Invalid or expired access")
    if not quote or quote.quote_code != code or payload.get("scope") != "procurement_quote" or payload.get("ver") != procurement_token_version(quote):
        raise HTTPException(401, "Invalid or expired access")
    if quote.status not in {"published", "customer_confirmed"}:
        raise HTTPException(404, "Procurement quote not found")
    return quote


def procurement_arrival_in_china(data: ProcurementArrivalInput) -> tuple[str, str, datetime]:
    local_value = (data.expected_arrival_local or "").strip()
    if not local_value:
        raise HTTPException(400, "Expected arrival time is required")
    try:
        parsed = datetime.fromisoformat(local_value)
    except ValueError:
        raise HTTPException(400, "Invalid expected arrival time")
    timezone_name = (data.customer_timezone or "UTC").strip()[:100] or "UTC"
    if parsed.tzinfo is None:
        try:
            local_zone = ZoneInfo(timezone_name)
        except ZoneInfoNotFoundError:
            if data.timezone_offset_minutes is None:
                raise HTTPException(400, "Invalid customer time zone")
            local_zone = timezone(timedelta(minutes=-int(data.timezone_offset_minutes)))
        parsed = parsed.replace(tzinfo=local_zone)
    china_time = parsed.astimezone(ZoneInfo("Asia/Shanghai")).replace(tzinfo=None)
    return local_value[:50], timezone_name, china_time


def serialize_user(user: User):
    return {
        "id": user.id,
        "username": user.username,
        "nickname": user.nickname or user.username,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


def require_super_admin(user: User):
    if user.role != "super_admin":
        raise HTTPException(403, "Only super admin can do this")
    return user


def admin_label_map(db: Session, *ids: Optional[int]) -> Dict[int, str]:
    clean_ids = sorted({int(x) for x in ids if x})
    if not clean_ids:
        return {}
    users = db.query(User).filter(User.id.in_(clean_ids)).all()
    return {user.id: user.nickname or user.username for user in users}


def attach_operator_names(data: Dict[str, Any], db: Session) -> Dict[str, Any]:
    labels = admin_label_map(db, data.get("created_by_id"), data.get("updated_by_id"))
    data["created_by"] = labels.get(data.get("created_by_id"))
    data["updated_by"] = labels.get(data.get("updated_by_id"))
    return data


def serialize_admin_item(item: Any, serializer, db: Session) -> Dict[str, Any]:
    data = serializer(item)
    if hasattr(item, "created_by_id"):
        data["created_by_id"] = item.created_by_id
    if hasattr(item, "updated_by_id"):
        data["updated_by_id"] = item.updated_by_id
    if hasattr(item, "created_at") and "created_at" not in data:
        data["created_at"] = item.created_at.isoformat() if item.created_at else None
    if hasattr(item, "updated_at") and "updated_at" not in data:
        data["updated_at"] = item.updated_at.isoformat() if item.updated_at else None
    return attach_operator_names(data, db)


def serialize_product(p: Product, locale: str = "en", include_source: bool = False):
    keys = ["sku", "product_code", "slug", "status", "category_id", "main_image", "gallery_images", "detail_images", "video_url", "price", "show_price", "is_free_shipping", "stock_quantity", "color_variants", "stock_status", "material", "material_en", "size", "size_en", "weight", "color", "package_info", "package_info_en", "usage_scene", "usage_scene_en", "is_featured", "is_new", "is_best_seller", "sort_order", "allow_whatsapp", "title_en", "title_ja", "title_ko", "title_zh", "short_description_en", "short_description_ja", "short_description_ko", "short_description_zh", "description_en", "description_ja", "description_ko", "description_zh", "features_en", "features_ja", "features_ko", "features_zh", "seo_title_en", "seo_description_en"]
    if include_source:
        keys.extend(["source_platform", "source_url"])
    variants = []
    for variant in p.color_variants or []:
        variant_copy = dict(variant)
        variant_copy["name"] = variant.get("name_zh") if locale == "zh" else variant.get(f"name_{locale}") or variant.get("name_en") or variant.get("name_zh")
        variants.append(variant_copy)
    translated_specs = {
        "material": p.material if locale == "zh" else p.material_en or p.material,
        "size": p.size if locale == "zh" else p.size_en or p.size,
        "package_info": p.package_info if locale == "zh" else p.package_info_en or p.package_info,
        "usage_scene": p.usage_scene if locale == "zh" else p.usage_scene_en or p.usage_scene,
    }
    data = {"id": p.id, **{k: getattr(p, k) for k in keys}, **translated_specs, "color_variants": variants, "created_at": p.created_at.isoformat() if p.created_at else None, "updated_at": p.updated_at.isoformat() if p.updated_at else None, "published_at": p.published_at.isoformat() if p.published_at else None, "title": localized(p, "title", locale), "short_description": localized(p, "short_description", locale), "description": localized(p, "description", locale), "features": localized(p, "features", locale) or [], "category": serialize_category(p.category, locale) if p.category else None, "tags": [serialize_tag(t, locale) for t in p.tags]}
    if include_source:
        data["created_by_id"] = p.created_by_id
        data["updated_by_id"] = p.updated_by_id
    return data


def token_for(user: User):
    return jwt.encode({"sub": str(user.id), "exp": datetime.now(timezone.utc) + timedelta(hours=12)}, SECRET_KEY, algorithm=ALGORITHM)


def current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")
    try:
        payload = jwt.decode(authorization[7:], SECRET_KEY, algorithms=[ALGORITHM])
        user = db.get(User, int(payload["sub"]))
    except (JWTError, ValueError, KeyError):
        raise HTTPException(401, "Invalid or expired token")
    if not user or not user.is_active:
        raise HTTPException(401, "Inactive user")
    return user


app = FastAPI(title="cooolmake API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","), allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.mount("/storage", StaticFiles(directory=STORAGE_DIR), name="storage")


def _action_identity(db: Session, authorization: Optional[str]) -> Optional[User]:
    try:
        if not authorization or not authorization.startswith("Bearer "):
            return None
        payload = jwt.decode(authorization[7:], SECRET_KEY, algorithms=[ALGORITHM])
        user = db.get(User, int(payload["sub"]))
        return user if user and user.is_active else None
    except Exception:
        return None


@app.middleware("http")
async def admin_action_logger(request: Request, call_next):
    response = await call_next(request)
    try:
        path = request.url.path
        if request.method in {"POST", "PUT", "DELETE"} and path.startswith("/api/admin/") and path != "/api/admin/auth/login":
            db = SessionLocal()
            try:
                user = _action_identity(db, request.headers.get("authorization"))
                if user:
                    size = request.headers.get("content-length")
                    detail = f"文件大小约 {int(size) // 1024 // 1024}MB" if size and size.isdigit() and int(size) > 1024 * 1024 and "upload" in path else None
                    db.add(AdminActionLog(
                        user_id=user.id,
                        username=user.username,
                        nickname=user.nickname or user.username,
                        action=f"{request.method} {path}",
                        detail=detail,
                        status=response.status_code,
                        ok=response.status_code < 400,
                        ip=request.client.host if request.client else None,
                    ))
                    db.commit()
            finally:
                db.close()
    except Exception:
        logging.getLogger("uvicorn.error").exception("admin action log failed")
    return response


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/admin/auth/login")
def login(data: LoginInput, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else None
    user = db.query(User).filter(User.username == data.username).first()
    if not user or not pwd_context.verify(data.password, user.password_hash):
        db.add(AdminActionLog(user_id=user.id if user else None, username=(data.username or "")[:200], nickname=(user.nickname or user.username) if user else None, action="login", detail="账号或密码错误", status=401, ok=False, ip=ip))
        db.commit()
        raise HTTPException(401, "Incorrect username or password")
    db.add(AdminActionLog(user_id=user.id, username=user.username, nickname=user.nickname or user.username, action="login", status=200, ok=True, ip=ip))
    db.commit()
    return {"access_token": token_for(user), "token_type": "bearer"}


@app.get("/api/admin/auth/me")
def me(user: User = Depends(current_user)):
    return serialize_user(user)


@app.put("/api/admin/auth/profile")
def update_profile(data: ProfileInput, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if data.nickname is not None:
        nickname = data.nickname.strip()
        user.nickname = nickname or user.username
    if data.new_password:
        if len(data.new_password) < 8:
            raise HTTPException(400, "New password must be at least 8 characters")
        if not data.current_password or not pwd_context.verify(data.current_password, user.password_hash):
            raise HTTPException(400, "Current password is incorrect")
        user.password_hash = pwd_context.hash(data.new_password)
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return serialize_user(user)


@app.get("/api/admin/users")
def admin_users(db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_super_admin(user)
    return [serialize_user(item) for item in db.query(User).order_by(User.id.asc()).all()]


@app.post("/api/admin/users", status_code=201)
def create_admin_user(data: AdminCreateInput, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_super_admin(user)
    username = data.username.strip()
    if not username:
        raise HTTPException(400, "Username is required")
    if len(data.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(409, "Admin account already exists")
    item = User(username=username, nickname=(data.nickname or username).strip() or username, password_hash=pwd_context.hash(data.password), role="admin", is_active=True)
    db.add(item)
    db.commit()
    db.refresh(item)
    return serialize_user(item)


@app.put("/api/admin/users/{user_id}/status")
def update_admin_status(user_id: int, data: Dict[str, Any] = Body(...), db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_super_admin(user)
    item = db.get(User, user_id)
    if not item:
        raise HTTPException(404, "Admin not found")
    if item.role == "super_admin":
        raise HTTPException(400, "Super admin cannot be disabled")
    is_active = bool(data.get("is_active"))
    item.is_active = is_active
    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return serialize_user(item)


@app.delete("/api/admin/users/{user_id}", status_code=204)
def delete_admin_user(user_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_super_admin(user)
    item = db.get(User, user_id)
    if not item:
        raise HTTPException(404, "Admin not found")
    if item.role == "super_admin":
        raise HTTPException(400, "Super admin cannot be deleted")
    if item.is_active:
        raise HTTPException(400, "Please disable this admin before deleting")
    db.delete(item)
    db.commit()


@app.get("/api/public/categories")
def public_categories(locale: str = "en", db: Session = Depends(get_db)):
    return [serialize_category(x, locale) for x in db.query(Category).filter(Category.is_active.is_(True)).order_by(Category.sort_order).all()]


@app.get("/api/public/tags")
def public_tags(locale: str = "en", db: Session = Depends(get_db)):
    return [serialize_tag(x, locale) for x in db.query(Tag).filter(Tag.is_active.is_(True)).order_by(Tag.sort_order).all()]


@app.get("/api/public/articles")
def public_articles(slug: Optional[str] = None, category: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Article).filter(Article.is_published.is_(True))
    if slug: query = query.filter(Article.slug == slug)
    if category: query = query.filter(Article.category == category)
    return [serialize_article(x, include_content=bool(slug)) for x in query.order_by(Article.published_at.desc()).all()]


def analytics_visitor_expr():
    return func.coalesce(AnalyticsEvent.session_id, AnalyticsEvent.ip, AnalyticsEvent.user_agent)


def product_click_counts(db: Session):
    unique_views = db.query(
        AnalyticsEvent.product_id.label("product_id"),
        func.date(AnalyticsEvent.created_at).label("view_date"),
        analytics_visitor_expr().label("visitor_key"),
    ).filter(
        AnalyticsEvent.event_type == "product_view",
        AnalyticsEvent.product_id.is_not(None),
    ).group_by(
        AnalyticsEvent.product_id,
        func.date(AnalyticsEvent.created_at),
        analytics_visitor_expr(),
    ).subquery()
    return db.query(
        unique_views.c.product_id,
        func.count().label("click_count"),
    ).group_by(unique_views.c.product_id).subquery()


def unique_product_event_counts(db: Session, event_type: str, product_ids: list[int], start: Optional[datetime] = None) -> Dict[int, int]:
    if not product_ids:
        return {}
    query = db.query(
        AnalyticsEvent.product_id.label("product_id"),
        func.date(AnalyticsEvent.created_at).label("event_date"),
        analytics_visitor_expr().label("visitor_key"),
    ).filter(
        AnalyticsEvent.event_type == event_type,
        AnalyticsEvent.product_id.in_(product_ids),
        AnalyticsEvent.product_id.is_not(None),
    )
    if start:
        query = query.filter(AnalyticsEvent.created_at >= start)
    unique_events = query.group_by(
        AnalyticsEvent.product_id,
        func.date(AnalyticsEvent.created_at),
        analytics_visitor_expr(),
    ).subquery()
    rows = db.query(
        unique_events.c.product_id,
        func.count().label("event_count"),
    ).group_by(unique_events.c.product_id).all()
    return {int(product_id): int(count or 0) for product_id, count in rows}


def product_analytics_map(db: Session, product_ids: list[int]) -> Dict[int, Dict[str, int]]:
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    seven_days = today - timedelta(days=6)
    thirty_days = today - timedelta(days=29)
    views_today = unique_product_event_counts(db, "product_view", product_ids, today)
    views_7d = unique_product_event_counts(db, "product_view", product_ids, seven_days)
    views_30d = unique_product_event_counts(db, "product_view", product_ids, thirty_days)
    views_total = unique_product_event_counts(db, "product_view", product_ids)
    whatsapp_30d = unique_product_event_counts(db, "whatsapp_click", product_ids, thirty_days)
    whatsapp_total = unique_product_event_counts(db, "whatsapp_click", product_ids)
    return {
        product_id: {
            "views_today": views_today.get(product_id, 0),
            "views_7d": views_7d.get(product_id, 0),
            "views_30d": views_30d.get(product_id, 0),
            "views_total": views_total.get(product_id, 0),
            "whatsapp_30d": whatsapp_30d.get(product_id, 0),
            "whatsapp_total": whatsapp_total.get(product_id, 0),
        }
        for product_id in product_ids
    }


@app.get("/api/public/products")
def public_products(locale: str = "en", category: Optional[str] = None, tag: Optional[str] = None, keyword: Optional[str] = None, collection: Optional[str] = None, sort: str = "recommended", page: int = 1, page_size: int = Query(20, le=100), db: Session = Depends(get_db)):
    q = db.query(Product).filter(Product.status == "published")
    if collection == "new":
        q = q.filter(Product.is_new.is_(True))
    if category:
        q = q.join(Category).filter(or_(Category.slug == category, Category.slug == normalize_slug(category)))
    if tag:
        q = q.join(Product.tags).filter(Tag.slug == tag)
    if keyword:
        term = f"%{keyword}%"
        q = q.filter(or_(Product.title_en.ilike(term), Product.title_ja.ilike(term), Product.title_ko.ilike(term), Product.title_zh.ilike(term), Product.description_en.ilike(term), Product.sku.ilike(term)))
    total = q.count()
    if sort == "popular":
        clicks = product_click_counts(db)
        q = q.outerjoin(clicks, clicks.c.product_id == Product.id).order_by(func.coalesce(clicks.c.click_count, 0).desc(), Product.published_at.desc(), Product.created_at.desc())
    elif sort == "newest":
        q = q.order_by(Product.published_at.desc(), Product.created_at.desc())
    else:
        q = q.order_by(Product.sort_order.asc(), Product.id.desc())
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [serialize_product(x, locale) for x in items], "total": total, "page": page, "page_size": page_size}


@app.get("/api/public/products/{slug}")
def public_product(slug: str, locale: str = "en", db: Session = Depends(get_db)):
    item = db.query(Product).filter(Product.slug == slug, Product.status == "published").first()
    if not item:
        raise HTTPException(404, "Product not found")
    result = serialize_product(item, locale)
    related = db.query(Product).filter(Product.status == "published", Product.id != item.id, Product.category_id == item.category_id).limit(4).all()
    result["related"] = [serialize_product(x, locale) for x in related]
    return result


@app.get("/api/public/home")
def public_home(locale: str = "en", db: Session = Depends(get_db)):
    banners = db.query(Banner).filter(Banner.is_active.is_(True)).order_by(Banner.sort_order).all()
    def sb(b: Banner):
        return {"id": b.id, "title": localized(b, "title", locale), "subtitle": localized(b, "subtitle", locale), "image": b.image, "link_url": b.link_url, "button_text": b.button_text_en}
    published = db.query(Product).filter(Product.status == "published")
    new_arrivals = published.filter(Product.is_new.is_(True)).order_by(Product.published_at.desc(), Product.created_at.desc()).limit(5).all()
    clicks = product_click_counts(db)
    best_sellers = published.outerjoin(clicks, clicks.c.product_id == Product.id).order_by(func.coalesce(clicks.c.click_count, 0).desc(), Product.published_at.desc(), Product.created_at.desc()).limit(5).all()
    return {"banners": [sb(x) for x in banners], "featured_categories": [serialize_category(x, locale) for x in db.query(Category).filter(Category.is_active.is_(True)).order_by(Category.sort_order).limit(6)], "new_arrivals": [serialize_product(x, locale) for x in new_arrivals], "best_sellers": [serialize_product(x, locale) for x in best_sellers], "featured_products": [serialize_product(x, locale) for x in published.filter(Product.is_featured.is_(True)).limit(8)]}


@app.get("/api/public/settings")
def public_settings(db: Session = Depends(get_db)):
    return {x.key: x.value for x in db.query(SiteSetting).all()}


@app.post("/api/public/analytics/event", status_code=201)
def event(data: EventInput, request: Request, db: Session = Depends(get_db)):
    payload = data.model_dump()
    if payload.get("page_url"):
        query = parse_qs(urlparse(payload["page_url"]).query)
        for field in ("utm_source", "utm_medium", "utm_campaign"):
            if not payload.get(field) and query.get(field):
                payload[field] = query[field][0]
    forwarded_for = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    client_ip = forwarded_for or (request.client.host if request.client else None)
    user_agent = request.headers.get("user-agent")
    if payload.get("event_type") in DEDUPE_ANALYTICS_EVENTS:
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        duplicate_query = db.query(AnalyticsEvent).filter(
            AnalyticsEvent.event_type == payload.get("event_type"),
            AnalyticsEvent.created_at >= today,
        )
        if payload.get("product_id"):
            duplicate_query = duplicate_query.filter(AnalyticsEvent.product_id == payload.get("product_id"))
        elif payload.get("page_url"):
            duplicate_query = duplicate_query.filter(AnalyticsEvent.page_url == payload.get("page_url"))
        if payload.get("session_id"):
            duplicate_query = duplicate_query.filter(AnalyticsEvent.session_id == payload.get("session_id"))
        elif client_ip:
            duplicate_query = duplicate_query.filter(AnalyticsEvent.ip == client_ip, AnalyticsEvent.user_agent == user_agent)
        if duplicate_query.first():
            return {"id": None, "recorded": False, "deduped": True}
    row = AnalyticsEvent(**payload, ip=client_ip, user_agent=user_agent)
    db.add(row); db.commit()
    return {"id": row.id, "recorded": True}


def crud_list(model, db):
    return db.query(model).order_by(model.id.desc()).all()


@app.get("/api/admin/products")
def admin_products(keyword: Optional[str] = None, db: Session = Depends(get_db), _: User = Depends(current_user)):
    query = db.query(Product)
    if keyword and keyword.strip():
        term = f"%{keyword.strip()}%"
        query = query.filter(or_(Product.product_code.ilike(term), Product.sku.ilike(term), Product.title_zh.ilike(term), Product.title_en.ilike(term)))
    products = query.order_by(Product.id.desc()).all()
    analytics = product_analytics_map(db, [item.id for item in products])
    result = []
    for item in products:
        data = attach_operator_names(serialize_product(item, include_source=True), db)
        data["analytics"] = analytics.get(item.id, {
            "views_today": 0,
            "views_7d": 0,
            "views_30d": 0,
            "views_total": 0,
            "whatsapp_30d": 0,
            "whatsapp_total": 0,
        })
        result.append(data)
    return result


def apply_product(item: Product, data: ProductInput, db: Session):
    values = data.model_dump(exclude={"tag_ids", "auto_translate"})
    if data.auto_translate:
        values["title_en"] = translate_zh(data.title_zh, "en") or data.title_en or data.title_zh
        values["title_ja"] = translate_zh(data.title_zh, "ja") or data.title_ja or values["title_en"]
        values["title_ko"] = translate_zh(data.title_zh, "ko") or data.title_ko or values["title_en"]
        values["short_description_en"] = translate_zh(data.short_description_zh, "en") or data.short_description_en
        values["short_description_ja"] = translate_zh(data.short_description_zh, "ja") or data.short_description_ja or values["short_description_en"]
        values["short_description_ko"] = translate_zh(data.short_description_zh, "ko") or data.short_description_ko or values["short_description_en"]
        values["description_en"] = translate_zh(data.description_zh, "en") or data.description_en
        values["description_ja"] = translate_zh(data.description_zh, "ja") or data.description_ja or values["description_en"]
        values["description_ko"] = translate_zh(data.description_zh, "ko") or data.description_ko or values["description_en"]
        values["features_en"] = [translate_zh(feature, "en") or feature for feature in data.features_zh]
        values["features_ja"] = [translate_zh(feature, "ja") or translate_zh(feature, "en") or feature for feature in data.features_zh]
        values["features_ko"] = [translate_zh(feature, "ko") or translate_zh(feature, "en") or feature for feature in data.features_zh]
        values["color_variants"] = [{
            **variant,
            "name_en": translate_zh(variant.get("name_zh"), "en") or variant.get("name_en") or variant.get("name_zh"),
            "name_ja": translate_zh(variant.get("name_zh"), "ja") or variant.get("name_ja") or variant.get("name_en") or variant.get("name_zh"),
            "name_ko": translate_zh(variant.get("name_zh"), "ko") or variant.get("name_ko") or variant.get("name_en") or variant.get("name_zh"),
        } for variant in data.color_variants]
        item.material_en = translate_zh(data.material, "en")
        item.size_en = translate_zh(data.size, "en")
        item.package_info_en = translate_zh(data.package_info, "en")
        item.usage_scene_en = translate_zh(data.usage_scene, "en")
    elif not values.get("title_en"):
        values["title_en"] = data.title_zh
    if values.get("color_variants"):
        values["stock_quantity"] = sum(max(0, int(variant.get("stock_quantity", 0) or 0)) for variant in values["color_variants"])
    if not values.get("main_image") and values.get("gallery_images"):
        values["main_image"] = values["gallery_images"][0]
    for key, value in values.items():
        if key in ("sku", "slug") and not value:
            continue
        setattr(item, key, value)
    item.tags = db.query(Tag).filter(Tag.id.in_(data.tag_ids)).all() if data.tag_ids else []


@app.post("/api/admin/products", status_code=201)
def create_product(data: ProductInput, idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"), db: Session = Depends(get_db), user: User = Depends(current_user)):
    request_id = (idempotency_key or "").strip()[:100] or None
    if request_id:
        if DATABASE_URL.startswith("postgresql"):
            db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:request_id))"), {"request_id": request_id})
        existing = db.query(Product).filter(Product.create_request_id == request_id).first()
        if existing:
            return attach_operator_names(serialize_product(existing, include_source=True), db)
    item = Product(sku=data.sku or f"TEMP-{uuid.uuid4().hex[:12]}", slug=data.slug or f"temp-{uuid.uuid4().hex[:12]}", create_request_id=request_id); apply_product(item, data, db)
    item.created_by_id = user.id
    item.updated_by_id = user.id
    if item.status == "published": item.published_at = datetime.utcnow()
    db.add(item); db.flush()
    item.product_code = f"CLM-{item.id:06d}"
    if not data.sku: item.sku = item.product_code
    if not data.slug: item.slug = item.product_code.lower()
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if request_id:
            existing = db.query(Product).filter(Product.create_request_id == request_id).first()
            if existing:
                return attach_operator_names(serialize_product(existing, include_source=True), db)
        raise
    return attach_operator_names(serialize_product(item, include_source=True), db)


@app.get("/api/admin/products/{item_id}")
def get_product(item_id: int, db: Session = Depends(get_db), _: User = Depends(current_user)):
    item = db.get(Product, item_id)
    if not item: raise HTTPException(404, "Not found")
    return attach_operator_names(serialize_product(item, include_source=True), db)


@app.put("/api/admin/products/{item_id}")
def update_product(item_id: int, data: ProductInput, db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = db.get(Product, item_id)
    if not item: raise HTTPException(404, "Not found")
    was_published = item.status == "published"
    apply_product(item, data, db)
    if not item.created_by_id:
        item.created_by_id = user.id
    item.updated_by_id = user.id
    if item.status == "published" and not was_published: item.published_at = datetime.utcnow()
    db.commit(); return attach_operator_names(serialize_product(item, include_source=True), db)


@app.delete("/api/admin/products/{item_id}", status_code=204)
def delete_product(item_id: int, db: Session = Depends(get_db), _: User = Depends(current_user)):
    item = db.get(Product, item_id)
    if item: db.delete(item); db.commit()


@app.get("/api/admin/products/{item_id}/analytics")
def product_analytics(item_id: int, days: int = Query(30, ge=1, le=365), db: Session = Depends(get_db), _: User = Depends(current_user)):
    product = db.get(Product, item_id)
    if not product:
        raise HTTPException(404, "Product not found")
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    first_day = today - timedelta(days=days - 1)
    summary = product_analytics_map(db, [item_id]).get(item_id, {
        "views_today": 0,
        "views_7d": 0,
        "views_30d": 0,
        "views_total": 0,
        "whatsapp_30d": 0,
        "whatsapp_total": 0,
    })
    trend = []
    for offset in range(days):
        start = first_day + timedelta(days=offset)
        end = start + timedelta(days=1)
        views = db.query(analytics_visitor_expr(), AnalyticsEvent.product_id).filter(
            AnalyticsEvent.event_type == "product_view",
            AnalyticsEvent.product_id == item_id,
            AnalyticsEvent.created_at >= start,
            AnalyticsEvent.created_at < end,
        ).group_by(analytics_visitor_expr(), AnalyticsEvent.product_id).count()
        whatsapp_clicks = db.query(analytics_visitor_expr(), AnalyticsEvent.product_id).filter(
            AnalyticsEvent.event_type == "whatsapp_click",
            AnalyticsEvent.product_id == item_id,
            AnalyticsEvent.created_at >= start,
            AnalyticsEvent.created_at < end,
        ).group_by(analytics_visitor_expr(), AnalyticsEvent.product_id).count()
        trend.append({"date": start.date().isoformat(), "views": views, "whatsapp_clicks": whatsapp_clicks})

    language_rows = db.query(AnalyticsEvent.locale, func.count(AnalyticsEvent.id)).filter(
        AnalyticsEvent.product_id == item_id,
        AnalyticsEvent.created_at >= first_day,
        AnalyticsEvent.locale.isnot(None),
    ).group_by(AnalyticsEvent.locale).order_by(func.count(AnalyticsEvent.id).desc()).limit(8).all()
    source_rows = db.query(AnalyticsEvent.utm_source, func.count(AnalyticsEvent.id)).filter(
        AnalyticsEvent.product_id == item_id,
        AnalyticsEvent.created_at >= first_day,
        AnalyticsEvent.utm_source.isnot(None),
        AnalyticsEvent.utm_source != "",
    ).group_by(AnalyticsEvent.utm_source).order_by(func.count(AnalyticsEvent.id).desc()).limit(8).all()
    return {
        "product": {"id": product.id, "product_code": product.product_code, "title": product.title_zh or product.title_en, "slug": product.slug},
        "days": days,
        "summary": summary,
        "trend": trend,
        "languages": [{"locale": locale or "unknown", "count": int(count or 0)} for locale, count in language_rows],
        "sources": [{"source": source or "unknown", "count": int(count or 0)} for source, count in source_rows],
    }


def apply_order(order: CustomerOrder, data: CustomerOrderInput, user: User):
    values = data.model_dump()
    total_price = values.pop("total_price", None)
    for key, value in values.items():
        if key == "items":
            value = [item for item in (value or []) if item.get("title") or item.get("product_code") or item.get("product_id")]
        setattr(order, key, value)
    order.product_cost = float(order.product_cost or 0)
    order.first_leg_cost = float(order.first_leg_cost or 0)
    order.last_leg_cost = float(order.last_leg_cost or 0)
    order.total_price = float(total_price) if total_price not in (None, "") else order_total_from_costs(order.product_cost, order.first_leg_cost, order.last_leg_cost)
    order.customer_address = compose_customer_address(order)
    order.updated_by_id = user.id


@app.get("/api/admin/orders")
def admin_orders(keyword: Optional[str] = None, payment: Optional[str] = None, db: Session = Depends(get_db), _: User = Depends(current_user)):
    query = db.query(CustomerOrder)
    if keyword and keyword.strip():
        term = f"%{keyword.strip()}%"
        query = query.filter(or_(CustomerOrder.order_code.ilike(term), CustomerOrder.customer_name.ilike(term), CustomerOrder.customer_phone.ilike(term)))
    if payment == "paid":
        query = query.filter(CustomerOrder.status != "cancelled", CustomerOrder.is_paid.is_(True))
    elif payment == "unpaid":
        query = query.filter(CustomerOrder.status != "cancelled", CustomerOrder.is_paid.is_(False))
    return [serialize_order(item, db) for item in query.order_by(CustomerOrder.id.desc()).all()]


@app.post("/api/admin/orders", status_code=201)
def create_order(data: CustomerOrderInput, db: Session = Depends(get_db), user: User = Depends(current_user)):
    order = CustomerOrder(order_code=generate_order_code(db), access_password=generate_order_password())
    apply_order(order, data, user)
    order.created_by_id = user.id
    order.updated_by_id = user.id
    order.confirmed_at = datetime.utcnow()
    db.add(order); db.commit()
    return serialize_order(order, db)


@app.get("/api/admin/orders/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db), _: User = Depends(current_user)):
    order = db.get(CustomerOrder, order_id)
    if not order: raise HTTPException(404, "Order not found")
    return serialize_order(order, db)


@app.put("/api/admin/orders/{order_id}")
def update_order(order_id: int, data: CustomerOrderInput, db: Session = Depends(get_db), user: User = Depends(current_user)):
    order = db.get(CustomerOrder, order_id)
    if not order: raise HTTPException(404, "Order not found")
    apply_order(order, data, user)
    if not order.created_by_id:
        order.created_by_id = user.id
    db.commit()
    return serialize_order(order, db)


@app.post("/api/admin/orders/{order_id}/reset-password")
def reset_order_password(order_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    order = db.get(CustomerOrder, order_id)
    if not order: raise HTTPException(404, "Order not found")
    order.access_password = generate_order_password()
    order.updated_by_id = user.id
    db.commit()
    return serialize_order(order, db)


def cancel_customer_order(order_id: int, db: Session, user: User):
    order = db.get(CustomerOrder, order_id)
    if order:
        order.status = "cancelled"
        order.updated_by_id = user.id
        db.commit()


@app.post("/api/admin/orders/{order_id}/cancel", status_code=204)
def cancel_order(order_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    cancel_customer_order(order_id, db, user)


@app.delete("/api/admin/orders/{order_id}", status_code=204)
def delete_order(order_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    cancel_customer_order(order_id, db, user)


def public_order_by_password(code: str, password: str, db: Session) -> CustomerOrder:
    order = db.query(CustomerOrder).filter(CustomerOrder.order_code == code).first()
    if not order or order.status == "draft":
        raise HTTPException(404, "Order not found")
    if not secrets.compare_digest(order.access_password, password or ""):
        raise HTTPException(403, "Invalid order number or password")
    return order


@app.get("/api/public/orders/{code}/availability")
def public_order_availability(code: str, db: Session = Depends(get_db)):
    order = db.query(CustomerOrder).filter(CustomerOrder.order_code == code).first()
    if not order or order.status == "draft":
        raise HTTPException(404, "Order not found")
    return {"available": True}


@app.post("/api/public/orders/{code}")
def public_order(code: str, data: PublicOrderPasswordInput, db: Session = Depends(get_db)):
    return serialize_order(public_order_by_password(code, data.password, db), public=True)


@app.put("/api/public/orders/{code}/customer")
def update_public_order_customer(code: str, data: PublicOrderCustomerInput, db: Session = Depends(get_db)):
    order = public_order_by_password(code, data.password, db)
    if order.customer_confirmed:
        raise HTTPException(409, "Customer information has already been confirmed")
    order.customer_name = data.customer_name
    order.customer_phone = data.customer_phone
    order.customer_country = data.customer_country
    order.customer_province = data.customer_province
    order.customer_city = data.customer_city
    order.customer_district = data.customer_district
    order.customer_detail_address = data.customer_detail_address
    order.customer_address = data.customer_address
    order.customer_address = compose_customer_address(order)
    order.customer_note = data.customer_note
    db.commit()
    return serialize_order(order, public=True)


@app.post("/api/public/orders/{code}/confirm-customer")
def confirm_public_order_customer(code: str, data: PublicOrderPasswordInput, db: Session = Depends(get_db)):
    order = public_order_by_password(code, data.password, db)
    if not order.customer_confirmed:
        order.customer_confirmed = True
        order.customer_confirmed_at = datetime.utcnow()
        order.status = "customer_confirmed" if order.status == "pending_confirm" else order.status
        db.commit()
    return serialize_order(order, public=True)


def apply_procurement_quote(quote: ProcurementQuote, data: ProcurementQuoteInput, user: User, db: Session):
    quote.title = data.title.strip() or "商品采购报价单"
    quote.status = data.status if data.status in {"draft", "published", "customer_confirmed", "cancelled"} else "draft"
    quote.customer_name = (data.customer_name or "").strip() or None
    quote.items = [translate_procurement_item(normalize_procurement_item(item)) for item in (data.items or []) if item.get("name") or item.get("image")]
    quote.first_leg_cost_cny = max(0, round(float(data.first_leg_cost_cny or 0), 2))
    quote.last_leg_cost_cny = max(0, round(float(data.last_leg_cost_cny or 0), 2))
    quote.additional_expenses = [
        {
            "id": str(expense.get("id") or uuid.uuid4().hex),
            "description": str(expense.get("description") or "").strip(),
            "amount_cny": max(0, round(float(expense.get("amount_cny") or 0), 2)),
        }
        for expense in (data.additional_expenses or [])
        if str(expense.get("description") or "").strip() or float(expense.get("amount_cny") or 0) > 0
    ]
    quote.preferred_currency = (data.preferred_currency or "USD").strip().upper()[:10]
    quote.internal_note = data.internal_note
    requested_owner_id = data.owner_id or quote.owner_id or user.id
    owner = db.get(User, requested_owner_id)
    if not owner:
        raise HTTPException(400, "Selected administrator does not exist")
    if not owner.is_active and owner.id != quote.owner_id:
        raise HTTPException(400, "Selected administrator is disabled")
    quote.owner_id = owner.id
    quote.updated_by_id = user.id
    if quote.status == "published":
        rates, rates_date = fetch_daily_exchange_rates(quote.exchange_rates or None, quote.rates_date)
        quote.exchange_rates = rates
        quote.rates_date = rates_date
        quote.published_at = quote.published_at or datetime.utcnow()


@app.get("/api/admin/procurement-quotes")
def admin_procurement_quotes(keyword: Optional[str] = None, status: Optional[str] = None, db: Session = Depends(get_db), _: User = Depends(current_user)):
    query = db.query(ProcurementQuote)
    if keyword and keyword.strip():
        term = f"%{keyword.strip()}%"
        query = query.filter(or_(ProcurementQuote.quote_code.ilike(term), ProcurementQuote.customer_name.ilike(term), ProcurementQuote.title.ilike(term)))
    if status:
        query = query.filter(ProcurementQuote.status == status)
    return [serialize_procurement_quote(item, db) for item in query.order_by(ProcurementQuote.id.desc()).all()]


@app.get("/api/admin/procurement-rates/today")
def admin_procurement_rates_today(_: User = Depends(current_user)):
    rates, rates_date = fetch_daily_exchange_rates()
    return {"rates": rates, "rates_date": rates_date}


@app.get("/api/admin/operator-options")
def admin_operator_options(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return [
        {
            "id": item.id,
            "username": item.username,
            "label": item.nickname or item.username,
            "role": item.role,
            "is_active": item.is_active,
            "is_current": item.id == user.id,
        }
        for item in db.query(User).order_by(User.is_active.desc(), User.id.asc()).all()
    ]


@app.post("/api/admin/procurement-quotes", status_code=201)
def create_procurement_quote(data: ProcurementQuoteInput, db: Session = Depends(get_db), user: User = Depends(current_user)):
    quote = ProcurementQuote(quote_code=generate_procurement_code(db), access_password=generate_order_password())
    apply_procurement_quote(quote, data, user, db)
    quote.created_by_id = user.id
    quote.updated_by_id = user.id
    db.add(quote); db.commit()
    return serialize_procurement_quote(quote, db)


@app.get("/api/admin/procurement-quotes/{quote_id}")
def admin_procurement_quote(quote_id: int, db: Session = Depends(get_db), _: User = Depends(current_user)):
    quote = db.get(ProcurementQuote, quote_id)
    if not quote: raise HTTPException(404, "Procurement quote not found")
    return serialize_procurement_quote(quote, db)


@app.get("/api/admin/procurement-quotes/{quote_id}/export")
def export_admin_procurement_quote(quote_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    quote = db.get(ProcurementQuote, quote_id)
    if not quote:
        raise HTTPException(404, "Procurement quote not found")
    db.add(AdminActionLog(user_id=user.id, username=user.username, nickname=user.nickname or user.username, action=f"导出采购报价单 {quote.quote_code}", status=200, ok=True))
    db.commit()
    filename = f"{quote.quote_code}.xlsx"
    return StreamingResponse(
        procurement_excel(quote, db),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.put("/api/admin/procurement-quotes/{quote_id}")
def update_procurement_quote(quote_id: int, data: ProcurementQuoteInput, db: Session = Depends(get_db), user: User = Depends(current_user)):
    quote = db.get(ProcurementQuote, quote_id)
    if not quote: raise HTTPException(404, "Procurement quote not found")
    # Prevent an old admin editor from overwriting items a customer has just
    # submitted from the public mobile quotation page.
    if data.updated_at and quote.updated_at and data.updated_at != quote.updated_at.isoformat():
        raise HTTPException(409, "采购单已被客户更新，请刷新最新数据后再保存")
    apply_procurement_quote(quote, data, user, db)
    if not quote.created_by_id: quote.created_by_id = user.id
    db.commit()
    return serialize_procurement_quote(quote, db)


@app.post("/api/admin/procurement-quotes/{quote_id}/reset-password")
def reset_procurement_password(quote_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    quote = db.get(ProcurementQuote, quote_id)
    if not quote: raise HTTPException(404, "Procurement quote not found")
    quote.access_password = generate_order_password()
    quote.updated_by_id = user.id
    db.commit()
    return serialize_procurement_quote(quote, db)


@app.post("/api/admin/procurement-quotes/{quote_id}/refresh-rates")
def refresh_procurement_rates(quote_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    quote = db.get(ProcurementQuote, quote_id)
    if not quote: raise HTTPException(404, "Procurement quote not found")
    rates, rates_date = fetch_daily_exchange_rates()
    quote.exchange_rates = rates
    quote.rates_date = rates_date
    quote.updated_by_id = user.id
    db.commit()
    return serialize_procurement_quote(quote, db)


@app.post("/api/admin/procurement-quotes/{quote_id}/cancel", status_code=204)
def cancel_procurement_quote(quote_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    quote = db.get(ProcurementQuote, quote_id)
    if quote:
        quote.status = "cancelled"
        quote.updated_by_id = user.id
        db.commit()


@app.delete("/api/admin/procurement-quotes/{quote_id}", status_code=204)
def delete_procurement_quote(quote_id: int, db: Session = Depends(get_db), _: User = Depends(current_user)):
    quote = db.get(ProcurementQuote, quote_id)
    if not quote:
        raise HTTPException(404, "Procurement quote not found")
    if quote.status != "cancelled":
        raise HTTPException(409, "请先取消采购单，再进行永久删除")
    db.delete(quote)
    db.commit()


@app.get("/api/public/procurement-quotes/{code}/availability")
def public_procurement_availability(code: str, db: Session = Depends(get_db)):
    quote = db.query(ProcurementQuote).filter(ProcurementQuote.quote_code == code, ProcurementQuote.status.in_(["published", "customer_confirmed"])).first()
    if not quote: raise HTTPException(404, "Procurement quote not found")
    return {"available": True, "title": quote.title}


@app.post("/api/public/procurement-quotes/{code}/login")
def public_procurement_login(code: str, data: ProcurementPasswordInput, db: Session = Depends(get_db)):
    quote = db.query(ProcurementQuote).filter(ProcurementQuote.quote_code == code, ProcurementQuote.status.in_(["published", "customer_confirmed"])).first()
    if not quote or not secrets.compare_digest(quote.access_password, data.password or ""):
        raise HTTPException(403, "Invalid quote number or password")
    return {"access_token": procurement_access_token(quote), "expires_in_days": 30, "quote": serialize_procurement_quote(quote, public=True)}


@app.get("/api/public/procurement-quotes/{code}")
def public_procurement_quote(code: str, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    return serialize_procurement_quote(public_procurement_from_token(code, authorization, db), public=True)


@app.put("/api/public/procurement-quotes/{code}/expected-arrival")
def update_public_procurement_arrival(code: str, data: ProcurementArrivalInput, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    quote = public_procurement_from_token(code, authorization, db)
    local_value, timezone_name, china_time = procurement_arrival_in_china(data)
    quote.expected_arrival_local = local_value
    quote.customer_timezone = timezone_name
    quote.expected_arrival_china = china_time
    db.commit()
    return serialize_procurement_quote(quote, public=True)


def public_procurement_item(quote: ProcurementQuote, item_id: str) -> tuple[int, Dict[str, Any]]:
    for index, item in enumerate(quote.items or []):
        if str(item.get("id")) == item_id:
            return index, dict(item)
    raise HTTPException(404, "Item not found")


@app.post("/api/public/procurement-quotes/{code}/items", status_code=201)
def add_public_procurement_item(code: str, data: ProcurementPublicItemInput, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    quote = public_procurement_from_token(code, authorization, db)
    item = normalize_procurement_item({**data.model_dump(), "added_by": "customer", "decision": "pending", "unit_price_cny": 0})
    quote.items = [*(quote.items or []), item]
    if quote.status == "customer_confirmed": quote.status = "published"
    db.commit()
    return serialize_procurement_quote(quote, public=True)


@app.put("/api/public/procurement-quotes/{code}/items/{item_id}")
def update_public_procurement_item(code: str, item_id: str, data: ProcurementPublicItemInput, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    quote = public_procurement_from_token(code, authorization, db)
    index, existing = public_procurement_item(quote, item_id)
    if existing.get("decision") == "confirmed":
        raise HTTPException(409, "Confirmed item cannot be edited")
    updated = normalize_procurement_item({**existing, **data.model_dump(), "unit_price_cny": existing.get("unit_price_cny", 0), "admin_note": existing.get("admin_note", "")})
    items = list(quote.items or []); items[index] = updated; quote.items = items
    db.commit()
    return serialize_procurement_quote(quote, public=True)


@app.post("/api/public/procurement-quotes/{code}/items/{item_id}/decision")
def decide_public_procurement_item(code: str, item_id: str, data: ProcurementDecisionInput, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    quote = public_procurement_from_token(code, authorization, db)
    index, existing = public_procurement_item(quote, item_id)
    if data.decision not in {"pending", "confirmed"}:
        raise HTTPException(400, "Invalid item decision")
    if data.decision == "confirmed" and float(existing.get("unit_price_cny") or 0) <= 0:
        raise HTTPException(409, "This item has not been quoted yet")
    existing["decision"] = data.decision
    items = list(quote.items or []); items[index] = normalize_procurement_item(existing); quote.items = items
    quoted_items = [item for item in items if float(item.get("unit_price_cny") or 0) > 0]
    if quoted_items and len(quoted_items) == len(items) and all(item.get("decision") == "confirmed" for item in quoted_items):
        quote.status = "customer_confirmed"
    elif quote.status == "customer_confirmed":
        quote.status = "published"
    db.commit()
    return serialize_procurement_quote(quote, public=True)


@app.delete("/api/public/procurement-quotes/{code}/items/{item_id}", status_code=204)
def delete_public_procurement_item(code: str, item_id: str, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    quote = public_procurement_from_token(code, authorization, db)
    _, existing = public_procurement_item(quote, item_id)
    if existing.get("decision") == "confirmed":
        raise HTTPException(409, "Confirmed item cannot be deleted")
    quote.items = [item for item in (quote.items or []) if str(item.get("id")) != item_id]
    if quote.status == "customer_confirmed": quote.status = "published"
    db.commit()


@app.post("/api/public/procurement-quotes/{code}/upload/image")
async def upload_public_procurement_image(code: str, file: UploadFile = File(...), authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    public_procurement_from_token(code, authorization, db)
    return await store_upload(file, {".jpg", ".jpeg", ".png", ".webp"}, 5 * 1024 * 1024, "procurement-images", "Only jpg, jpeg, png and webp are allowed")


def register_simple_crud(path: str, model, schema, serializer):
    @app.get(path)
    def list_items(db: Session = Depends(get_db), _: User = Depends(current_user)):
        return [serialize_admin_item(x, serializer, db) for x in crud_list(model, db)]
    @app.post(path, status_code=201)
    def create_item(data: Dict[str, Any] = Body(...), db: Session = Depends(get_db), user: User = Depends(current_user)):
        data = schema.model_validate(normalize_admin_i18n_payload(data, model))
        item = model(**data.model_dump())
        if hasattr(item, "created_by_id"): item.created_by_id = user.id
        if hasattr(item, "updated_by_id"): item.updated_by_id = user.id
        db.add(item); db.commit(); return serialize_admin_item(item, serializer, db)
    @app.put(path + "/{item_id}")
    def update_item(item_id: int, data: Dict[str, Any] = Body(...), db: Session = Depends(get_db), user: User = Depends(current_user)):
        data = schema.model_validate(normalize_admin_i18n_payload(data, model))
        item = db.get(model, item_id)
        if not item: raise HTTPException(404, "Not found")
        for k, v in data.model_dump().items(): setattr(item, k, v)
        if hasattr(item, "created_by_id") and not item.created_by_id: item.created_by_id = user.id
        if hasattr(item, "updated_by_id"): item.updated_by_id = user.id
        db.commit(); return serialize_admin_item(item, serializer, db)
    @app.delete(path + "/{item_id}", status_code=204)
    def delete_item(item_id: int, db: Session = Depends(get_db), _: User = Depends(current_user)):
        item = db.get(model, item_id)
        if item: db.delete(item); db.commit()


register_simple_crud("/api/admin/articles", Article, ArticleInput, serialize_article)
register_simple_crud("/api/admin/categories", Category, CategoryInput, serialize_category)
register_simple_crud("/api/admin/tags", Tag, TagInput, serialize_tag)
register_simple_crud("/api/admin/banners", Banner, BannerInput, lambda b: {c.name: getattr(b, c.name) for c in b.__table__.columns})


@app.post("/api/admin/upload/image")
async def upload_image(file: UploadFile = File(...), _: User = Depends(current_user)):
    return await store_upload(file, {".jpg", ".jpeg", ".png", ".webp"}, 5 * 1024 * 1024, "images", "Only jpg, jpeg, png and webp are allowed")


@app.post("/api/admin/upload/video")
async def upload_video(file: UploadFile = File(...), _: User = Depends(current_user)):
    return await store_upload(file, {".mp4", ".webm", ".mov"}, 200 * 1024 * 1024, "videos", "Only mp4, webm and mov are allowed")


async def store_upload(file: UploadFile, allowed_exts: set[str], max_size: int, folder: str, ext_error: str):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in allowed_exts:
        raise HTTPException(400, ext_error)

    tmp_path = ""
    total_size = 0
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp_path = tmp.name
            while chunk := await file.read(1024 * 1024):
                total_size += len(chunk)
                if total_size > max_size:
                    raise HTTPException(413, f"{folder.capitalize()} exceeds {max_size // 1024 // 1024}MB")
                tmp.write(chunk)

        if STORAGE_BACKEND == "qiniu":
            if Auth is None or put_file is None:
                raise HTTPException(500, "Qiniu SDK is not installed")
            if not QINIU_ACCESS_KEY or not QINIU_SECRET_KEY or not QINIU_BUCKET or not QINIU_DOMAIN:
                raise HTTPException(500, "Qiniu storage is missing access key, secret key, bucket or domain")
            key_parts = [part for part in [QINIU_PREFIX, folder, f"{uuid.uuid4().hex}{ext}"] if part]
            key = "/".join(key_parts)
            token = Auth(QINIU_ACCESS_KEY, QINIU_SECRET_KEY).upload_token(QINIU_BUCKET, key, 3600)
            _, info = put_file(
                token,
                key,
                tmp_path,
                mime_type=file.content_type or "application/octet-stream",
                version="v2",
                bucket_name=QINIU_BUCKET,
                part_size=4 * 1024 * 1024,
            )
            status_code = getattr(info, "status_code", 500)
            if status_code not in {200, 201}:
                error_text = getattr(info, "text_body", None) or getattr(info, "error", None) or str(info)
                logger.error("Qiniu upload failed: status=%s key=%s size=%s error=%s", status_code, key, total_size, error_text)
                raise HTTPException(502, f"Upload to Qiniu failed: {status_code}")
            return {"url": f"{QINIU_DOMAIN}/{key}"}

        target = STORAGE_DIR / f"{uuid.uuid4().hex}{ext}"
        shutil.copyfile(tmp_path, target)
        return {"url": f"/storage/{target.name}"}
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


@app.get("/api/admin/settings")
def admin_settings(db: Session = Depends(get_db), _: User = Depends(current_user)):
    return {x.key: x.value for x in db.query(SiteSetting).all()}


@app.put("/api/admin/settings")
def update_settings(data: Dict[str, Any], db: Session = Depends(get_db), _: User = Depends(current_user)):
    for key, value in data.items():
        row = db.query(SiteSetting).filter(SiteSetting.key == key).first()
        if row: row.value = value
        else: db.add(SiteSetting(key=key, value=value))
    db.commit(); return data


@app.get("/api/admin/analytics/summary")
def analytics_summary(db: Session = Depends(get_db), _: User = Depends(current_user)):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    def unique_count(event_type: str, include_product: bool = False, include_page: bool = False):
        columns = [analytics_visitor_expr()]
        if include_product:
            columns.append(AnalyticsEvent.product_id)
        if include_page:
            columns.append(AnalyticsEvent.page_url)
        return db.query(*columns).filter(
            AnalyticsEvent.event_type == event_type,
            AnalyticsEvent.created_at >= today,
        ).group_by(*columns).count()
    return {
        "page_views": unique_count("page_view", include_page=True),
        "product_views": unique_count("product_view", include_product=True),
        "whatsapp_clicks": unique_count("whatsapp_click", include_product=True),
        "inquiry_submits": db.query(AnalyticsEvent).filter(AnalyticsEvent.event_type == "inquiry_submit", AnalyticsEvent.created_at >= today).count(),
        "unique_visitors": db.query(analytics_visitor_expr()).filter(AnalyticsEvent.created_at >= today).group_by(analytics_visitor_expr()).count(),
    }


@app.get("/api/admin/analytics/trend")
def analytics_trend(days: int = Query(7, ge=1, le=90), db: Session = Depends(get_db), _: User = Depends(current_user)):
    result = []
    for offset in reversed(range(days)):
        start = (datetime.utcnow() - timedelta(days=offset)).replace(hour=0, minute=0, second=0, microsecond=0); end = start + timedelta(days=1)
        page_views = db.query(analytics_visitor_expr(), AnalyticsEvent.page_url).filter(
            AnalyticsEvent.event_type == "page_view",
            AnalyticsEvent.created_at >= start,
            AnalyticsEvent.created_at < end,
        ).group_by(analytics_visitor_expr(), AnalyticsEvent.page_url).count()
        whatsapp_clicks = db.query(analytics_visitor_expr(), AnalyticsEvent.product_id).filter(
            AnalyticsEvent.event_type == "whatsapp_click",
            AnalyticsEvent.created_at >= start,
            AnalyticsEvent.created_at < end,
        ).group_by(analytics_visitor_expr(), AnalyticsEvent.product_id).count()
        product_views = db.query(analytics_visitor_expr(), AnalyticsEvent.product_id).filter(
            AnalyticsEvent.event_type == "product_view",
            AnalyticsEvent.created_at >= start,
            AnalyticsEvent.created_at < end,
        ).group_by(analytics_visitor_expr(), AnalyticsEvent.product_id).count()
        result.append({"date": start.date().isoformat(), "page_views": page_views, "product_views": product_views, "whatsapp_clicks": whatsapp_clicks})
    return result


@app.get("/api/admin/analytics/breakdown")
def analytics_breakdown(days: int = Query(30, ge=1, le=365), db: Session = Depends(get_db), _: User = Depends(current_user)):
    start = datetime.utcnow() - timedelta(days=days)

    def rows_to_items(rows, key_name: str):
        return [{key_name: key or "unknown", "count": int(count or 0)} for key, count in rows]

    language_rows = db.query(AnalyticsEvent.locale, func.count(AnalyticsEvent.id)).filter(
        AnalyticsEvent.created_at >= start,
        AnalyticsEvent.locale.isnot(None),
    ).group_by(AnalyticsEvent.locale).order_by(func.count(AnalyticsEvent.id).desc()).limit(10).all()

    # 来源渠道：优先 UTM 参数；无 UTM 时按 referrer 域名归类（google/bing=自然搜索，其余=外链），都没有则为直接访问
    def channel_for(utm_source: Optional[str], referrer: Optional[str]) -> str:
        if utm_source and utm_source.strip():
            return utm_source.strip()
        if referrer:
            try:
                domain = urlparse(referrer).hostname or ""
            except Exception:
                domain = ""
            domain = domain.lower().removeprefix("www.")
            if not domain:
                return "直接访问"
            if any(engine in domain for engine in ("google.", "bing.", "yahoo.", "duckduckgo.", "baidu.", "yandex.")):
                return f"{domain.split('.')[0]} / 自然搜索"
            return f"{domain} / 外链"
        return "直接访问"

    raw_source_rows = db.query(
        AnalyticsEvent.utm_source,
        AnalyticsEvent.referrer,
        func.count(AnalyticsEvent.id),
    ).filter(
        AnalyticsEvent.created_at >= start,
        AnalyticsEvent.event_type == "page_view",
    ).group_by(AnalyticsEvent.utm_source, AnalyticsEvent.referrer).all()
    source_counts: Dict[str, int] = {}
    for utm_source, referrer, count in raw_source_rows:
        channel = channel_for(utm_source, referrer)
        source_counts[channel] = source_counts.get(channel, 0) + int(count or 0)
    source_rows = sorted(source_counts.items(), key=lambda item: item[1], reverse=True)[:10]

    search_rows = db.query(AnalyticsEvent.search_keyword, func.count(AnalyticsEvent.id)).filter(
        AnalyticsEvent.created_at >= start,
        AnalyticsEvent.search_keyword.isnot(None),
        AnalyticsEvent.search_keyword != "",
    ).group_by(AnalyticsEvent.search_keyword).order_by(func.count(AnalyticsEvent.id).desc()).limit(10).all()

    unique_product_views = db.query(
        AnalyticsEvent.product_id.label("product_id"),
        func.date(AnalyticsEvent.created_at).label("view_date"),
        analytics_visitor_expr().label("visitor_key"),
    ).filter(
        AnalyticsEvent.created_at >= start,
        AnalyticsEvent.event_type == "product_view",
        AnalyticsEvent.product_id.is_not(None),
    ).group_by(
        AnalyticsEvent.product_id,
        func.date(AnalyticsEvent.created_at),
        analytics_visitor_expr(),
    ).subquery()

    product_rows = db.query(
        Product.id,
        Product.product_code,
        Product.title_zh,
        Product.title_en,
        Product.slug,
        func.count().label("views"),
    ).join(unique_product_views, unique_product_views.c.product_id == Product.id).group_by(Product.id).order_by(func.count().desc()).limit(10).all()

    category_rows = db.query(
        Category.id,
        Category.name_zh,
        Category.name_en,
        Category.slug,
        func.count().label("views"),
    ).join(Product, Product.category_id == Category.id).join(unique_product_views, unique_product_views.c.product_id == Product.id).group_by(Category.id).order_by(func.count().desc()).limit(10).all()

    return {
        "days": days,
        "languages": rows_to_items(language_rows, "locale"),
        "sources": rows_to_items(source_rows, "source"),
        "search_terms": rows_to_items(search_rows, "keyword"),
        "top_products": [{"id": item.id, "product_code": item.product_code, "title": item.title_zh or item.title_en, "slug": item.slug, "views": int(item.views or 0)} for item in product_rows],
        "top_categories": [{"id": item.id, "name": item.name_zh or item.name_en, "slug": item.slug, "views": int(item.views or 0)} for item in category_rows],
    }


@app.get("/api/admin/analytics/inquiries")
def inquiries(db: Session = Depends(get_db), _: User = Depends(current_user)):
    rows = db.query(AnalyticsEvent).filter(AnalyticsEvent.event_type.in_(["whatsapp_click", "inquiry_submit"])).order_by(AnalyticsEvent.created_at.desc()).limit(200).all()
    return [{"id": x.id, "event_type": x.event_type, "product_id": x.product_id, "items": x.inquiry_items, "locale": x.locale, "page_url": x.page_url, "created_at": x.created_at.isoformat()} for x in rows]


@app.get("/api/admin/records")
def admin_records(limit: int = Query(300, le=2000), db: Session = Depends(get_db), _: User = Depends(current_user)):
    rows = db.query(AdminActionLog).order_by(AdminActionLog.id.desc()).limit(limit).all()
    return [{"id": x.id, "user_id": x.user_id, "username": x.username, "nickname": x.nickname, "action": x.action, "detail": x.detail, "status": x.status, "ok": x.ok, "ip": x.ip, "created_at": (x.created_at.isoformat() + "Z") if x.created_at else None} for x in rows]


def seed():
    Base.metadata.create_all(engine)
    inspector = inspect(engine)
    product_columns = {column["name"] for column in inspector.get_columns("products")}
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    category_columns = {column["name"] for column in inspector.get_columns("categories")}
    tag_columns = {column["name"] for column in inspector.get_columns("tags")}
    banner_columns = {column["name"] for column in inspector.get_columns("banners")}
    order_columns = {column["name"] for column in inspector.get_columns("customer_orders")} if inspector.has_table("customer_orders") else set()
    procurement_columns = {column["name"] for column in inspector.get_columns("procurement_quotes")} if inspector.has_table("procurement_quotes") else set()
    with engine.begin() as connection:
        if "nickname" not in user_columns: connection.execute(text("ALTER TABLE users ADD COLUMN nickname VARCHAR(100)"))
        if "created_at" not in user_columns: connection.execute(text("ALTER TABLE users ADD COLUMN created_at TIMESTAMP"))
        if "updated_at" not in user_columns: connection.execute(text("ALTER TABLE users ADD COLUMN updated_at TIMESTAMP"))
        if "video_url" not in product_columns: connection.execute(text("ALTER TABLE products ADD COLUMN video_url TEXT"))
        if "is_free_shipping" not in product_columns: connection.execute(text("ALTER TABLE products ADD COLUMN is_free_shipping BOOLEAN DEFAULT 0"))
        if "published_at" not in product_columns: connection.execute(text("ALTER TABLE products ADD COLUMN published_at DATETIME"))
        if "product_code" not in product_columns: connection.execute(text("ALTER TABLE products ADD COLUMN product_code VARCHAR(100)"))
        if "create_request_id" not in product_columns: connection.execute(text("ALTER TABLE products ADD COLUMN create_request_id VARCHAR(100)"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_products_create_request_id ON products (create_request_id)"))
        if "stock_quantity" not in product_columns: connection.execute(text("ALTER TABLE products ADD COLUMN stock_quantity INTEGER DEFAULT 0"))
        if "color_variants" not in product_columns: connection.execute(text("ALTER TABLE products ADD COLUMN color_variants JSON DEFAULT '[]'"))
        if "detail_images" not in product_columns: connection.execute(text("ALTER TABLE products ADD COLUMN detail_images JSON DEFAULT '[]'"))
        if "source_platform" not in product_columns: connection.execute(text("ALTER TABLE products ADD COLUMN source_platform VARCHAR(100)"))
        if "source_url" not in product_columns: connection.execute(text("ALTER TABLE products ADD COLUMN source_url TEXT"))
        if "material_en" not in product_columns: connection.execute(text("ALTER TABLE products ADD COLUMN material_en VARCHAR(255)"))
        if "size_en" not in product_columns: connection.execute(text("ALTER TABLE products ADD COLUMN size_en VARCHAR(255)"))
        if "package_info_en" not in product_columns: connection.execute(text("ALTER TABLE products ADD COLUMN package_info_en VARCHAR(255)"))
        if "usage_scene_en" not in product_columns: connection.execute(text("ALTER TABLE products ADD COLUMN usage_scene_en VARCHAR(255)"))
        if "created_by_id" not in product_columns: connection.execute(text("ALTER TABLE products ADD COLUMN created_by_id INTEGER"))
        if "updated_by_id" not in product_columns: connection.execute(text("ALTER TABLE products ADD COLUMN updated_by_id INTEGER"))
        for table_name, table_columns in (("categories", category_columns), ("tags", tag_columns), ("banners", banner_columns)):
            if "created_at" not in table_columns: connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN created_at TIMESTAMP"))
            if "updated_at" not in table_columns: connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN updated_at TIMESTAMP"))
            if "created_by_id" not in table_columns: connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN created_by_id INTEGER"))
            if "updated_by_id" not in table_columns: connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN updated_by_id INTEGER"))
        if inspector.has_table("procurement_quotes"):
            procurement_additions = {
                "expected_arrival_local": "VARCHAR(50)",
                "customer_timezone": "VARCHAR(100)",
                "expected_arrival_china": "TIMESTAMP",
                "additional_expenses": "JSON DEFAULT '[]'",
                "owner_id": "INTEGER",
            }
            for column_name, column_type in procurement_additions.items():
                if column_name not in procurement_columns:
                    connection.execute(text(f"ALTER TABLE procurement_quotes ADD COLUMN {column_name} {column_type}"))
        if inspector.has_table("customer_orders"):
            order_additions = {
                "access_password": "VARCHAR(100)",
                "locale": "VARCHAR(20) DEFAULT 'en'",
                "status": "VARCHAR(50) DEFAULT 'pending_confirm'",
                "items": "JSON DEFAULT '[]'",
                "payment_method": "VARCHAR(100)",
                "is_paid": "BOOLEAN DEFAULT 0",
                "customer_name": "VARCHAR(255)",
                "customer_phone": "VARCHAR(100)",
                "customer_country": "VARCHAR(100)",
                "customer_province": "VARCHAR(100)",
                "customer_city": "VARCHAR(100)",
                "customer_district": "VARCHAR(100)",
                "customer_detail_address": "TEXT",
                "customer_address": "TEXT",
                "customer_note": "TEXT",
                "customer_confirmed": "BOOLEAN DEFAULT 0",
                "customer_confirmed_at": "TIMESTAMP",
                "product_cost": "FLOAT DEFAULT 0",
                "first_leg_cost": "FLOAT DEFAULT 0",
                "last_leg_cost": "FLOAT DEFAULT 0",
                "total_price": "FLOAT DEFAULT 0",
                "currency": "VARCHAR(20) DEFAULT 'CNY'",
                "first_logistics_company": "VARCHAR(255)",
                "first_tracking_no": "VARCHAR(255)",
                "first_logistics_note": "TEXT",
                "last_logistics_company": "VARCHAR(255)",
                "last_tracking_no": "VARCHAR(255)",
                "last_logistics_note": "TEXT",
                "admin_note": "TEXT",
                "created_at": "TIMESTAMP",
                "updated_at": "TIMESTAMP",
                "confirmed_at": "TIMESTAMP",
                "created_by_id": "INTEGER",
                "updated_by_id": "INTEGER",
            }
            for column_name, column_type in order_additions.items():
                if column_name not in order_columns:
                    connection.execute(text(f"ALTER TABLE customer_orders ADD COLUMN {column_name} {column_type}"))
    db = SessionLocal()
    try:
        if not db.query(User).first():
            admin_username = os.getenv("ADMIN_USERNAME", "").strip()
            admin_password = os.getenv("ADMIN_PASSWORD", "").strip()
            if admin_username and admin_password:
                db.add(User(username=admin_username, nickname=admin_username, password_hash=pwd_context.hash(admin_password), role="super_admin" if admin_username in SUPER_ADMIN_USERNAMES else "admin"))
        now = datetime.utcnow()
        for user in db.query(User).all():
            if not user.nickname: user.nickname = user.username
            if not user.created_at: user.created_at = now
            if not user.updated_at: user.updated_at = now
            user.role = "super_admin" if user.username in SUPER_ADMIN_USERNAMES else (user.role or "admin")
        settings = {"site_name": "cooolmake", "whatsapp_phone_number": "85200000000", "contact_email": "cooolmake001@gmail.com", "instagram_url": "https://instagram.com", "tiktok_url": "https://tiktok.com", "x_url": "https://x.com", "pinterest_url": "https://pinterest.com", "show_prices": True, "default_locale": "en"}
        for key, value in settings.items():
            if not db.query(SiteSetting).filter(SiteSetting.key == key).first():
                db.add(SiteSetting(key=key, value=value))
        site_name_setting = db.query(SiteSetting).filter(SiteSetting.key == "site_name").first()
        if site_name_setting and str(site_name_setting.value).strip().lower() == "plynook":
            site_name_setting.value = "cooolmake"
        contact_email_setting = db.query(SiteSetting).filter(SiteSetting.key == "contact_email").first()
        if contact_email_setting and str(contact_email_setting.value).strip().lower() == "plynook001@gmail.com":
            contact_email_setting.value = "cooolmake001@gmail.com"
        # Guides：首次启动时把 content/guides 下的 md 指南导入文章表（已存在的 slug 不覆盖，之后由后台管理）
        guides_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "content", "guides")
        if os.path.isdir(guides_dir):
            for file_name in sorted(os.listdir(guides_dir)):
                if not file_name.endswith(".md"): continue
                slug = file_name[:-3]
                if db.query(Article).filter(Article.slug == slug).first(): continue
                raw = open(os.path.join(guides_dir, file_name), encoding="utf-8").read()
                meta = {}
                body = raw
                front = re.match(r"^---\r?\n(.*?)\r?\n---\r?\n?(.*)$", raw, re.S)
                if front:
                    body = front.group(2)
                    for line in front.group(1).splitlines():
                        kv = re.match(r"^([A-Za-z_][\w-]*)\s*:\s*(.*)$", line.strip())
                        if kv: meta[kv.group(1)] = kv.group(2).strip().strip('"\'')
                published_at = datetime.strptime(meta.get("date", ""), "%Y-%m-%d") if meta.get("date") else datetime.utcnow()
                db.add(Article(
                    slug=slug, title=meta.get("title", slug), summary=meta.get("description") or None,
                    content=body.strip() or None, category=meta.get("category") or "Guides",
                    keywords=meta.get("keywords") or None, cover_image=meta.get("cover") or None,
                    is_published=True, published_at=published_at,
                ))
        if os.getenv("ENABLE_DEMO_SEED", "").lower() in {"1", "true", "yes"} and not db.query(Category).first():
            cats = [Category(slug="art-toys", name_en="Art Toys", name_ja="アートトイ", name_ko="아트 토이", name_zh="潮玩摆件", description_en="Collectible characters with a playful point of view."), Category(slug="home-decor", name_en="Home Decor", name_ja="ホームデコ", name_ko="홈 데코", name_zh="家居装饰", description_en="Small objects that make a room feel yours."), Category(slug="desk-accessories", name_en="Desk Accessories", name_ja="デスク用品", name_ko="데스크 용품", name_zh="桌面用品", description_en="Tiny upgrades for better desk days."), Category(slug="gifts", name_en="Gifts", name_ja="ギフト", name_ko="선물", name_zh="礼品", description_en="Unexpected gifts for delightful people.")]
            db.add_all(cats); db.flush()
            tags = [Tag(slug="cute", name_en="Cute", name_ja="かわいい", name_ko="귀여운", name_zh="可爱", color="#ff6b52"), Tag(slug="limited", name_en="Limited", name_ja="限定", name_ko="한정", name_zh="限量", color="#7c5cff"), Tag(slug="new", name_en="New", name_ja="新作", name_ko="신상품", name_zh="新品", color="#23a87d")]
            db.add_all(tags); db.flush()
            products = [
                Product(sku="TOY-0001", slug="astronaut-rabbit-figure", status="published", category_id=cats[0].id, main_image="https://images.unsplash.com/photo-1559454403-b8fb88521f11?auto=format&fit=crop&w=1000&q=85", gallery_images=[], price=129, show_price=True, is_free_shipping=True, title_en="Astronaut Rabbit Figure", title_ja="宇宙飛行士ラビット", title_ko="우주비행사 토끼", title_zh="宇航员兔子摆件", short_description_en="A tiny explorer for shelves and desks.", description_en="A playful collectible with a smooth matte finish, made to bring character to quiet corners.", features_en=["Original character design", "Gift-ready packaging", "Matte finish"], material="Resin", size="18 × 10 × 9 cm", color="Ivory / orange", package_info="Gift box", usage_scene="Desk, shelf, entryway", stock_status="in_stock", is_featured=True, is_new=True, is_best_seller=True, sort_order=1, tags=[tags[0], tags[2]]),
                Product(sku="HOME-0008", slug="bear-storage-tray", status="published", category_id=cats[1].id, main_image="https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=1000&q=85", gallery_images=[], price=89, show_price=True, is_free_shipping=False, title_en="Bear Storage Tray", title_ja="ベア収納トレー", title_ko="베어 수납 트레이", title_zh="小熊收纳托盘", short_description_en="A cheerful landing spot for everyday things.", description_en="Keep keys, jewelry and tiny desk essentials together without losing the fun.", features_en=["Easy-clean surface", "Weighted base", "Multi-purpose"], material="Ceramic", size="16 × 14 cm", color="Sand", stock_status="limited_stock", is_featured=True, is_best_seller=True, sort_order=2, tags=[tags[0]]),
                Product(sku="DESK-0012", slug="cloud-desk-lamp", status="published", category_id=cats[2].id, main_image="https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1000&q=85", gallery_images=[], price=169, show_price=True, is_free_shipping=True, title_en="Cloud Desk Lamp", title_ja="クラウドデスクランプ", title_ko="클라우드 데스크 램프", title_zh="云朵桌面灯", short_description_en="Soft light, softer mood.", description_en="A compact ambient lamp for late-night reading and slow evenings.", features_en=["Warm LED light", "USB-C powered", "Dimmable"], material="ABS / silicone", size="22 × 15 cm", color="Milk white", stock_status="in_stock", is_new=True, sort_order=3, tags=[tags[2]])]
            db.add_all(products)
            db.add(Banner(title_en="Objects with a little more life.", title_ja="暮らしに、少しの遊び心を。", title_ko="일상에 작은 즐거움을.", title_zh="让日常，多一点有趣。", subtitle_en="Playful art toys and home objects, selected for curious spaces.", image="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1800&q=90", link_url="/products", button_text_en="Explore the collection"))
        for product in db.query(Product).filter(Product.status == "published", Product.published_at.is_(None)).all():
            product.published_at = product.created_at or datetime.utcnow()
        for product in db.query(Product).all():
            if not product.product_code: product.product_code = f"CLM-{product.id:06d}"
            if not product.source_platform: product.source_platform = "1688"
        price_setting = db.query(SiteSetting).filter(SiteSetting.key == "show_prices").first()
        if price_setting: price_setting.value = True
        db.commit()
    finally: db.close()


seed()


def _referenced_media_urls(db: Session) -> set[str]:
    """Collect every /storage/ URL currently referenced by any entity."""
    urls: set[str] = set()

    def collect(value: Any):
        if isinstance(value, str):
            if value.startswith("/storage/"):
                urls.add(value.split("?")[0])
        elif isinstance(value, list):
            for item in value:
                collect(item)
        elif isinstance(value, dict):
            for item in value.values():
                collect(item)

    for product in db.query(Product).all():
        collect([product.main_image, product.video_url, product.gallery_images, product.detail_images, product.color_variants])
    for banner in db.query(Banner).all():
        collect(banner.image)
    for category in db.query(Category).all():
        collect(category.banner_image)
    for quote in db.query(ProcurementQuote).all():
        collect(quote.items)
    for setting in db.query(SiteSetting).all():
        collect(setting.value)
    return urls


def cleanup_orphan_media(grace_hours: Optional[int] = None) -> list[str]:
    """Delete uploaded media that no entity references and that is older than the grace window.

    Covers uploads that were never attached to a saved product/quote/banner
    (e.g. the admin uploaded then abandoned the edit) as well as media that a
    later save removed from its entity."""
    grace = int(os.getenv("ORPHAN_GRACE_HOURS", "24")) if grace_hours is None else grace_hours
    db = SessionLocal()
    try:
        referenced = _referenced_media_urls(db)
    finally:
        db.close()
    removed: list[str] = []
    for file_path in STORAGE_DIR.iterdir():
        if not file_path.is_file() or file_path.suffix.lower() not in MEDIA_EXTENSIONS:
            continue
        if f"/storage/{file_path.name}" in referenced:
            continue
        if time.time() - file_path.stat().st_mtime < grace * 3600:
            continue
        try:
            file_path.unlink()
            removed.append(f"/storage/{file_path.name}")
        except OSError:
            continue
    if removed:
        logging.getLogger("uvicorn.error").info("orphan media cleanup removed %d file(s): %s", len(removed), ", ".join(removed))
    return removed


def _orphan_cleanup_loop():
    while True:
        try:
            cleanup_orphan_media()
        except Exception:
            logging.getLogger("uvicorn.error").exception("orphan media cleanup failed")
        threading.Event().wait(6 * 3600)

threading.Thread(target=_orphan_cleanup_loop, daemon=True, name="orphan-media-cleanup").start()
