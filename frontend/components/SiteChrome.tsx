"use client";

import Link from "next/link";
import { Heart, Languages, Mail, Menu, MessageCircle, Moon, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
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
    <Link onClick={() => setOpen(false)} href={`/${locale}/about`}>{m.about}</Link>
    <Link onClick={() => setOpen(false)} href={`/${locale}/contact`}>{m.contact}</Link>
  </>;

  return <header className="site-header">
    <div className="service-bar">
      <span>Independent objects, thoughtfully selected</span>
      <span>Worldwide delivery · Personal sourcing</span>
    </div>
    <nav className="nav">
      <Link className="brand-logo brand-slot" href={`/${locale}`} aria-label="Home">
        <span className="brand-slot-empty" aria-hidden="true" />
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
          <span>{count > 0 ? String(count).padStart(2, "0") : "00"}</span>
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

  const email = String(settings.contact_email || "plynook001@gmail.com");
  const socialLinks = [
    ["Instagram", externalUrl(settings.instagram_url)],
    ["TikTok", externalUrl(settings.tiktok_url)],
    ["X", externalUrl(settings.x_url)],
    ["Pinterest", externalUrl(settings.pinterest_url)],
  ].filter(([, url]) => url);

  return <footer className="footer">
    <div className="container footer-intro">
      <Link className="brand-logo brand-slot footer-brand-slot" href={`/${locale}`} aria-label="Home">
        <span className="brand-slot-empty" aria-hidden="true" />
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
      <span>© {new Date().getFullYear()} Plynook</span>
      <span>Curated with intention · Shipped worldwide</span>
      <span>Privacy · Terms</span>
    </div>
  </footer>;
}

export function MobileWhatsApp() {
  const phone = useWhatsAppPhone();
  return <a href={`https://wa.me/${phone}`} className="mobile-whatsapp" aria-label="WhatsApp"><MessageCircle /></a>;
}
