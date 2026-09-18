"use client";

import { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { approximatePrice, pricePrefix, shippingText } from "@/lib/price";
import { Locale, Product } from "@/lib/types";

export function ProductPriceCard({ product, locale }: { product: Product; locale: Locale }) {
  const [variantPrice, setVariantPrice] = useState<number | null>(product.color_variants?.[0]?.price ?? null);
  useEffect(() => {
    const onSelect = (event: Event) => {
      const detail = (event as CustomEvent).detail as { price?: number | null } | null;
      setVariantPrice(detail?.price ?? null);
    };
    window.addEventListener("plynook:variant-select", onSelect);
    return () => window.removeEventListener("plynook:variant-select", onSelect);
  }, []);
  const price = variantPrice != null ? variantPrice : product.price;
  return <div className="detail-price">
    {price != null && <strong>{pricePrefix(locale)} {approximatePrice(price, locale)}</strong>}
    <span className={product.is_free_shipping ? "shipping-free" : "shipping-note"}><Truck size={16} />{shippingText(locale, product.is_free_shipping)}</span>
  </div>;
}
