import type { MetadataRoute } from "next";
import { api } from "@/lib/api";
import { locales } from "@/lib/i18n";
import { getAllGuidesAsync } from "@/lib/guides";

// 静态页面路由（不含 locale 前缀），自动为每个语言生成带 hreflang 的条目
const staticPaths = ["", "/products", "/about", "/contact"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.SITE_URL || "https://cooolmake.com").replace(/\/$/, "");
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  const withAlternates = (path: string, changeFrequency: "daily" | "weekly" | "monthly", priority: number) => ({
    url: `${base}/en${path}`,
    lastModified: now,
    changeFrequency,
    priority,
    alternates: {
      languages: Object.fromEntries(locales.map(locale => [locale, `${base}/${locale}${path}`])),
    },
  });

  for (const path of staticPaths) {
    entries.push(withAlternates(path, path === "" ? "daily" : "weekly", path === "" ? 1 : 0.8));
  }

  try {
    const categories = await api.categories("en");
    const products: Awaited<ReturnType<typeof api.products>>["items"] = [];
    for (let page = 1; page <= 10; page++) {
      const result = await api.products(new URLSearchParams({ locale: "en", page: String(page), page_size: "100" }));
      products.push(...result.items);
      if (products.length >= result.total || result.items.length === 0) break;
    }
    for (const category of categories) {
      entries.push({
        url: `${base}/en/categories/${category.slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.7,
        alternates: { languages: Object.fromEntries(locales.map(locale => [locale, `${base}/${locale}/categories/${category.slug}`])) },
      });
    }
    for (const product of products) {
      entries.push({
        url: `${base}/en/product/${product.slug}`,
        lastModified: product.published_at ? new Date(product.published_at) : now,
        changeFrequency: "weekly",
        priority: 0.9,
        alternates: { languages: Object.fromEntries(locales.map(locale => [locale, `${base}/${locale}/product/${product.slug}`])) },
      });
    }
  } catch {
    // 后端不可用时 sitemap 仍输出静态页面
  }

  // Guides 专栏（英文唯一版本，canonical 指向自身）
  entries.push({
    url: `${base}/guides`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  });
  for (const guide of await getAllGuidesAsync()) {
    entries.push({
      url: `${base}/guides/${guide.slug}`,
      lastModified: new Date(guide.date),
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  return entries;
}
