"use client";

import Link from "next/link";
import { ArrowUpRight, MessageCircle, Truck } from "lucide-react";
import { api, sessionId } from "@/lib/api";
import { t } from "@/lib/i18n";
import { approximatePrice, pricePrefix, shippingText } from "@/lib/price";
import { Locale, Product } from "@/lib/types";
import { useWhatsAppPhone } from "./SiteSettingsProvider";

export function ProductCard({ product, locale }: { product: Product; locale: Locale }) {
  const m = t(locale);
  const phone = useWhatsAppPhone();
  const variantPrices = (product.color_variants || []).map(variant => variant.price).filter((price): price is number => price != null);
  const price = product.price != null ? product.price : variantPrices.length ? Math.min(...variantPrices) : null;
  const ask = async () => {
    await api.event({ session_id: sessionId(), event_type: "whatsapp_click", product_id: product.id, locale, page_url: location.href }).catch(() => {});
    const text = `Hi, I'm interested in this product:\n\nProduct ID: ${product.product_code}\nProduct: ${product.title}\nSKU: ${product.sku}\nLink: ${location.origin}/${locale}/product/${product.slug}\n\nCould you please send me the price and shipping details?`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  return <article className="product-card">
    <Link href={`/${locale}/product/${product.slug}`}>
      <div className="product-image">
        <img src={product.main_image || "/placeholder.svg"} alt={product.title} loading="lazy" />
        <div className="badges">{product.is_new && <span className="badge">NEW</span>}{product.is_best_seller && <span className="badge">POPULAR</span>}</div>
      </div>
    </Link>
    <div className="product-info">
      <div className="product-card-meta"><span>{product.category?.name || "Plynook edit"}</span><span>{product.product_code}</span></div>
      <Link href={`/${locale}/product/${product.slug}`}><h3>{product.title}</h3></Link>
      <p>{product.short_description}</p>
      {price != null && <div className="price-row">
        <strong>{pricePrefix(locale)} {approximatePrice(price, locale)}</strong>
        <span className={product.is_free_shipping ? "shipping-free" : "shipping-note"}><Truck size={13} />{shippingText(locale, product.is_free_shipping)}</span>
      </div>}
      <div className="product-actions product-actions-single">
        <button className="btn btn-primary" onClick={ask} aria-label="Ask on WhatsApp"><MessageCircle size={14} /><span>Enquire</span><ArrowUpRight className="product-action-arrow" size={14} /></button>
      </div>
    </div>
  </article>;
}
