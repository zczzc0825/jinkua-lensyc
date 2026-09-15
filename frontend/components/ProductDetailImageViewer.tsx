"use client";

import { useEffect, useState } from "react";
import { Images, Maximize2, X } from "lucide-react";
import { Locale } from "@/lib/types";

const copy = {
  zh: { open: "查看商品详情图", hint: "点击展开全部细节图片", close: "关闭", count: "张图片" },
  en: { open: "View product details", hint: "Open all detail images", close: "Close", count: "images" },
  ja: { open: "詳細画像を見る", hint: "すべての詳細画像を開く", close: "閉じる", count: "枚" },
  ko: { open: "상세 이미지 보기", hint: "전체 상세 이미지 열기", close: "닫기", count: "장" },
} satisfies Record<Locale, { open: string; hint: string; close: string; count: string }>;

export function ProductDetailImageViewer({
  title,
  images,
  productTitle,
  locale,
}: {
  title: string;
  images: string[];
  productTitle: string;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const labels = copy[locale];
  const previewImages = images.slice(0, 3);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return <section className="section product-detail-images-collapsed" aria-labelledby="detail-images-title">
    <button className="detail-image-teaser" type="button" onClick={() => setOpen(true)}>
      <span className="detail-image-teaser-copy">
        <span className="detail-image-teaser-icon"><Images size={22} /></span>
        <span>
          <span className="eyebrow">cooolmake</span>
          <strong id="detail-images-title">{title}</strong>
          <small>{labels.hint} · {images.length} {labels.count}</small>
        </span>
      </span>
      <span className="detail-image-teaser-preview" aria-hidden="true">
        {previewImages.map((src, index) => <img key={`${src}-${index}`} src={src} alt="" />)}
      </span>
      <span className="detail-image-teaser-action"><Maximize2 size={18} />{labels.open}</span>
    </button>

    {open && <div className="detail-image-modal" role="dialog" aria-modal="true" aria-labelledby="detail-image-modal-title" onMouseDown={() => setOpen(false)}>
      <div className="detail-image-modal-panel" onMouseDown={event => event.stopPropagation()}>
        <div className="detail-image-modal-head">
          <div>
            <span className="eyebrow">cooolmake</span>
            <h2 id="detail-image-modal-title">{title}</h2>
            <p>{productTitle} · {images.length} {labels.count}</p>
          </div>
          <button className="detail-image-modal-close" type="button" onClick={() => setOpen(false)} aria-label={labels.close}>
            <X size={22} />
          </button>
        </div>
        <div className="detail-image-modal-grid">
          {images.map((src, index) => <img key={`${src}-${index}`} src={src} alt={`${productTitle} detail ${index + 1}`} />)}
        </div>
      </div>
    </div>}
  </section>;
}
