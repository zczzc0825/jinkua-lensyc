import { ArrowDownRight, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Locale } from "@/lib/types";
import { t } from "@/lib/i18n";
import { seoCopy, organization, absoluteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const c = seoCopy[locale] || seoCopy.en;
  return {
    title: c.aboutTitle,
    description: c.aboutDescription,
    alternates: { canonical: absoluteUrl(`/${locale}/about`) },
    openGraph: { title: c.aboutTitle, description: c.aboutDescription, url: absoluteUrl(`/${locale}/about`), type: "website" },
  };
}

export default async function About({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const m = t(locale);
  const images = [
    "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=85",
    "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=85",
    "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=900&q=85",
  ];
  return <main className="container content-page about-page-enhanced">
    <JsonLd data={[organization(absoluteUrl("")), {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      name: "About cooolmake",
      description: seoCopy[locale]?.aboutDescription || seoCopy.en.aboutDescription,
      url: absoluteUrl(`/${locale}/about`),
      mainEntity: organization(absoluteUrl("")),
    }]} />
    <header className="page-hero about-hero-card">
      <div>
        <span className="eyebrow">Our point of view</span>
        <h1 className="page-title">{m.brandStory}</h1>
        <p>cooolmake is an independent edit of art toys, desk companions and expressive home objects.</p>
      </div>
      <div className="about-hero-mark"><span>Journal note · 01</span><p>We believe the most personal rooms are assembled slowly, one curious object at a time.</p><ArrowDownRight /></div>
    </header>
    <div className="about-image-triptych">{images.map((image, index) => <img src={image} alt={`cooolmake lifestyle ${index + 1}`} key={image} />)}</div>
    <section className="about-copy-card"><h2>A slower edit</h2><p>{m.aboutBody}</p></section>
    <section className="about-copy-card"><h2>{m.buying}</h2><p>{m.buyingBody}</p><Link className="btn btn-accent" href={`/${locale}/products`}>Explore products <ArrowRight size={18} /></Link></section>
  </main>;
}
