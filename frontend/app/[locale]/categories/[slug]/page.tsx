import { api } from "@/lib/api";
import { Locale } from "@/lib/types";
import { ProductBrowser } from "@/components/ProductBrowser";
import { breadcrumbList, absoluteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

function normalizeSlug(value: string) {
  return decodeURIComponent(value)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  try {
    const cats = await api.categories(locale);
    const category = cats.find(item => item.slug === slug || normalizeSlug(item.name || "") === normalizeSlug(slug));
    if (!category) return { title: "Category" };
    const title = `${category.name} — Art Toys & Home Objects`;
    const description = (category.description || `Shop ${category.name.toLowerCase()} from the cooolmake edit: curated art toys, home decor and desk objects shipped worldwide.`).slice(0, 155);
    return {
      title,
      description,
      alternates: { canonical: absoluteUrl(`/${locale}/categories/${category.slug}`) },
      openGraph: { title, description, url: absoluteUrl(`/${locale}/categories/${category.slug}`), type: "website" },
    };
  } catch {
    return { title: "Category" };
  }
}

export default async function CategoryPage({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  const normalizedSlug = normalizeSlug(slug);
  const cats = await api.categories(locale);
  const category = cats.find(item => item.slug === slug || item.slug === normalizedSlug || normalizeSlug(item.name || "") === normalizedSlug);

  if (!category) notFound();
  if (category.slug !== slug) redirect(`/${locale}/categories/${category.slug}`);

  const schema = [
    breadcrumbList(absoluteUrl(""), [
      { name: "Home", url: `/${locale}` },
      { name: "Products", url: `/${locale}/products` },
      { name: category.name, url: `/${locale}/categories/${category.slug}` },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${category.name} | cooolmake`,
      description: category.description,
      url: absoluteUrl(`/${locale}/categories/${category.slug}`),
      isPartOf: { "@type": "WebSite", name: "cooolmake", url: absoluteUrl("") },
    },
  ];

  return (
    <main className="container">
      <JsonLd data={schema} />
      <header className="page-hero">
        <span className="eyebrow">cooolmake collection</span>
        <h1 className="page-title">{category.name}</h1>
        <p>{category.description}</p>
      </header>
      <ProductBrowser locale={locale} initialCategory={category.slug} />
    </main>
  );
}
