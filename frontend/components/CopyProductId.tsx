"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Locale } from "@/lib/types";

export function CopyProductId({ code, locale }: { code: string; locale: Locale }) {
  const [copied, setCopied] = useState(false);
  const labels = { zh: ["复制", "已复制"], en: ["Copy", "Copied"], ja: ["コピー", "コピー済み"], ko: ["복사", "복사됨"] }[locale];
  return <button className="product-id-copy" type="button" onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
    {copied ? <Check size={14} /> : <Copy size={14} />}
    <span className="product-id-copy-text"><span className="product-id-copy-label">Product ID</span><span className="product-id-copy-code">{code}</span></span>
    <small>{copied ? labels[1] : labels[0]}</small>
  </button>;
}
