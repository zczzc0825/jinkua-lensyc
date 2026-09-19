import Link from "next/link";
import { ArrowDownRight, ArrowRight, MessageCircle, PackageCheck } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Locale } from "@/lib/types";
import { seoCopy, organization, absoluteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { getGuidesIndexAsync } from "@/lib/guides";
import "./home-guides.css";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const c = seoCopy[locale] || seoCopy.en;
  return {
    title: c.homeTitle,
    description: c.homeDescription,
    alternates: { canonical: absoluteUrl(`/${locale}`), languages: Object.fromEntries(["en", "zh", "ja", "ko"].map(item => [item, absoluteUrl(`/${item}`)])) },
    openGraph: { title: c.homeTitle, description: c.homeDescription, url: absoluteUrl(`/${locale}`), type: "website", locale },
  };
}

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const m = t(locale);
  const data = await api.home(locale);
  const settings = await api.settings();
  const phone = String(settings.whatsapp_phone_number || "85200000000");
  const seen = new Set<number>();
  const heroImages = [...data.new_arrivals, ...data.best_sellers]
    .filter(product => product.main_image && !seen.has(product.id) && seen.add(product.id))
    .slice(0, 3);
  const introByLocale = {
    zh: { categories: "按分类选品" },
    en: { categories: "Shop by category" },
    ja: { categories: "カテゴリーで探す" },
    ko: { categories: "카테고리로 보기" },
  } satisfies Record<Locale, { categories: string }>;
  const intro = introByLocale[locale] || introByLocale.en;
  const directoryByLocale = {
    zh: { eyebrow: "02 / 精选目录", title: "从一件好物开始，布置属于你的空间。", body: "按用途与氛围浏览。每一个分类，都只保留值得被看见的物件。", all: "查看全部商品", discover: "浏览分类" },
    en: { eyebrow: "02 / The directory", title: "Begin with one good object.", body: "Browse by purpose and atmosphere. Each category is edited down to the pieces worth noticing.", all: "View all objects", discover: "Browse category" },
    ja: { eyebrow: "02 / セレクト目録", title: "ひとつの良いものから、空間をつくる。", body: "用途と雰囲気から探す、選び抜かれたオブジェのための小さな目録です。", all: "すべての商品", discover: "カテゴリーを見る" },
    ko: { eyebrow: "02 / 셀렉트 디렉터리", title: "좋은 물건 하나에서 공간을 시작하세요.", body: "용도와 분위기에 따라 살펴보세요. 눈여겨볼 가치가 있는 오브제만 남겼습니다.", all: "전체 상품 보기", discover: "카테고리 보기" },
  } satisfies Record<Locale, { eyebrow: string; title: string; body: string; all: string; discover: string }>;
  const directory = directoryByLocale[locale] || directoryByLocale.en;
  const categoryStories = [
    { name: "Art Toys", image: "https://images.unsplash.com/photo-1634152962476-4b8a00e1915c?auto=format&fit=crop&w=1200&q=88", text: "Collectible characters with expressive little moods." },
    { name: "Home Decor", image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=88", text: "Quiet objects that give a room its own rhythm." },
    { name: "Desk Objects", image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=88", text: "Useful companions for workdays and late ideas." },
    { name: "Gifts", image: "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=1200&q=88", text: "Unexpected pieces chosen for thoughtful giving." },
  ].map((item, index) => {
    const source = data.featured_categories[index];
    return {
      ...item,
      name: source?.name || item.name,
      text: source?.description || item.text,
      href: source?.slug ? `/${locale}/categories/${source.slug}` : `/${locale}/products`,
    };
  });

  return <main className="home-page">
    <JsonLd data={organization(absoluteUrl(""))} />
    <section className="container lifestyle-hero">
      <div className="lifestyle-hero-copy">
        <span className="eyebrow">Independent objects · Edition 01</span>
        <h1>Art toys, home decor and desk objects<br /><em>with a point of view.</em></h1>
        <p>A considered collection of art toys, home objects and everyday curiosities for spaces that feel distinctly yours.</p>
        <div className="hero-buttons">
          <Link className="btn btn-accent" href={`/${locale}/products?collection=new&sort=newest`}>View the collection <ArrowRight size={17} /></Link>
          <a className="text-link" href={`https://wa.me/${phone}`}><MessageCircle size={16} />Personal enquiry</a>
        </div>
        <div className="trust-points">
          <span><b>01</b> Small-batch edit</span>
          <span><b>02</b> Personal sourcing</span>
          <span><b>03</b> Worldwide delivery</span>
        </div>
      </div>
      <div className="lifestyle-hero-visual" aria-label="Selected objects">
        {heroImages.map((product, index) => <Link href={`/${locale}/product/${product.slug}`} className={`hero-product-tile tile-${index + 1}`} key={product.id}>
          <img src={product.main_image} alt={`${product.title} — art toy & home object`} width={480} height={600} />
          <span>{String(index + 1).padStart(2, "0")} — {product.title}</span>
        </Link>)}
        <div className="hero-note"><span>Current edit</span><strong>Form, colour<br />and character.</strong></div>
      </div>
      <ArrowDownRight className="hero-scroll-mark" aria-hidden="true" />
    </section>

    <section className="home-category-bar container" aria-label={intro.categories}>
      <span>{intro.categories}</span>
      {data.featured_categories.slice(0, 6).map(category => <Link key={category.id} href={`/${locale}/categories/${category.slug}`}>{category.name}</Link>)}
      <Link className="all-link" href={`/${locale}/products`}>{m.explore} <ArrowRight size={14} /></Link>
    </section>

    <section className="section container home-new-section">
      <div className="section-head">
        <div><span className="eyebrow">01 / The new edit</span><h2>{m.newArrivals}</h2><p>{m.newSubtitle}</p></div>
        <Link href={`/${locale}/products?collection=new&sort=newest`}>{m.explore} <ArrowRight size={15} /></Link>
      </div>
      <div className="product-grid home-product-grid">{data.new_arrivals.slice(0, 4).map(product => <ProductCard key={product.id} product={product} locale={locale} />)}</div>
    </section>

    <section className="section container home-categories-section category-directory-section">
      <div className="category-directory-intro">
        <span className="eyebrow">{directory.eyebrow}</span>
        <h2>{directory.title}</h2>
        <p>{directory.body}</p>
        <Link className="category-directory-all" href={`/${locale}/products`}>{directory.all} <ArrowRight size={15} /></Link>
      </div>
      <div className="category-directory-list">
        {categoryStories.map((category, index) => <Link className="category-directory-item" key={category.name} href={category.href}>
          <span className="category-directory-index">0{index + 1}</span>
          <div className="category-directory-image"><img src={category.image} alt={`${category.name} collection at cooolmake`} loading="lazy" width={480} height={360} /></div>
          <div className="category-directory-copy"><h3>{category.name}</h3><p>{category.text}</p><small>{directory.discover}</small></div>
          <span className="category-directory-arrow" aria-hidden="true"><ArrowRight size={16} /></span>
        </Link>)}
      </div>
    </section>

    <section className="section container home-guides-section" aria-label="Guides">
      <div className="section-head">
        <div><span className="eyebrow">03 / Guides</span><h2>{m.guides}</h2><p>Sourcing playbooks for creative buyers — inquiry, shipping and wholesale, explained.</p></div>
        <Link href="/guides">{m.explore} <ArrowRight size={15} /></Link>
      </div>
      <div className="home-guides-grid">
        {(await getGuidesIndexAsync()).list.slice(0, 3).map(guide => (
          <Link className="home-guide-card" key={guide.slug} href={`/guides/${guide.slug}`}>
            <span className="home-guide-tag">{guide.category}</span>
            <h3>{guide.title}</h3>
            <p>{guide.description}</p>
            <small>Read guide →</small>
          </Link>
        ))}
      </div>
    </section>

    <section className="section brand-story-section">
      <div className="container brand-story-band">
        <span className="brand-story-number">03</span>
        <div><span className="eyebrow">Our point of view</span><h2>Fewer things.<br /><em>Better stories.</em></h2></div>
        <div className="brand-story-copy"><p>We look for pieces with presence: objects that are useful, unusual, and made to be noticed slowly.</p><Link href={`/${locale}/about`}>Read our story <ArrowRight size={15} /></Link></div>
      </div>
    </section>

    <section className="section container how-buy-section">
      <div className="section-head"><div><span className="eyebrow">04 / A personal service</span><h2>How it works</h2></div></div>
      <div className="how-buy-grid">
        {["Choose the pieces that speak to you", "Send a personal enquiry", "Confirm price and delivery", "We arrange the rest"].map((step, index) => <div className="how-buy-card" key={step}><span>{String(index + 1).padStart(2, "0")}</span><PackageCheck /><strong>{step}</strong></div>)}
      </div>
    </section>

    <section className="section container home-best-section">
      <div className="section-head">
        <div><span className="eyebrow">05 / Most considered</span><h2>{m.bestSellers}</h2><p>{m.bestSubtitle}</p></div>
        <Link href={`/${locale}/products?sort=popular`}>{m.explore} <ArrowRight size={15} /></Link>
      </div>
      <div className="product-grid home-product-grid">{data.best_sellers.slice(0, 4).map(product => <ProductCard key={product.id} product={product} locale={locale} />)}</div>
    </section>
  </main>;
}
