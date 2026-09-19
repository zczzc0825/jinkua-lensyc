import type { Metadata } from "next";
import Link from "next/link";
import { getGuidesIndexAsync } from "@/lib/guides";
import { configuredBaseUrl } from "@/lib/seo";
const absoluteUrl = (path: string) => `${configuredBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
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

// 分类封面图（本地矢量图，避免外站图床被墙导致裂图；frontmatter cover 优先）
const CATEGORY_COVER: Record<string, string> = {
  "pet supplies wholesale China": "/guides/cover-sourcing.png",
  "designer toys wholesale": "/guides/cover-designer-toys.png",
  "custom products with logo China": "/guides/cover-custom-brand.png",
  "China wholesale shipping": "/guides/cover-shipping.png",
};
const DEFAULT_COVER = "/guides/cover-sourcing.png";

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
              <img src={g.cover || CATEGORY_COVER[g.category] || DEFAULT_COVER} alt={g.title} loading="lazy" decoding="async" width={880} height={550} />
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
