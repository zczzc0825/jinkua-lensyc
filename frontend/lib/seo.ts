import { headers } from "next/headers";
import { locales } from "./i18n";
import { Locale } from "./types";

export const seoCopy = {
  home: {
    en: { title: "cooolmake — Objects for curious spaces", description: "Art toys, expressive home decor and delightful desk companions. Browse the collection and get a personal quote on WhatsApp." },
    zh: { title: "cooolmake — 有趣空间的个性好物", description: "精选潮玩、创意家居与桌面伙伴，四语浏览，通过 WhatsApp 获取一对一报价。" },
    ja: { title: "cooolmake — 好奇心のある空間へ", description: "アートトイ、個性的なホーム雑貨、デスクアイテムのセレクトショップ。WhatsAppで気軽にお見積りをどうぞ。" },
    ko: { title: "cooolmake — 호기심 가득한 공간", description: "아트 토이, 감각적인 홈 데코, 데스크 아이템 셀렉트숍. WhatsApp으로 직접 견적을 문의하세요." },
  },
  products: {
    en: { title: "All products", description: "Every cooolmake piece in one place: art toys, home decor and desk companions. Filter by category or tag and ask for a personal quote." },
    zh: { title: "全部商品", description: "cooolmake 全部商品一览：潮玩、创意家居与桌面好物。按分类或标签筛选，WhatsApp 一对一询价。" },
    ja: { title: "すべての商品", description: "cooolmake の全商品をカテゴリーやタグで絞り込み。WhatsAppでお気軽にお見積りください。" },
    ko: { title: "전체 상품", description: "cooolmake 전체 상품을 카테고리와 태그로 둘러보고, WhatsApp으로 견적을 문의하세요." },
  },
  contact: {
    en: { title: "Contact", description: "Talk to a real person: send your inquiry list on WhatsApp or by email and we will confirm pricing, shipping and delivery." },
    zh: { title: "联系我们", description: "通过 WhatsApp 或邮件直接联系我们，真人协助确认价格、运费与交付。" },
    ja: { title: "お問い合わせ", description: "WhatsAppやメールでスタッフに直接お問い合わせください。価格、送料、納期をご案内します。" },
    ko: { title: "문의하기", description: "WhatsApp이나 이메일로 직접 문의하세요. 가격, 배송비, 일정을 안내해 드립니다." },
  },
} as const;

export function seoCopyFor(group: keyof typeof seoCopy, locale: Locale) { return seoCopy[group][locale] || seoCopy[group].en; }

const envBase = () => (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
export const fallbackBaseUrl = "http://localhost:3000";

export function configuredBaseUrl(): string { return envBase() || fallbackBaseUrl; }

export async function siteBaseUrl(): Promise<string> {
  const env = envBase();
  if (env) return env;
  try {
    const requestHeaders = await headers();
    const host = (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "").trim();
    if (host) {
      const proto = (requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https")).trim();
      return `${proto}://${host}`;
    }
  } catch {}
  return fallbackBaseUrl;
}

export const defaultOgImage = [{ url: "/brand/og-default.png", width: 1200, height: 630, alt: "cooolmake" }];

export function languageAlternates(path: (locale: Locale) => string): Record<string, string> {
  return Object.fromEntries([...locales.map(locale => [locale, path(locale)]), ["x-default", path("en")]]);
}
