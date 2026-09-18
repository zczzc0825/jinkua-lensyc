import { CopyProductId } from "@/components/CopyProductId";
import { ProductCard } from "@/components/ProductCard";
import { ProductDetailActions } from "@/components/ProductDetailActions";
import { ProductDetailImageViewer } from "@/components/ProductDetailImageViewer";
import { ProductMedia } from "@/components/ProductMedia";
import { ProductPriceCard } from "@/components/ProductPriceCard";
import { api } from "@/lib/api";
import { locales, t } from "@/lib/i18n";
import { formatWeight } from "@/lib/price";
import { Locale } from "@/lib/types";
import { breadcrumbList } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { headers } from "next/headers";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  try { const product = await api.product(slug, locale); return { title: product.title, description: product.short_description, openGraph: { title: product.title, description: product.short_description, images: product.main_image ? [product.main_image] : [] }, alternates: { canonical: `/${locale}/product/${slug}`, languages: Object.fromEntries(locales.map(item => [item, `/${item}/product/${slug}`])) } }; }
  catch { return { title: "Product" }; }
}

export default async function Detail({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  const [product, settings, requestHeaders] = await Promise.all([api.product(slug, locale), api.settings(), headers()]);
  const phone = String(settings.whatsapp_phone_number || "85200000000");
  const host = (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "").trim();
  const proto = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const productUrl = host ? `${proto}://${host}/${locale}/product/${slug}` : "";
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
  const baseUrl = host ? `${proto}://${host}` : "https://cooolmake.com";
  const priceValue = product.price != null ? product.price : (product.color_variants || []).map(variant => variant.price).filter((value): value is number => value != null).sort((a, b) => a - b)[0] ?? null;
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.short_description || product.description || `${product.title} from the cooolmake edit`,
    sku: product.sku || undefined,
    mpn: product.product_code || undefined,
    image: product.main_image ? [product.main_image] : (product.gallery_images || []),
    category: product.category?.name,
    brand: { "@type": "Brand", name: "cooolmake" },
    url: productUrl || undefined,
    ...(priceValue != null ? {
      offers: {
        "@type": "Offer",
        url: productUrl || undefined,
        priceCurrency: "USD",
        price: priceValue,
        availability: soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
        itemCondition: "https://schema.org/NewCondition",
        seller: { "@type": "Organization", name: "cooolmake" },
      },
    } : {}),
  };
  const schema = [
    productSchema,
    breadcrumbList(baseUrl, [
      { name: "Home", url: `/${locale}` },
      ...(product.category?.slug ? [{ name: product.category.name, url: `/${locale}/categories/${product.category.slug}` }] : []),
      { name: product.title, url: `/${locale}/product/${slug}` },
    ]),
  ];
  return <main className="container product-detail-page">
    <JsonLd data={schema} />
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
