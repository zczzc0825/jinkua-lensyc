"use client";

import Link from "next/link";
import { Heart, Languages, Mail, Menu, MessageCircle, Moon, Sun, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Swiper from "swiper";
import { Autoplay, Navigation } from "swiper/modules";
import "swiper/css";
import { Locale } from "@/lib/types";
import { locales, t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useWishlist } from "./WishlistProvider";
import { useWhatsAppPhone } from "./SiteSettingsProvider";
import { usePathname } from "next/navigation";

function externalUrl(value: unknown) {
  if (typeof value !== "string") return "";
  const url = value.trim();
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

const serviceMessages = [
  "Independent objects, thoughtfully selected",
  "Worldwide delivery · Personal sourcing",
];

const chevronLeftPath = "M14.0962 16.7175C13.901 16.9128 13.5844 16.9128 13.3891 16.7175L9.14648 12.4749C8.95122 12.2796 8.95122 11.963 9.14648 11.7678L13.3891 7.52512C13.5844 7.32986 13.901 7.32986 14.0962 7.52512C14.2915 7.72038 14.2915 8.03696 14.0962 8.23222L10.2071 12.1213L14.0962 16.0104C14.2915 16.2057 14.2915 16.5222 14.0962 16.7175Z";
const chevronRightPath = "M10.1464 7.52512C10.3417 7.32986 10.6583 7.32986 10.8536 7.52512L15.0962 11.7678C15.2915 11.963 15.2915 12.2796 15.0962 12.4749L10.8536 16.7175C10.6583 16.9128 10.3417 16.9128 10.1464 16.7175C9.95118 16.5222 9.95118 16.2057 10.1464 16.0104L14.0355 12.1213L10.1464 8.23223C9.95118 8.03697 9.95118 7.72039 10.1464 7.52512Z";

function ServiceBar() {
  const swiperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = swiperRef.current;
    if (!el) return;
    const swiper = new Swiper(el, {
      modules: [Autoplay, Navigation],
      loop: true,
      slidesPerView: 1,
      speed: 300,
      autoplay: { delay: 5000, disableOnInteraction: false },
      navigation: {
        prevEl: el.querySelector<HTMLElement>(".swiper-prev-button"),
        nextEl: el.querySelector<HTMLElement>(".swiper-next-button"),
      },
    });
    return () => swiper.destroy(true, true);
  }, []);

  return <div className="service-bar swiper" ref={swiperRef}>
    <div className="swiper-wrapper">
      {serviceMessages.map(message => (
        <div className="swiper-slide service-bar-slide" key={message}>
          <p className="service-bar-text">{message}</p>
        </div>
      ))}
    </div>
    <button className="swiper-prev-button" type="button">
      <svg className="fill-current" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path clipRule="evenodd" d={chevronLeftPath} fill="currentColor" fillRule="evenodd" />
      </svg>
    </button>
    <button className="swiper-next-button" type="button">
      <svg className="fill-current" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path clipRule="evenodd" d={chevronRightPath} fill="currentColor" fillRule="evenodd" />
      </svg>
    </button>
  </div>;
}

export function Header({ locale }: { locale: Locale }) {
  const m = t(locale);
  const { count } = useWishlist();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem("plynook_theme") as "light" | "dark" | null;
    const next = saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("plynook_theme", next);
    document.documentElement.dataset.theme = next;
  };
  const switchLocale = (nextLocale: string) => path.replace(/^\/(en|ja|ko|zh)/, `/${nextLocale}`);
  const menu = <>
    <Link onClick={() => setOpen(false)} href={`/${locale}`}>{m.home}</Link>
    <Link onClick={() => setOpen(false)} href={`/${locale}/products`}>{m.shop}</Link>
    <Link onClick={() => setOpen(false)} href={`/${locale}/products?collection=new&sort=newest`}>{m.newArrivals}</Link>
    <Link onClick={() => setOpen(false)} href="/guides">{m.guides}</Link>
    <Link onClick={() => setOpen(false)} href={`/${locale}/about`}>{m.about}</Link>
    <Link onClick={() => setOpen(false)} href={`/${locale}/contact`}>{m.contact}</Link>
  </>;

  return <header className="site-header">
    <ServiceBar />
    <nav className="nav">
      <Link className="brand-logo brand-slot" href={`/${locale}`} aria-label="cooolmake home">
        <img className="brand-logo-light" src="/brand/logo_black.png" alt="" aria-hidden="true" />
        <img className="brand-logo-dark" src="/brand/logo_w.png" alt="" aria-hidden="true" />
      </Link>
      <div className="nav-links">{menu}</div>
      <div className="nav-actions">
        <label className="pill btn-soft language-control">
          <Languages size={15} />
          <span className="language-label">
            <select aria-label="Language" value={locale} onChange={event => location.href = switchLocale(event.target.value)}>
              {locales.map(item => <option value={item} key={item}>{item.toUpperCase()}</option>)}
            </select>
          </span>
        </label>
        <button className="pill btn-soft theme-toggle" type="button" aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"} onClick={toggleTheme}>
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <Link className="pill wishlist-link" href={`/${locale}/wishlist`} aria-label={m.inquiry}>
          <Heart size={16} />
          <span className="wishlist-count">{count > 0 ? String(count).padStart(2, "0") : "00"}</span>
        </Link>
        <button className="pill btn-soft menu-button" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
      {open && <div className="mobile-menu">{menu}</div>}
    </nav>
  </header>;
}

export function Footer({ locale }: { locale: Locale }) {
  const m = t(locale);
  const [settings, setSettings] = useState<Record<string, unknown>>({});

  useEffect(() => {
    api.settings().then(setSettings).catch(() => {});
  }, []);

  const email = String(settings.contact_email || "cooolmake001@gmail.com");
  const socialLinks = [
    ["Instagram", externalUrl(settings.instagram_url)],
    ["TikTok", externalUrl(settings.tiktok_url)],
    ["X", externalUrl(settings.x_url)],
    ["Pinterest", externalUrl(settings.pinterest_url)],
  ].filter(([, url]) => url);

  return <footer className="footer">
    <div className="container footer-intro">
      <Link className="brand-logo brand-slot footer-brand-slot" href={`/${locale}`} aria-label="cooolmake home">
        <img className="brand-logo-light" src="/brand/logo_black.png" alt="" aria-hidden="true" />
        <img className="brand-logo-dark" src="/brand/logo_w.png" alt="" aria-hidden="true" />
      </Link>
      <h2>Objects that make a room feel <em>lived in.</em></h2>
    </div>
    <div className="container footer-grid">
      <div className="footer-note">
        <span className="eyebrow">Independent edit</span>
        <p>Art toys, expressive homeware and useful curiosities selected for individual spaces.</p>
      </div>
      <div>
        <strong>Explore</strong>
        <Link href={`/${locale}/products`}>{m.shop}</Link>
        <Link href="/guides">Guides</Link>
        <Link href={`/${locale}/about`}>{m.about}</Link>
        <Link href={`/${locale}/contact`}>{m.contact}</Link>
      </div>
      <div>
        <strong>Follow</strong>
        {socialLinks.map(([label, url]) => <a key={label as string} href={url as string} target="_blank" rel="noreferrer">{label as string}</a>)}
      </div>
      <div className="footer-contact">
        <strong>Enquiries</strong>
        <a className="footer-email" href={`mailto:${email}`} aria-label={`Email ${email}`}>
          <Mail size={16} />
          <span>{email}</span>
        </a>
      </div>
    </div>
    <div className="container footer-bottom">
      <span>© {new Date().getFullYear()} cooolmake</span>
      <span>Curated with intention · Shipped worldwide</span>
      <span>Privacy · Terms</span>
    </div>
  </footer>;
}

export function MobileWhatsApp() {
  const phone = useWhatsAppPhone();
  return <a href={`https://wa.me/${phone}`} className="mobile-whatsapp" aria-label="WhatsApp"><MessageCircle /></a>;
}
