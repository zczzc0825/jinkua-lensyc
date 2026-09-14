import { ProductBrowser } from "@/components/ProductBrowser";
import { t } from "@/lib/i18n";
import { Locale } from "@/lib/types";

export default async function Products({ params, searchParams }: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ sort?: string; q?: string; collection?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  const m = t(locale);
  return <main className="container">
    <header className="page-hero">
      <span className="eyebrow">Plynook edit</span>
      <h1 className="page-title">{m.products}</h1>
      <p className="muted">Art toys, useful oddities and small joys for spaces with personality.</p>
    </header>
    <ProductBrowser locale={locale} initialKeyword={query.q} initialSort={query.sort} initialCollection={query.collection} />
  </main>;
}
