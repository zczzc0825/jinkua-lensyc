import type { Metadata } from "next";
import { ProductBrowser } from "@/components/ProductBrowser";
import { t } from "@/lib/i18n";
import { Locale } from "@/lib/types";
import { defaultOgImage, languageAlternates, seoCopyFor } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const copy = seoCopyFor("products", locale);
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: `/${locale}/products`, languages: languageAlternates(item => `/${item}/products`) },
    openGraph: { title: copy.title, description: copy.description, url: `/${locale}/products`, images: defaultOgImage },
  };
}

export default async function Products({ params, searchParams }: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ sort?: string; q?: string; collection?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  const m = t(locale);
  return <main className="container">
    <header className="page-hero">
      <span className="eyebrow">cooolmake edit</span>
      <h1 className="page-title">{m.products}</h1>
      <p className="muted">Art toys, useful oddities and small joys for spaces with personality.</p>
    </header>
    <ProductBrowser locale={locale} initialKeyword={query.q} initialSort={query.sort} initialCollection={query.collection} />
  </main>;
}
