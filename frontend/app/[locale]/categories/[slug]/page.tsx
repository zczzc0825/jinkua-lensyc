import type { Metadata } from "next";
import { api } from "@/lib/api";
import { Locale } from "@/lib/types";
import { ProductBrowser } from "@/components/ProductBrowser";
import { notFound, redirect } from "next/navigation";
import { defaultOgImage, languageAlternates } from "@/lib/seo";

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
    const normalizedSlug = normalizeSlug(slug);
    const category = (await api.categories(locale)).find(item => item.slug === slug || item.slug === normalizedSlug || normalizeSlug(item.name || "") === normalizedSlug);
    if (!category) return {};
    return {
      title: category.name || slug,
      description: category.description || undefined,
      alternates: { canonical: `/${locale}/categories/${category.slug}`, languages: languageAlternates(item => `/${item}/categories/${category.slug}`) },
      openGraph: { title: category.name || slug, description: category.description || undefined, images: category.banner_image ? [category.banner_image] : defaultOgImage, url: `/${locale}/categories/${category.slug}` },
    };
  } catch { return {}; }
}

export default async function CategoryPage({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  const normalizedSlug = normalizeSlug(slug);
  const cats = await api.categories(locale);
  const category = cats.find(item => item.slug === slug || item.slug === normalizedSlug || normalizeSlug(item.name || "") === normalizedSlug);

  if (!category) notFound();
  if (category.slug !== slug) redirect(`/${locale}/categories/${category.slug}`);

  return (
    <main className="container">
      <header className="page-hero">
        <span className="eyebrow">cooolmake collection</span>
        <h1 className="page-title">{category.name}</h1>
        <p>{category.description}</p>
      </header>
      <ProductBrowser locale={locale} initialCategory={category.slug} />
    </main>
  );
}
