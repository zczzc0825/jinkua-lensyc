"use client";

import { useEffect, useState } from "react";
import { Copy, Facebook, MessageCircle, Share2 } from "lucide-react";
import { api, sessionId } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Locale, Product } from "@/lib/types";
import { useWhatsAppPhone } from "./SiteSettingsProvider";
import { copyToClipboard } from "@/lib/secure";

export function ProductDetailActions({ product, locale }: { product: Product; locale: Locale }) {
  const m = t(locale);
  const phone = useWhatsAppPhone();
  const [shareNote, setShareNote] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const shareText = {
    zh: { label: "分享", copy: "复制链接", copied: "链接已复制", failed: "复制失败，请手动复制链接", whatsapp: "WhatsApp", facebook: "Facebook" },
    en: { label: "Share", copy: "Copy link", copied: "Link copied", failed: "Copy failed, please copy the link manually", whatsapp: "WhatsApp", facebook: "Facebook" },
    ja: { label: "共有", copy: "リンクをコピー", copied: "リンクをコピーしました", failed: "コピーできませんでした", whatsapp: "WhatsApp", facebook: "Facebook" },
    ko: { label: "공유", copy: "링크 복사", copied: "링크가 복사되었습니다", failed: "복사하지 못했습니다", whatsapp: "WhatsApp", facebook: "Facebook" },
  }[locale];

  useEffect(() => {
    const key = `plynook_product_view_${product.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    api.event({
      session_id: sessionId(),
      event_type: "product_view",
      product_id: product.id,
      category_id: product.category_id,
      locale,
      page_url: location.href,
      referrer: document.referrer,
    }).catch(() => sessionStorage.removeItem(key));
  }, [product.id, product.category_id, locale]);

  const [pageUrl, setPageUrl] = useState("");
  useEffect(() => { setPageUrl(location.href); }, []);
  const askHref = `https://wa.me/${phone}?text=${encodeURIComponent(`Hi, I'm interested in this product:\n\nProduct ID: ${product.product_code}\nProduct: ${product.title}\nSKU: ${product.sku}\nLink: ${pageUrl}\n\nCould you please send me the price and shipping details?`)}`;
  const copyLink = async () => {
    if (!(await copyToClipboard(location.href))) throw new Error("copy failed");
  };
  const share = async () => {
    try {
      await copyLink();
      setShareNote(shareText.copied);
    } catch {
      setShareNote(shareText.failed);
    }
    setShareOpen(false);
    window.setTimeout(() => setShareNote(""), 2200);
  };
  const openShare = (target: "x" | "whatsapp" | "facebook") => {
    const url = encodeURIComponent(location.href);
    const text = encodeURIComponent(`${product.title} · cooolmake`);
    const links = {
      x: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    };
    window.open(links[target], "_blank", "noopener,noreferrer");
    setShareOpen(false);
  };

  return <div className="detail-actions">
    <a className="btn btn-accent" href={askHref} target="_blank" rel="noopener noreferrer" onClick={() => { api.event({ session_id: sessionId(), event_type: "whatsapp_click", product_id: product.id, locale, page_url: pageUrl }).catch(() => {}); }}><MessageCircle size={18} />{m.ask}</a>
    <div className="share-wrap">
      <button className="btn btn-soft share-action" onClick={() => setShareOpen(open => !open)} aria-label={shareText.label} aria-expanded={shareOpen}><Share2 size={18} />{shareText.label}</button>
      {shareOpen && <div className="share-menu">
        <button type="button" onClick={share}><Copy size={16} />{shareText.copy}</button>
        <button type="button" onClick={() => openShare("x")}><span className="share-icon-text">𝕏</span>X</button>
        <button type="button" onClick={() => openShare("whatsapp")}><MessageCircle size={16} />{shareText.whatsapp}</button>
        <button type="button" onClick={() => openShare("facebook")}><Facebook size={16} />{shareText.facebook}</button>
      </div>}
    </div>
    {shareNote && <span className="share-note">{shareNote}</span>}
  </div>;
}
