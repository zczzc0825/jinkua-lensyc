"use client";

import Link from "next/link";
import { Heart, Truck } from "lucide-react";
import { api, sessionId } from "@/lib/api";
import { t } from "@/lib/i18n";
import { approximatePrice, pricePrefix, shippingText } from "@/lib/price";
import { Locale, Product } from "@/lib/types";
import { useWishlist } from "./WishlistProvider";

export function ProductCard({ product, locale }: { product: Product; locale: Locale }) {
  const m = t(locale);
  const { items, add, remove } = useWishlist();
  const saved = items.some(item => item.product.id === product.id);
  const variantPrices = (product.color_variants || []).map(variant => variant.price).filter((price): price is number => price != null);
  const price = product.price != null ? product.price : variantPrices.length ? Math.min(...variantPrices) : null;
  const toggleSaved = () => {
    api.event({ session_id: sessionId(), event_type: saved ? "wishlist_remove" : "wishlist_add", product_id: product.id, locale, page_url: location.href }).catch(() => {});
    if (saved) remove(product.id);
    else add(product);
  };

  return <article className="product-card">
    <div className="card-media">
      <Link href={`/${locale}/product/${product.slug}`}>
        <div className="product-image">
          <img src={product.main_image || "/placeholder.svg"} alt={product.title} loading="lazy" />
        </div>
      </Link>
      <button type="button" className="card-wish" aria-pressed={saved} aria-label={saved ? m.remove : m.add} title={saved ? m.remove : m.add} onClick={toggleSaved}>
        <Heart size={15} />
      </button>
    </div>
    <div className="product-info">
      <Link href={`/${locale}/product/${product.slug}`}><h3>{product.title}</h3></Link>
      {price != null && <div className="price-row">
        <strong>{pricePrefix(locale)} {approximatePrice(price, locale)}</strong>
        <span className={product.is_free_shipping ? "shipping-free" : "shipping-note"}><Truck size={13} />{shippingText(locale, product.is_free_shipping)}</span>
      </div>}
    </div>
  </article>;
}
