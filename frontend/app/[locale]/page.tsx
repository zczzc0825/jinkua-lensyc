import Link from "next/link";
import { ArrowDownRight, ArrowRight, MessageCircle, PackageCheck } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Locale } from "@/lib/types";

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
  const categoryStories = [
    { name: "Art Toys", image: "https://images.unsplash.com/photo-1634152962476-4b8a00e1915c?auto=format&fit=crop&w=1200&q=88", text: "Collectible characters with expressive little moods." },
    { name: "Home Decor", image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=88", text: "Quiet objects that give a room its own rhythm." },
    { name: "Desk Objects", image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=88", text: "Useful companions for workdays and late ideas." },
    { name: "Gifts", image: "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=1200&q=88", text: "Unexpected pieces chosen for thoughtful giving." },
  ].map((item, index) => ({
    ...item,
    href: data.featured_categories[index]?.slug ? `/${locale}/categories/${data.featured_categories[index].slug}` : `/${locale}/products`,
  }));

  return <main className="home-page">
    <section className="container lifestyle-hero">
      <div className="lifestyle-hero-copy">
        <span className="eyebrow">Independent objects · Edition 01</span>
        <h1>Objects with<br /><em>a point of view.</em></h1>
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
          <img src={product.main_image} alt={product.title} />
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

    <section className="section container home-categories-section">
      <div className="section-head">
        <div><span className="eyebrow">02 / The rooms</span><h2>{m.featuredCategories}</h2></div>
        <Link href={`/${locale}/products`}>{m.explore} <ArrowRight size={15} /></Link>
      </div>
      <div className="category-grid lifestyle-bento">
        {categoryStories.map((category, index) => <Link className={`category-card bento-card bento-${index + 1}`} key={category.name} href={category.href}>
          <img src={category.image} alt={category.name} />
          <div><span className="category-index">0{index + 1}</span><h3>{category.name}</h3><p>{category.text}</p><b>Discover <ArrowRight size={14} /></b></div>
        </Link>)}
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
