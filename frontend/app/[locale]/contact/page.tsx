import { Mail, MessageCircle } from "lucide-react";
import { Locale } from "@/lib/types";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { seoCopy, absoluteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import type { Metadata } from "next";

const contactCopy = {
  en: {
    eyebrow: "We reply personally",
    intro: "For pricing, shipping, wholesale, or custom requests, message us directly on WhatsApp.",
    whatsapp: "WhatsApp Business",
    faqs: [
      ["Do you ship internationally?", "Yes. Shipping options and costs are confirmed with your quote."],
      ["How do I place an order?", "Send the product you like to us on WhatsApp, and we’ll help you confirm the details."],
      ["Do you support wholesale orders?", "Yes. Tell us the products and quantities you need and we’ll prepare a quote."],
    ],
  },
  zh: {
    eyebrow: "真人回复",
    intro: "关于商品、运费、交期或批发，都可以直接通过 WhatsApp 联系我们。",
    whatsapp: "WhatsApp 联系",
    faqs: [
      ["是否支持国际发货？", "支持。具体运费、运输方式和交期会根据商品与数量单独确认。"],
      ["如何下单？", "把喜欢的商品通过 WhatsApp 发给我们，我们会帮你确认价格、运费和商品细节。"],
      ["是否支持批发订单？", "支持。告诉我们需要的商品和数量，我们会为你整理报价。"],
    ],
  },
  ja: {
    eyebrow: "スタッフが返信します",
    intro: "商品、配送、納期、卸売については WhatsApp でお気軽にお問い合わせください。",
    whatsapp: "WhatsApp で問い合わせ",
    faqs: [
      ["海外発送はできますか？", "はい。送料、配送方法、納期は商品と数量に合わせて確認します。"],
      ["注文方法を教えてください。", "気になる商品を WhatsApp で送ってください。価格や配送情報をご案内します。"],
      ["卸売注文は可能ですか？", "はい。必要な商品と数量をお知らせいただければ、見積もりをご用意します。"],
    ],
  },
  ko: {
    eyebrow: "직접 답변드립니다",
    intro: "상품, 배송, 납기 또는 도매 관련 문의는 WhatsApp으로 편하게 연락해 주세요.",
    whatsapp: "WhatsApp 문의",
    faqs: [
      ["해외 배송이 가능한가요?", "가능합니다. 배송비, 배송 방식, 납기는 상품과 수량에 따라 확인해 드립니다."],
      ["주문은 어떻게 하나요?", "관심 있는 상품을 WhatsApp으로 보내주시면 가격과 배송 정보를 안내해 드립니다."],
      ["도매 주문도 가능한가요?", "가능합니다. 필요한 상품과 수량을 알려주시면 견적을 준비해 드립니다."],
    ],
  },
} satisfies Record<Locale, { eyebrow: string; intro: string; whatsapp: string; faqs: [string, string][] }>;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const c = seoCopy[locale] || seoCopy.en;
  return {
    title: c.contactTitle,
    description: c.contactDescription,
    alternates: { canonical: absoluteUrl(`/${locale}/contact`) },
    openGraph: { title: c.contactTitle, description: c.contactDescription, url: absoluteUrl(`/${locale}/contact`), type: "website" },
  };
}

export default async function Contact({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const m = t(locale);
  const copy = contactCopy[locale] || contactCopy.en;
  const settings = await api.settings();
  const phone = String(settings.whatsapp_phone_number || "85200000000");
  const email = String(settings.contact_email || "cooolmake001@gmail.com");

  return (
    <main className="container content-page contact-page-enhanced">
      <JsonLd data={[{
        "@context": "https://schema.org",
        "@type": "ContactPage",
        name: "Contact cooolmake",
        description: seoCopy[locale]?.contactDescription || seoCopy.en.contactDescription,
        url: absoluteUrl(`/${locale}/contact`),
      }, {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: copy.faqs.map(([question, answer]) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      }]} />
      <header className="page-hero contact-hero-card">
        <span className="eyebrow">{copy.eyebrow}</span>
        <h1 className="page-title">{m.getInTouch}</h1>
        <p>{copy.intro}</p>
        <a className="btn btn-accent contact-whatsapp-cta" href={`https://wa.me/${phone}`}>
          <MessageCircle />
          {copy.whatsapp}
        </a>
        <a className="btn btn-soft contact-email-cta" href={`mailto:${email}`}>
          <Mail />
          {email}
        </a>
      </header>
      <h2>{m.faq}</h2>
      {copy.faqs.map(([question, answer]) => (
        <div className="faq" key={question}>
          <strong>{question}</strong>
          <p>{answer}</p>
        </div>
      ))}
    </main>
  );
}
