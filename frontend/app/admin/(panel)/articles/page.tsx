"use client";
import { useEffect, useRef, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { adminFetch } from "@/lib/api";
import { Plus, Save, Upload, FileUp, X } from "lucide-react";

type Article = {
  id: number; slug: string; title: string; summary: string | null; content: string | null;
  category: string | null; keywords: string | null; cover_image: string | null;
  is_published: boolean; published_at: string | null; created_by?: string; updated_by?: string;
};

const EMPTY: Partial<Article> = { slug: "", title: "", category: "", keywords: "", cover_image: "", summary: "", content: "", is_published: false };

// 解析 Markdown 文件的 frontmatter 与正文，用于一键生成文章
function parseMarkdownFile(raw: string, fileName: string) {
  const result: Partial<Article> & { date?: string } = {};
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  let body = raw;
  if (m) {
    for (const line of m[1].split(/\r?\n/)) {
      const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line.trim());
      if (!kv) continue;
      const value = kv[2].replace(/^["']|["']$/g, "").trim();
      if (kv[1] === "title") result.title = value;
      else if (kv[1] === "description") result.summary = value;
      else if (kv[1] === "category") result.category = value;
      else if (kv[1] === "keywords") result.keywords = value;
      else if (kv[1] === "cover") result.cover_image = value;
      else if (kv[1] === "date") result.date = value;
    }
    body = m[2];
  }
  result.content = body.trim();
  if (!result.title) {
    const h1 = /^#\s+(.+)$/m.exec(body);
    if (h1) result.title = h1[1].trim();
  }
  result.slug = fileName.replace(/\.md$/i, "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return result;
}

export default function Page() {
  const [items, setItems] = useState<Article[]>([]);
  const [editing, setEditing] = useState<Partial<Article> | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const mdRef = useRef<HTMLInputElement>(null);

  const load = () => adminFetch<Article[]>("/api/admin/articles").then(setItems);
  useEffect(() => { load(); }, []);

  // 上传 .md 文件 → 解析 frontmatter → 自动填充表单
  async function importMarkdown(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const parsed = parseMarkdownFile(await file.text(), file.name);
      setEditing(prev => ({ ...EMPTY, ...(prev || {}), ...parsed, id: prev?.id }));
    } catch {
      setError("读取 Markdown 文件失败，请确认文件为 UTF-8 编码");
    } finally {
      if (mdRef.current) mdRef.current.value = "";
    }
  }

  function set(field: keyof Article, value: unknown) {
    setEditing(prev => prev ? { ...prev, [field]: value } : prev);
  }

  async function uploadCover(file: File | undefined) {
    if (!file) return;
    setError(""); setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const token = localStorage.getItem("plynook_token");
      const res = await fetch("/api/admin/upload/image", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      set("cover_image", data.url); // 上传后自动填入地址，与手填地址效果相同
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const payload = { ...editing, slug: (editing?.slug || "").trim() };
    try {
      const method = payload.id ? "PUT" : "POST";
      const url = payload.id ? `/api/admin/articles/${payload.id}` : "/api/admin/articles";
      await adminFetch(url, { method, body: JSON.stringify(payload) });
      setEditing(null); load();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
  }

  async function remove(id: number) {
    if (!confirm("确定删除这篇文章吗？")) return;
    await adminFetch(`/api/admin/articles/${id}`, { method: "DELETE" });
    load();
  }

  return <AdminShell title="文章管理" actions={<div style={{ display: "flex", gap: 8 }}>
    <input ref={mdRef} type="file" accept=".md,.markdown,text/markdown" hidden onChange={e => importMarkdown(e.target.files?.[0])}/>
    <button className="btn btn-soft" onClick={() => { setEditing({ ...EMPTY }); setTimeout(() => mdRef.current?.click(), 50); }}><FileUp size={16}/>上传 Markdown 生成</button>
    <button className="btn btn-primary" onClick={() => setEditing({ ...EMPTY })}><Plus size={16}/>手动新增</button>
  </div>}>
    {editing && <div className="panel">
      <div className="admin-header"><h2>{editing.id ? "编辑" : "新增"}文章</h2><button className="btn btn-soft" onClick={() => setEditing(null)}><X size={16}/></button></div>
      <form className="form-grid" onSubmit={save}>
        <label>文章标题<input className="field" required value={editing.title || ""} onChange={e => set("title", e.target.value)}/></label>
        <label>路径（如 my-first-guide）<input className="field" required value={editing.slug || ""} onChange={e => set("slug", e.target.value)}/></label>
        <label>分类（如 designer toys wholesale）<input className="field" value={editing.category || ""} onChange={e => set("category", e.target.value)}/></label>
        <label>前台发布<input type="checkbox" checked={!!editing.is_published} onChange={e => set("is_published", e.target.checked)}/></label>
        <label>SEO 关键词（逗号分隔）<input className="field" value={editing.keywords || ""} onChange={e => set("keywords", e.target.value)}/></label>
        <label className="wide">
          封面图（上传图片 或 直接填地址，二选一）
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input className="field" style={{ flex: 1, minWidth: 220 }} placeholder="/storage/xxx.png 或 https://…" value={editing.cover_image || ""} onChange={e => set("cover_image", e.target.value)}/>
            <button type="button" className="btn btn-soft" disabled={uploading} onClick={() => fileRef.current?.click()}>
              <Upload size={15}/>{uploading ? "上传中…" : "上传图片"}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => uploadCover(e.target.files?.[0])}/>
          </div>
          {editing.cover_image ? <img src={editing.cover_image} alt="封面预览" style={{ marginTop: 8, width: 220, height: 138, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border,#e5e5e5)" }}/> : <small style={{ opacity: .6 }}>留空时前台按分类自动配默认封面图</small>}
        </label>
        <label className="wide">摘要（SEO description）<textarea className="field" rows={2} value={editing.summary || ""} onChange={e => set("summary", e.target.value)}/></label>
        <label className="wide">正文（Markdown）<textarea className="field" rows={12} value={editing.content || ""} onChange={e => set("content", e.target.value)}/></label>
        {editing.id && <div className="wide operator-card"><span>创建人：{editing.created_by || "—"}</span><span>最后处理：{editing.updated_by || "—"}</span></div>}
        {error && <div className="error wide">{error}</div>}
        <button className="btn btn-accent" type="submit"><Save size={16}/>保存</button>
      </form>
    </div>}
    <div className="panel"><table className="table">
      <thead><tr><th>标题</th><th>路径</th><th>分类</th><th>前台发布</th><th>操作</th></tr></thead>
      <tbody>{items.map(item => <tr key={item.id}>
        <td>{item.title}</td><td>{item.slug}</td><td>{item.category || "—"}</td>
        <td>{item.is_published ? "已发布" : "草稿"}</td>
        <td><button className="btn btn-soft" onClick={() => setEditing(item)}>编辑</button> <button className="danger" onClick={() => remove(item.id)}>删除</button></td>
      </tr>)}</tbody>
    </table></div>
  </AdminShell>;
}
