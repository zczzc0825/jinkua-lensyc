"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ColorVariant, Locale } from "@/lib/types";

export function ProductMedia({ image, galleryImages = [], video, variants, locale }: { image?: string; galleryImages?: string[]; video?: string; variants: ColorVariant[]; locale: Locale }) {
  const [selected, setSelected] = useState<ColorVariant | null>(variants[0] || null);
  const uniqueImages = (items: Array<string | undefined>) => Array.from(new Set(items.filter((item): item is string => Boolean(item))));
  const baseImages = uniqueImages([image, ...galleryImages]);
  const selectedImage = selected?.image || baseImages[0] || "/placeholder.svg";
  const images = selected?.image ? uniqueImages([selected.image, ...baseImages]) : baseImages;
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const activeImage = images[activeIndex] || selectedImage;
  const videoPoster = image || baseImages[0] || "/placeholder.svg";
  const labels = {
    zh: { color: "颜色", available: "Availability: Ask us on WhatsApp" },
    en: { color: "Color", available: "Availability: Ask us on WhatsApp" },
    ja: { color: "カラー", available: "Availability: Ask us on WhatsApp" },
    ko: { color: "색상", available: "Availability: Ask us on WhatsApp" },
  }[locale];
  const chooseVariant = (variant: ColorVariant) => {
    setSelected(variant);
    setActiveIndex(0);
  };
  const move = (direction: -1 | 1) => setActiveIndex(index => (index + direction + images.length) % images.length);
  useEffect(() => {
    if (paused || images.length <= 1) return;
    const timer = window.setInterval(() => setActiveIndex(index => (index + 1) % images.length), 3500);
    return () => window.clearInterval(timer);
  }, [images.length, paused]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("plynook:variant-select", { detail: selected }));
  }, [selected]);
  return <div className="product-media">
    <div className="product-carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="carousel-track" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
        {images.map((item, index) => <div className="carousel-slide" key={`${item}-${index}`}><img className="gallery-main" src={item} alt={selected?.name || "Product"} /></div>)}
      </div>
      {images.length > 1 && <>
        <button type="button" className="carousel-button carousel-prev" onClick={() => move(-1)} aria-label="Previous image"><ChevronLeft size={22} /></button>
        <button type="button" className="carousel-button carousel-next" onClick={() => move(1)} aria-label="Next image"><ChevronRight size={22} /></button>
      </>}
      {images.length > 1 && <div className="carousel-counter">{activeIndex + 1} / {images.length}</div>}
    </div>
    {images.length > 1 && <div className="carousel-thumbs">{images.map((item, index) => <button type="button" key={`${item}-${index}`} className={index === activeIndex ? "active" : ""} onClick={() => setActiveIndex(index)}><img src={item} alt="" /></button>)}</div>}
    {variants.length > 0 && <div className="color-picker"><div className="color-picker-title"><strong>{labels.color}: {selected?.name}</strong>{selected && selected.stock_quantity > 0 && <span>{labels.available}</span>}</div><div className="color-options">{variants.map((variant, index) => <button type="button" key={`${variant.name}-${index}`} className={`color-option ${selected === variant ? "active" : ""}`} onClick={() => chooseVariant(variant)} aria-label={variant.name} title={variant.name}><span style={{ background: variant.hex || "#ddd" }} />{variant.name}</button>)}</div></div>}
    {video && <div className="product-video"><video controls controlsList="nodownload noplaybackrate" disablePictureInPicture playsInline preload="metadata" poster={videoPoster} onContextMenu={event => event.preventDefault()}><source src={video} /></video></div>}
  </div>;
}
