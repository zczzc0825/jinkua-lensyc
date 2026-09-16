"use client";

import { ReactNode, useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { adminFetch } from "@/lib/api";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Breakdown = {
  days: number;
  languages: { locale: string; count: number }[];
  sources: { source: string; count: number }[];
  search_terms: { keyword: string; count: number }[];
  top_products: { id: number; product_code: string; title: string; slug: string; views: number }[];
  top_categories: { id: number; name: string; slug: string; views: number }[];
};

function RankingTable({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  return <div className="panel analytics-panel"><h2>{title}</h2>{children || <p className="muted">{empty}</p>}</div>;
}

export default function Analytics() {
  const [trend, setTrend] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);

  useEffect(() => {
    adminFetch<any[]>("/api/admin/analytics/trend?days=30").then(setTrend);
    adminFetch("/api/admin/analytics/summary").then(setSummary);
    adminFetch<Breakdown>("/api/admin/analytics/breakdown?days=30").then(setBreakdown);
  }, []);

  return <AdminShell title="流量分析">
    <div className="stats">
      <div className="stat"><span>今日独立访客</span><strong>{summary.unique_visitors || 0}</strong></div>
      <div className="stat"><span>今日去重转化点击</span><strong>{summary.whatsapp_clicks || 0}</strong></div>
      <div className="stat"><span>今日去重商品访问</span><strong>{summary.product_views || 0}</strong></div>
      <div className="stat"><span>今日询价提交</span><strong>{summary.inquiry_submits || 0}</strong></div>
    </div>

    <div className="panel">
      <h2>最近 30 天趋势</h2>
      <div style={{ height: 380 }}>
        <ResponsiveContainer>
          <BarChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="page_views" name="去重页面访问" fill="#7c5cff" radius={[6, 6, 0, 0]} />
            <Bar dataKey="whatsapp_clicks" name="去重 WhatsApp 点击" fill="#ff5a3c" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

    <div className="analytics-grid">
      <RankingTable title="语言分布 Top 10" empty="暂无语言数据">
        {breakdown?.languages.length ? <table className="table"><tbody>{breakdown.languages.map(item => <tr key={item.locale}><td>{item.locale.toUpperCase()}</td><td>{item.count}</td></tr>)}</tbody></table> : null}
      </RankingTable>

      <RankingTable title="来源渠道 Top 10" empty="暂无 UTM 来源数据">
        {breakdown?.sources.length ? <table className="table"><tbody>{breakdown.sources.map(item => <tr key={item.source}><td>{item.source}</td><td>{item.count}</td></tr>)}</tbody></table> : null}
      </RankingTable>

      <RankingTable title="热门商品 Top 10" empty="暂无商品访问数据">
        {breakdown?.top_products.length ? <table className="table"><thead><tr><th>商品</th><th>ID</th><th>去重访问</th></tr></thead><tbody>{breakdown.top_products.map(item => <tr key={item.id}><td>{item.title}</td><td>{item.product_code}</td><td>{item.views}</td></tr>)}</tbody></table> : null}
      </RankingTable>

      <RankingTable title="热门分类 Top 10" empty="暂无分类访问数据">
        {breakdown?.top_categories.length ? <table className="table"><thead><tr><th>分类</th><th>路径</th><th>去重访问</th></tr></thead><tbody>{breakdown.top_categories.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.slug}</td><td>{item.views}</td></tr>)}</tbody></table> : null}
      </RankingTable>

      <RankingTable title="搜索词 Top 10" empty="暂无搜索词数据">
        {breakdown?.search_terms.length ? <table className="table"><thead><tr><th>搜索词</th><th>次数</th></tr></thead><tbody>{breakdown.search_terms.map(item => <tr key={item.keyword}><td>{item.keyword}</td><td>{item.count}</td></tr>)}</tbody></table> : null}
      </RankingTable>
    </div>
  </AdminShell>;
}
