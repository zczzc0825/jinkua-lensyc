"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api, sessionId } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Category, Locale, Product, Tag } from "@/lib/types";
import { ProductCard } from "./ProductCard";
import { useWhatsAppPhone } from "./SiteSettingsProvider";

export function ProductBrowser({
  locale,
  initialCategory = "",
  initialKeyword = "",
  initialSort = "recommended",
  initialCollection = "",
}: {
  locale: Locale;
  initialCategory?: string;
  initialKeyword?: string;
  initialSort?: string;
  initialCollection?: string;
}) {
  const m = t(locale);
  const phone = useWhatsAppPhone();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [category, setCategory] = useState(initialCategory);
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState(initialSort);
  const [keyword, setKeyword] = useState(initialKeyword);
  const [query, setQuery] = useState(initialKeyword);
  const [loading, setLoading] = useState(true);
  const searchLabel = { zh: "搜索", en: "Search", ja: "検索", ko: "검색" }[locale];

  useEffect(() => {
    Promise.all([api.categories(locale), api.tags(locale)]).then(([categoryItems, tagItems]) => {
      setCategories(categoryItems);
      setTags(tagItems);
    });
  }, [locale]);

  useEffect(() => {
    const params = new URLSearchParams({ locale, sort });
    if (category) params.set("category", category);
    if (tag) params.set("tag", tag);
    if (query) params.set("keyword", query);
    if (initialCollection) params.set("collection", initialCollection);
    setLoading(true);
    api.products(params).then(result => setProducts(result.items)).finally(() => setLoading(false));
  }, [locale, category, tag, sort, query, initialCollection]);

  useEffect(() => {
    const keywordText = query.trim();
    if (!keywordText) return;
    api.event({ session_id: sessionId(), event_type: "search", locale, page_url: location.href, search_keyword: keywordText }).catch(() => {});
  }, [query, locale]);

  return <>
    <form className="filters" onSubmit={event => { event.preventDefault(); setQuery(keyword.trim()); }}>
      <div className="search-box">
        <Search size={18} style={{ position: "absolute", left: 14, top: 14 }} />
        <input className="field search-input" style={{ paddingLeft: 42 }} value={keyword} onChange={event => setKeyword(event.target.value)} placeholder={m.search} />
        <button className="btn btn-primary search-submit" type="submit"><Search size={16} />{searchLabel}</button>
      </div>
      <select className="field" value={category} onChange={event => setCategory(event.target.value)}><option value="">{m.allCategories}</option>{categories.map(item => <option value={item.slug} key={item.id}>{item.name}</option>)}</select>
      <select className="field" value={tag} onChange={event => setTag(event.target.value)}><option value="">{m.allTags}</option>{tags.map(item => <option value={item.slug} key={item.id}>{item.name}</option>)}</select>
      <select className="field" value={sort} onChange={event => setSort(event.target.value)}><option value="recommended">{m.recommended}</option><option value="newest">{m.newest}</option><option value="popular">{m.popular}</option></select>
    </form>
    {loading
      ? <div className="loading">Loading…</div>
      : products.length
        ? <div className="product-grid">{products.map(product => <ProductCard key={product.id} product={product} locale={locale} />)}</div>
        : <div className="empty"><h3>{m.noResults}</h3><a className="btn btn-primary" href={`https://wa.me/${phone}`}>{m.whatsapp}</a></div>}
  </>;
}
