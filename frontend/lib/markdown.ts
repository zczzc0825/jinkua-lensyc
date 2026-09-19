// 轻量 Markdown 渲染器：构建/服务端执行，无客户端运行时，不引入第三方依赖
export interface TocItem { id: string; text: string; level: number }

export function slugifyHeading(text: string, used: Set<string>): string {
  const base = text.toLowerCase().trim()
    .replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-") || "section";
  let id = base, n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy" decoding="async" width="880" />')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export function renderMarkdown(md: string): { html: string; toc: TocItem[] } {
  const used = new Set<string>();
  const toc: TocItem[] = [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0, listType: "ul" | "ol" | null = null, inCode = false, inQuote = false;
  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };
  const closeQuote = () => { if (inQuote) { out.push("</blockquote>"); inQuote = false; } };
  const openList = (t: "ul" | "ol") => { if (listType !== t) { closeList(); out.push(`<${t}>`); listType = t; } };

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      closeList(); closeQuote();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${escapeHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      closeList(); closeQuote();
      const level = h[1].length;
      const text = h[2].trim();
      const id = slugifyHeading(text, used);
      toc.push({ id, text, level });
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++; continue;
    }
    if (/^\s*$/.test(line)) { closeList(); closeQuote(); i++; continue; }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { closeList(); closeQuote(); out.push("<hr />"); i++; continue; }
    if (/^>\s?/.test(line)) {
      closeList();
      if (!inQuote) { out.push("<blockquote>"); inQuote = true; }
      out.push(`<p>${inline(line.replace(/^>\s?/, ""))}</p>`); i++; continue;
    }
    if (inQuote && !/^>\s?/.test(line)) closeQuote();
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ul) { openList("ul"); out.push(`<li>${inline(ul[1])}</li>`); i++; continue; }
    if (ol) { openList("ol"); out.push(`<li>${inline(ol[1])}</li>`); i++; continue; }
    if (line.includes("|") && lines[i + 1] && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      closeList(); closeQuote();
      const row = (l: string) => l.replace(/^\||\|$/g, "").split("|").map(c => c.trim());
      const head = row(line); i += 2;
      const body: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && !/^\s*$/.test(lines[i])) body.push(row(lines[i++]));
      out.push("<table><thead><tr>" + head.map(c => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>"
        + body.map(r => "<tr>" + r.map(c => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") + "</tbody></table>");
      continue;
    }
    const para: string[] = [line];
    while (i + 1 < lines.length && !/^\s*$/.test(lines[i + 1]) && !/^(#{1,6}\s|>|```|\s*[-*+]\s|\s*\d+[.)]\s)/.test(lines[i + 1]) && !(lines[i + 1].includes("|"))) { para.push(lines[++i]); }
    closeList(); closeQuote();
    out.push(`<p>${inline(para.join(" "))}</p>`);
    i++;
  }
  closeList(); closeQuote();
  return { html: out.join("\n"), toc };
}
