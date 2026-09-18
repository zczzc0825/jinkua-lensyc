import { Locale } from "./types";

export const SITE_NAME = "cooolmake";
export const SITE_TAGLINE = "Art Toys, Home Decor & Desk Objects";
export const DEFAULT_LOCALE: Locale = "en";

// 每个语言的核心关键词，用于 title/description 与结构化数据（title 会自动追加 " — cooolmake" 模板后缀）
export const seoCopy: Record<Locale, { homeTitle: string; homeDescription: string; productsTitle: string; productsDescription: string; aboutTitle: string; aboutDescription: string; contactTitle: string; contactDescription: string }> = {
  en: {
    homeTitle: "Art Toys, Home Decor & Unique Desk Objects",
    homeDescription: "Shop curated art toys, expressive home decor and unique desk objects. Small-batch designer pieces with worldwide delivery and personal sourcing.",
    productsTitle: "All Products — Art Toys, Home Decor & Desk Objects",
    productsDescription: "Browse the full cooolmake edit: collectible art toys, home decor objects and desk companions, shipped worldwide.",
    aboutTitle: "About — An Independent Edit of Curious Objects",
    aboutDescription: "cooolmake is an independent edit of art toys, desk companions and expressive home objects, selected slowly and shipped worldwide.",
    contactTitle: "Contact — WhatsApp, Shipping & Wholesale Enquiries",
    contactDescription: "Message cooolmake on WhatsApp for pricing, international shipping, wholesale and custom sourcing enquiries. We reply personally.",
  },
  zh: {
    homeTitle: "艺术玩具、家居摆件与桌面好物",
    homeDescription: "精选艺术玩具、家居装饰与桌面小物，小众设计师选品，全球配送，一对一选品服务。",
    productsTitle: "全部商品 — 艺术玩具、家居与桌面好物",
    productsDescription: "浏览 cooolmake 全部选品：艺术玩具、家居摆件与桌面伴侣，全球发货。",
    aboutTitle: "关于 — 独立选品工作室",
    aboutDescription: "cooolmake 是一个独立选品系列：艺术玩具、桌面伴侣与家居摆件，慢选细挑，全球配送。",
    contactTitle: "联系 — WhatsApp 咨询、运费与批发",
    contactDescription: "通过 WhatsApp 联系 cooolmake 咨询价格、国际运费、批发与定制选品，我们真人回复。",
  },
  ja: {
    homeTitle: "アートトイとホームオブジェのセレクト",
    homeDescription: "アートトイ、表現力のあるホームデコア、デスク雑貨をセレクト。少量ロットのデザイナーズ品を世界中にお届けします。",
    productsTitle: "全商品 — アートトイ・ホームデコア・デスク雑貨",
    productsDescription: "cooolmake の全セレクトをチェック：アートトイ、ホームオブジェ、デスクコンパニオンを全世界配送。",
    aboutTitle: "私たちについて — 独立系セレクトショップ",
    aboutDescription: "cooolmake はアートトイ、デスク雑貨、ホームオブジェの独立セレクトシリーズです。",
    contactTitle: "お問い合わせ — WhatsApp・配送・卸売",
    contactDescription: "価格、海外配送、卸売、カスタム調達について WhatsApp でお気軽にお問い合わせください。",
  },
  ko: {
    homeTitle: "아트토이, 홈데코 & 데스크 오브제",
    homeDescription: "아트토이, 개성 있는 홈 데코, 데스크 오브제를 엄선했습니다. 소량 프로듀서 아이템을 전 세계로 배송합니다.",
    productsTitle: "전체 상품 — 아트토이, 홈데코, 데스크 오브제",
    productsDescription: "cooolmake 전체 컬렉션: 아트토이, 홈 오브제, 데스크 컴패니언을 전 세계로 배송.",
    aboutTitle: "소개 — 독립 큐레이션 숍",
    aboutDescription: "cooolmake는 아트토이, 데스크 컴패니언, 홈 오브제의 독립 큐레이션 브랜드입니다.",
    contactTitle: "문의하기 — WhatsApp, 배송 & 도매",
    contactDescription: "가격, 국제 배송, 도매 및 커스텀 소싱 문의는 WhatsApp으로 연락해 주세요.",
  },
};

export function absoluteUrl(path: string): string {
  const base = (process.env.SITE_URL || "https://cooolmake.com").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export type JsonLdObject = { [key: string]: unknown };

export function breadcrumbList(baseUrl: string, trail: { name: string; url: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${baseUrl}${item.url}`,
    })),
  };
}

export function organization(baseUrl: string): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: baseUrl,
    logo: absoluteUrl("/brand/logo_black.png"),
    slogan: SITE_TAGLINE,
  };
}
