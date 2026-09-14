"use client";

import Link from "next/link";
import { MessageCircle, Minus, Plus, Trash2, Truck } from "lucide-react";
import { api, sessionId } from "@/lib/api";
import { t } from "@/lib/i18n";
import { approximatePrice, pricePrefix, shippingText } from "@/lib/price";
import { Locale } from "@/lib/types";
import { useWhatsAppPhone } from "./SiteSettingsProvider";
import { useWishlist } from "./WishlistProvider";

export function WishlistPage({ locale }: { locale: Locale }) {
  const m = t(locale);
  const { items, remove, setQuantity } = useWishlist();
  const phone = useWhatsAppPhone();

  const submit = async () => {
    const inquiry = items.map(({ product, quantity }) => ({
      product_id: product.id,
      product_code: product.product_code,
      sku: product.sku,
      title: product.title,
      quantity,
      approximate_price: product.show_price && product.price != null
        ? `${pricePrefix(locale)} ${approximatePrice(product.price, locale)}`
        : undefined,
      is_free_shipping: product.is_free_shipping,
    }));
    await api.event({ session_id: sessionId(), event_type: "inquiry_submit", locale, page_url: location.href, inquiry_items: inquiry }).catch(() => {});

    const list = items.map(({ product, quantity }, index) => {
      const price = product.show_price && product.price != null
        ? `\n${pricePrefix(locale)} ${approximatePrice(product.price, locale)} · ${shippingText(locale, product.is_free_shipping)}`
        : "";
      return `${index + 1}. ${product.title}\nProduct ID: ${product.product_code}\nSKU: ${product.sku}\nQty: ${quantity}${price}`;
    }).join("\n\n");
    open(`https://wa.me/${phone}?text=${encodeURIComponent(`Hi, I want to ask about these products:\n\n${list}\n\nPlease send me the total price, shipping cost, and delivery time.`)}`, "_blank");
  };

  if (items.length === 0) return <div className="empty"><h2>{m.empty}</h2><Link className="btn btn-primary" href={`/${locale}/products`}>{m.continue}</Link></div>;

  return <>
    <div>{items.map(({ product, quantity }) => <div className="inquiry-row" key={product.id}>
      <img src={product.main_image} alt="" />
      <div>
        <strong>{product.title}</strong>
        <div className="muted">{product.sku}</div>
        {product.show_price && product.price != null && <div className="inquiry-price">
          <strong>{pricePrefix(locale)} {approximatePrice(product.price, locale)}</strong>
          <span><Truck size={14} />{shippingText(locale, product.is_free_shipping)}</span>
        </div>}
      </div>
      <div className="qty" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button className="btn btn-soft" onClick={() => setQuantity(product.id, quantity - 1)}><Minus size={13} /></button>
        <strong>{quantity}</strong>
        <button className="btn btn-soft" onClick={() => setQuantity(product.id, quantity + 1)}><Plus size={13} /></button>
      </div>
      <button className="danger" onClick={() => remove(product.id)} aria-label={m.remove}><Trash2 /></button>
    </div>)}</div>
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 25 }}>
      <button className="btn btn-accent" onClick={submit}><MessageCircle />{m.send}</button>
    </div>
  </>;
}
