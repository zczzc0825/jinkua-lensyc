"use client";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

export interface TocItem { id: string; text: string; level: number }

export default function GuidesSidebar({ title, toc }: { title: string; toc: TocItem[] }) {
  const [active, setActive] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const headings = toc.map(t => document.getElementById(t.id)).filter(Boolean) as HTMLElement[];
    if (!headings.length) return;
    const observer = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
    }, { rootMargin: "-20% 0px -70% 0px" });
    headings.forEach(h => observer.observe(h));
    return () => observer.disconnect();
  }, [toc]);

  const Nav = (
    <nav aria-label="Guide table of contents" className="guides-toc">
      <p className="guides-toc-title">On this page</p>
      <ul>
        {toc.filter(t => t.level <= 3).map(t => (
          <li key={t.id} className={`toc-l${t.level} ${active === t.id ? "active" : ""}`}>
            <a href={`#${t.id}`} onClick={() => setOpen(false)}>{t.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <>
      <button className="guides-menu-btn" onClick={() => setOpen(true)} aria-label="Open guide contents">
        <Menu size={18} /> Contents
      </button>
      <aside className="guides-sidebar" aria-label="Guide navigation">{Nav}</aside>
      {open && (
        <div className="guides-drawer-overlay" onClick={() => setOpen(false)}>
          <div className="guides-drawer" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Guide contents">
            <div className="guides-drawer-head">
              <span>{title}</span>
              <button onClick={() => setOpen(false)} aria-label="Close contents"><X size={18} /></button>
            </div>
            {Nav}
          </div>
        </div>
      )}
    </>
  );
}
