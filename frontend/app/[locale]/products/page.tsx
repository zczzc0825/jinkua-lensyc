import { ProductBrowser } from "@/components/ProductBrowser";
import { t } from "@/lib/i18n";
import { Locale } from "@/lib/types";
import { seoCopy, absoluteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const c = seoCopy[locale] || seoCopy.en;
  return {
    title: c.productsTitle,
    description: c.productsDescription,
    alternates: { canonical: absoluteUrl(`/${locale}/products`) },
    openGraph: { title: c.productsTitle, description: c.productsDescription, url: absoluteUrl(`/${locale}/products`), type: "website" },
  };
}

export default async function Products({ params, searchParams }: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ sort?: string; q?: string; collection?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  const m = t(locale);
  const c = seoCopy[locale] || seoCopy.en;
  return <main className="container">
    <JsonLd data={{
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "cooolmake product catalogue",
      description: c.productsDescription,
      url: absoluteUrl(`/${locale}/products`),
    }} />
    <header className="page-hero">
      <span className="eyebrow">cooolmake edit</span>
      <h1 className="page-title">{m.products}</h1>
      <p className="muted">Art toys, useful oddities and small joys for spaces with personality.</p>
    </header>
    <ProductBrowser locale={locale} initialKeyword={query.q} initialSort={query.sort} initialCollection={query.collection} />
  </main>;
}
