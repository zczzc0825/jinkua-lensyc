import type { Metadata } from "next";
import Link from "next/link";
import { getGuidesIndexAsync } from "@/lib/guides";
import { absoluteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import "./guides.css";

export const metadata: Metadata = {
  title: "Guides — Wholesale & Sourcing Playbooks",
  description: "Practical guides for wholesale buyers: how to source creative products from China, request quotes on WhatsApp, and handle international shipping and customs.",
  alternates: { canonical: absoluteUrl("/guides") },
  openGraph: {
    type: "website",
    title: "Guides — Wholesale & Sourcing Playbooks",
    description: "Practical guides for wholesale buyers: sourcing, quotes on WhatsApp, shipping and customs.",
    url: absoluteUrl("/guides"),
  },
};

// 分类封面图（frontmatter 未指定 cover 时按分类回退）
const CATEGORY_COVER: Record<string, string> = {
  "pet supplies wholesale China": "https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=1200&q=80",
  "designer toys wholesale": "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=80",
  "custom products with logo China": "https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?auto=format&fit=crop&w=1200&q=80",
  "China wholesale shipping": "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
};

type Props = { searchParams: Promise<{ cat?: string }> };

export default async function GuidesPage({ searchParams }: Props) {
  const { cat } = await searchParams;
  const { list, categories } = await getGuidesIndexAsync();
  const active = cat && categories.includes(cat) ? cat : "";
  const shown = active ? list.filter(g => g.category === active) : list;
  return (
    <main className="guides-page">
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "CollectionPage",
        name: "Guides", url: absoluteUrl("/guides"),
        description: "Wholesale sourcing and shipping guides.",
        hasPart: list.map(g => ({ "@type": "Article", headline: g.title, url: absoluteUrl(`/guides/${g.slug}`) })),
      }} />
      <header className="guides-hero">
        <h1>cooolmake sourcing notes</h1>
        <p>Practical wholesale sourcing, shipping &amp; customization knowledge for global buyers.</p>
      </header>
      <nav className="guides-filter" aria-label="Filter guides by category">
        <Link href="/guides" className={`guides-pill ${active ? "" : "active"}`}>All</Link>
        {categories.map(c => (
          <Link key={c} href={`/guides?cat=${encodeURIComponent(c)}`} className={`guides-pill ${active === c ? "active" : ""}`}>{c}</Link>
        ))}
      </nav>
      <div className="guides-grid">
        {shown.map(g => (
          <Link key={g.slug} href={`/guides/${g.slug}`} className="guides-card">
            <div className="guides-cover">
              <img src={g.cover || CATEGORY_COVER[g.category] || CATEGORY_COVER["Sourcing"]} alt={g.title} loading="lazy" decoding="async" width={880} height={550} />
            </div>
            <span className="guides-cat-label">{g.category}</span>
            <h2>{g.title}</h2>
            <p>{g.description}</p>
            <span className="guides-meta-line">Updated {g.date} · {g.readMinutes} min read</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
