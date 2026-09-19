import { CopyProductId } from "@/components/CopyProductId";
import { ProductCard } from "@/components/ProductCard";
import { ProductDetailActions } from "@/components/ProductDetailActions";
import { ProductDetailImageViewer } from "@/components/ProductDetailImageViewer";
import { ProductMedia } from "@/components/ProductMedia";
import { ProductPriceCard } from "@/components/ProductPriceCard";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { formatWeight } from "@/lib/price";
import { defaultOgImage, languageAlternates } from "@/lib/seo";
import { Locale } from "@/lib/types";
import { headers } from "next/headers";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  try { const product = await api.product(slug, locale); const title = locale === "en" && product.seo_title_en ? product.seo_title_en : product.title; const description = (locale === "en" && product.seo_description_en ? product.seo_description_en : product.short_description) || product.title; return { title, description, openGraph: { title, description, images: product.main_image ? [product.main_image] : defaultOgImage }, alternates: { canonical: `/${locale}/product/${slug}`, languages: languageAlternates(item => `/${item}/product/${slug}`) } }; }
  catch { return { title: "Product" }; }
}

export default async function Detail({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  const [product, settings, requestHeaders] = await Promise.all([api.product(slug, locale), api.settings(), headers()]);
  const phone = String(settings.whatsapp_phone_number || "85200000000");
  const host = (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "").trim();
  const proto = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const productUrl = host ? `${proto}://${host}/${locale}/product/${slug}` : "";
  const absolute = (value?: string) => value ? (value.startsWith("http") ? value : `${proto}://${host}${value}`) : "";
  const productImages = [product.main_image, ...(product.gallery_images || [])].filter(Boolean).map(absolute);
  const availability = ({ in_stock: "https://schema.org/InStock", limited_stock: "https://schema.org/LimitedAvailability", sold_out: "https://schema.org/OutOfStock" } as Record<string, string>)[product.stock_status] || "https://schema.org/InStock";
  const jsonLd = [
    {
      "@context": "https://schema.org", "@type": "Product", name: product.title, sku: product.sku,
      description: product.short_description || undefined,
      image: productImages,
      brand: { "@type": "Brand", name: "cooolmake" },
      category: product.category?.name || undefined,
      offers: {
        "@type": "Offer", url: productUrl || undefined, availability, itemCondition: "https://schema.org/NewCondition",
        ...(product.show_price && product.price ? { price: product.price, priceCurrency: "CNY" } : {}),
      },
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: { zh: "首页", en: "Home", ja: "ホーム", ko: "홈" }[locale], item: `${proto}://${host}/${locale}` },
        ...(product.category ? [{ "@type": "ListItem", position: 2, name: product.category.name, item: `${proto}://${host}/${locale}/categories/${product.category.slug}` }] : []),
        { "@type": "ListItem", position: product.category ? 3 : 2, name: product.title, item: productUrl || undefined },
      ],
    },
  ];
  const askHref = `https://wa.me/${phone}?text=${encodeURIComponent(`Hi, I'm interested in this product:\n\nProduct ID: ${product.product_code}\nProduct: ${product.title}\nSKU: ${product.sku}\nLink: ${productUrl}\n\nCould you please send me the price and shipping details?`)}`;
  const m = t(locale);
  const availabilityLabel = { zh: "Availability", en: "Availability", ja: "Availability", ko: "Availability" }[locale];
  const soldOut = product.stock_status === "sold_out";
  const listingTitle = { zh: "详细信息", en: "Product details", ja: "詳細情報", ko: "상세 정보" }[locale];
  const detailImagesTitle = { zh: "商品详情图", en: "Product detail images", ja: "商品詳細画像", ko: "상품 상세 이미지" }[locale];
  const labels = {
    productCode: { zh: "商品 ID", en: "Product ID", ja: "商品 ID", ko: "상품 ID" }[locale],
    sku: "SKU",
    category: { zh: "商品分类", en: "Category", ja: "カテゴリー", ko: "카테고리" }[locale],
    publishedAt: { zh: "上架时间", en: "Published at", ja: "公開日", ko: "게시일" }[locale],
    createdAt: { zh: "创建时间", en: "Created at", ja: "作成日", ko: "생성일" }[locale],
    weight: { zh: "重量", en: "Weight", ja: "重量", ko: "무게" }[locale],
  };
  const formatDate = (value?: string) => value ? new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : locale, { year: "numeric", month: "short", day: "numeric" }).format(new Date(value)) : "";
  const cleanFeature = (value: string) => value.replace(/^\s*(\d+[\.\)、:-]?|[-*•])\s*/g, "").replace(/MXXT|undefined|null/gi, "").trim();
  const features = (product.features || []).map(cleanFeature).filter(Boolean);
  const specs = [["Material", product.material], ["Size", product.size], ["Weight", product.weight ? formatWeight(product.weight) : ""], ["Packaging", product.package_info], ["Best for", product.usage_scene]];
  const publicProduct = { ...product, source_platform: undefined, source_url: undefined };
  const publicRelated = product.related?.map(item => ({ ...item, source_platform: undefined, source_url: undefined })) || [];
  const listingDetails = [
    [labels.productCode, product.product_code],
    [labels.sku, product.sku],
    [labels.category, product.category?.name],
    [labels.weight, product.weight ? formatWeight(product.weight) : ""],
    [labels.publishedAt, formatDate(product.published_at)],
    [labels.createdAt, formatDate(product.created_at)],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  return <main className="container product-detail-page">
    {productUrl ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}
    <div className="detail">
      <ProductMedia image={product.main_image} galleryImages={product.gallery_images || []} video={product.video_url} variants={product.color_variants || []} locale={locale} />
      <div className="detail-copy">
        <div className="product-title-card">
          <div className="badges" style={{ position: "static" }}>{product.tags.map(tag => <span key={tag.id} className="badge" style={{ border: `1px solid ${tag.color}`, color: tag.color }}>{tag.name}</span>)}</div>
          <h1>{product.title}</h1>
          <p className="muted">SKU {product.sku} · {product.category?.name}</p>
          <CopyProductId code={product.product_code} locale={locale} />
        </div>
        <ProductPriceCard product={publicProduct} locale={locale} />
        {soldOut
          ? <div className="quantity-card availability-card"><span>{availabilityLabel}</span><strong>Sold Out</strong></div>
          : <div className="quantity-card availability-card"><span>{availabilityLabel}</span><a className="availability-whatsapp-link" href={askHref} target="_blank" rel="noopener noreferrer"><strong>Ask us on WhatsApp</strong></a></div>}
        <div className="product-story-card">
          <span className="eyebrow">Why you'll love it</span>
          <p className="lead">{product.description}</p>
          {features.length > 0 && <ul className="feature-list">{features.map(feature => <li key={feature}>{feature}</li>)}</ul>}
        </div>
        <div className="spec-grid">{specs.filter(item => item[1]).map(([label, value]) => <div className="spec" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        <section className="listing-details" aria-labelledby="listing-details-title">
          <div className="listing-details-head">
            <span className="eyebrow">cooolmake</span>
            <h2 id="listing-details-title">{listingTitle}</h2>
          </div>
          <div className="listing-details-grid">
            {listingDetails.map(([label, value]) => <div className="listing-detail" key={label}><span>{label}</span><strong>{value}</strong></div>)}
          </div>
        </section>
        <ProductDetailActions product={publicProduct} locale={locale} />
      </div>
    </div>
    {product.detail_images?.length > 0 && <ProductDetailImageViewer title={detailImagesTitle} images={product.detail_images} productTitle={product.title} locale={locale} />}
    {publicRelated.length > 0 && <section className="section"><div className="section-head"><h2>{m.related}</h2></div><div className="product-grid">{publicRelated.map(item => <ProductCard product={item} locale={locale} key={item.id} />)}</div></section>}
  </main>;
}
