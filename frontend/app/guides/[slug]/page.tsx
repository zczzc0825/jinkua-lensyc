import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllGuides, getAllGuidesAsync, getGuideAsync } from "@/lib/guides";
import { absoluteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import GuidesSidebar from "@/components/GuidesSidebar";
import "../guides.css";

export function generateStaticParams() {
  return getAllGuides().map(g => ({ slug: g.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideAsync(slug);
  if (!guide) return {};
  const url = absoluteUrl(`/guides/${guide.slug}`);
  return {
    title: guide.title,
    description: guide.description,
    keywords: guide.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: "article", title: guide.title, description: guide.description,
      url, publishedTime: guide.date,
      images: guide.cover ? [absoluteUrl(guide.cover)] : undefined,
    },
    twitter: { card: "summary_large_image", title: guide.title, description: guide.description },
  };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const all = await getAllGuidesAsync();
  const idx = all.findIndex(g => g.slug === slug);
  if (idx < 0) notFound();
  const guide = all[idx];
  const prev = all[idx - 1];
  const next = all[idx + 1];
  const url = absoluteUrl(`/guides/${guide.slug}`);
  return (
    <main className="guides-page">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Article",
            "@id": url + "#article",
            additionalType: "https://schema.org/Guide",
            headline: guide.title,
            description: guide.description,
            datePublished: guide.date,
            inLanguage: "en",
            mainEntityOfPage: { "@type": "WebPage", "@id": url },
            image: guide.cover ? absoluteUrl(guide.cover) : undefined,
            author: { "@type": "Organization", name: "Plynook" },
            publisher: { "@type": "Organization", name: "Plynook", logo: { "@type": "ImageObject", url: absoluteUrl("/brand/plynook-logo-horizontal.png") } },
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/en") },
              { "@type": "ListItem", position: 2, name: "Guides", item: absoluteUrl("/guides") },
              { "@type": "ListItem", position: 3, name: guide.title, item: url },
            ],
          },
        ],
      }} />
      <div className="guides-layout">
        <GuidesSidebar title={guide.title} toc={guide.toc} />
        <article className="guides-article">
          <nav className="guides-breadcrumb" aria-label="Breadcrumb">
            <Link href="/en">Home</Link> / <Link href="/guides">Guides</Link> / <span>{guide.title}</span>
          </nav>
          <h1>{guide.title}</h1>
          <p className="guides-meta">
            <time dateTime={guide.date}>{guide.date}</time> · {guide.readMinutes} min read · <span className="guides-tag">{guide.category}</span>
          </p>
          <div className="md" dangerouslySetInnerHTML={{ __html: guide.html }} />
          <nav className="guides-pager" aria-label="Guide pagination">
            {prev ? <Link className="prev" href={`/guides/${prev.slug}`}><small>Previous</small><span>{prev.title}</span></Link> : <span />}
            {next ? <Link className="next" href={`/guides/${next.slug}`}><small>Next</small><span>{next.title}</span></Link> : <span />}
          </nav>
        </article>
      </div>
    </main>
  );
}
