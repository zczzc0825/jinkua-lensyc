import fs from "fs";
import path from "path";
import { renderMarkdown } from "./markdown";

export interface GuideMeta {
  slug: string;
  title: string;
  description: string;
  category: string;
  date: string;
  order: number;
  keywords?: string;
  cover?: string;
}
export interface Guide extends GuideMeta { html: string; toc: { id: string; text: string; level: number }[]; readMinutes: number }

const DIR = path.join(process.cwd(), "content", "guides");

function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line.trim());
    if (kv) data[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return { data, body: m[2] };
}

export function getAllGuides(): Guide[] {
  let files: string[] = [];
  try { files = fs.readdirSync(DIR).filter(f => f.endsWith(".md")); } catch { return []; }
  const guides = files.map(file => {
    const raw = fs.readFileSync(path.join(DIR, file), "utf-8");
    const { data, body } = parseFrontmatter(raw);
    const { html, toc } = renderMarkdown(body);
    const meta: GuideMeta = {
      slug: file.replace(/\.md$/, ""),
      title: data.title || file.replace(/\.md$/, ""),
      description: data.description || "",
      category: data.category || "Guides",
      date: data.date || "2026-01-01",
      order: data.order !== undefined ? Number(data.order) || 0 : 999,
      keywords: data.keywords,
      cover: data.cover,
    };
    const words = body.split(/\s+/).filter(Boolean).length;
    return { ...meta, html, toc, readMinutes: Math.max(1, Math.round(words / 200)) };
  });
  return guides.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}

export function getGuide(slug: string): Guide | undefined {
  return getAllGuides().find(g => g.slug === slug);
}

export function getGuidesIndex(): { list: (GuideMeta & { readMinutes: number })[]; categories: string[] } {
  const list = getAllGuides().map(({ html, toc, ...rest }) => rest);
  const categories = [...new Set(list.map(g => g.category))];
  return { list, categories };
}

// ===== 后台发布的文章（/api/public/articles）与 md 文件合并展示 =====

interface DbArticle {
  slug: string; title: string; summary: string | null; content?: string | null;
  category: string | null; keywords: string | null; cover_image: string | null;
  published_at: string | null;
}

async function fetchDbArticles(): Promise<DbArticle[]> {
  const base = process.env.API_URL || "http://localhost:8000";
  try {
    const res = await fetch(`${base}/api/public/articles`, { next: { revalidate: 30 } });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return []; // 后端不可用时仅展示 md 文件内容
  }
}

export async function getAllGuidesAsync(): Promise<Guide[]> {
  // 后台数据库版本优先（可在管理后台编辑），md 文件仅作数据库不可用时的兜底
  const dbArticles = await fetchDbArticles();
  const dbSlugs = new Set(dbArticles.map(a => a.slug));
  const merged: Guide[] = getAllGuides().filter(g => !dbSlugs.has(g.slug));
  for (const a of dbArticles) {
    const { html, toc } = renderMarkdown(a.content || a.summary || "");
    merged.push({
      slug: a.slug, title: a.title, description: a.summary || "",
      category: a.category || "Guides", date: a.published_at || "2026-01-01",
      order: 500, keywords: a.keywords || undefined, cover: a.cover_image || undefined,
      html, toc, readMinutes: Math.max(1, Math.round((a.content || "").split(/\s+/).filter(Boolean).length / 200)),
    });
  }
  return merged.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getGuideAsync(slug: string): Promise<Guide | undefined> {
  return (await getAllGuidesAsync()).find(g => g.slug === slug);
}

export async function getGuidesIndexAsync(): Promise<{ list: (GuideMeta & { readMinutes: number })[]; categories: string[] }> {
  const list = (await getAllGuidesAsync()).map(({ html, toc, ...rest }) => rest);
  const categories = [...new Set(list.map(g => g.category))];
  return { list, categories };
}
