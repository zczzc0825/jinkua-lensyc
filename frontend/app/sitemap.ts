import type { MetadataRoute } from "next";
import { api } from "@/lib/api";
import { locales } from "@/lib/i18n";
import { configuredBaseUrl, languageAlternates } from "@/lib/seo";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = configuredBaseUrl();
  const entries: MetadataRoute.Sitemap = [];
  for (const path of ["", "/products", "/about", "/contact"]) {
    for (const locale of locales) {
      entries.push({
        url: `${base}/${locale}${path}`,
        changeFrequency: path === "" ? "daily" : "weekly",
        priority: path === "" ? 1 : 0.8,
        alternates: { languages: languageAlternates(item => `${base}/${item}${path}`) },
      });
    }
  }
  try {
    for (let page = 1; page <= 100; page++) {
      const data = await api.products(new URLSearchParams({ page: String(page), page_size: "100" }));
      for (const item of data.items) {
        for (const locale of locales) {
          entries.push({
            url: `${base}/${locale}/product/${item.slug}`,
            lastModified: item.published_at ? new Date(item.published_at) : undefined,
            changeFrequency: "weekly",
            priority: 0.7,
            alternates: { languages: languageAlternates(item2 => `${base}/${item2}/product/${item.slug}`) },
          });
        }
      }
      if (page * 100 >= data.total) break;
    }
  } catch {}
  try {
    const categories = await api.categories("en");
    for (const category of categories) {
      for (const locale of locales) {
        entries.push({
          url: `${base}/${locale}/categories/${category.slug}`,
          changeFrequency: "weekly",
          priority: 0.6,
          alternates: { languages: languageAlternates(item => `${base}/${item}/categories/${category.slug}`) },
        });
      }
    }
  } catch {}
  return entries;
}
