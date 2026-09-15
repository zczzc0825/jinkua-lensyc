"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Ban, Copy, Download, FileText, ImagePlus, Plus, RefreshCcw, Save, Search, Trash2, X, ZoomIn } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { adminFetch } from "@/lib/api";

const blankItem = { id: "", name: "", image: "", quantity: 1, cost_price_cny: 0, unit_price_cny: 0, procurement_source_text: "", admin_note: "", customer_note: "", decision: "pending", added_by: "admin" };
const exampleItem = { ...blankItem, name: "星空投影小夜灯", quantity: 2, cost_price_cny: 110, unit_price_cny: 185, procurement_source_text: "1688 采购链接或供应商备注", admin_note: "含基础包装，颜色与交期需确认" };
const blankQuote: any = { title: "商品采购报价单", status: "draft", customer_name: "", owner_id: null, items: [{ ...blankItem }], first_leg_cost_cny: 0, last_leg_cost_cny: 0, additional_expenses: [], preferred_currency: "USD", exchange_rates: {}, internal_note: "" };
const statusText: Record<string, string> = { draft: "草稿", published: "已发布", customer_confirmed: "客户已确认", cancelled: "已取消" };
const quantityValue = (value: any) => /^[1-9]\d*$/.test(String(value ?? "").trim()) ? Number(value) : 0;

export default function ProcurementQuotesPage() {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [edit, setEdit] = useState<any | null>(null);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const [exporting, setExporting] = useState<number | null>(null);
  const [deletingQuoteId, setDeletingQuoteId] = useState<number | null>(null);
  const [openingQuoteId, setOpeningQuoteId] = useState<number | null>(null);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [previewImage, setPreviewImage] = useState("");
  const [hasAdditionalExpenses, setHasAdditionalExpenses] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const openRequestRef = useRef(0);

  const revealEditor = () => window.setTimeout(() => {
    if (!editorRef.current) return;
    const previousBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    editorRef.current.scrollIntoView({ behavior: "auto", block: "start" });
    window.requestAnimationFrame(() => { document.documentElement.style.scrollBehavior = previousBehavior; });
  }, 120);

  const load = (search = keyword, state = status) => {
    const params = new URLSearchParams();
    if (search) params.set("keyword", search);
    if (state) params.set("status", state);
    return adminFetch<any[]>(`/api/admin/procurement-quotes${params.toString() ? `?${params}` : ""}`).then(setQuotes);
  };
  useEffect(() => {
    load("", "");
    adminFetch<any[]>("/api/admin/operator-options").then(setOperators).catch(() => setOperators([]));
  }, []);

  const setField = (key: string, value: any) => setEdit((current: any) => ({ ...current, [key]: value }));
  const setItem = (index: number, patch: any) => setEdit((current: any) => ({ ...current, items: (current.items || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, ...patch } : item) }));
  const activeRate = (quote = edit, code = quote?.preferred_currency || "USD") => Number(quote?.exchange_rates?.[code] || (code === "CNY" ? 1 : 0));
  const roundedAmount = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  const hydrateQuote = (quote: any) => {
    const rate = activeRate(quote);
    return { ...quote, owner_id: quote.owner_id || quote.created_by_id || null, additional_expenses: quote.additional_expenses || [], items: (quote.items || []).map((item: any) => ({ ...item, _unit_price_foreign: rate ? roundedAmount(Number(item.unit_price_cny || 0) * rate) : 0 })) };
  };
  const fetchRates = async () => adminFetch<any>("/api/admin/procurement-rates/today");
  async function startNewQuote() {
    setSaved(""); setError("");
    try {
      const rateData = await fetchRates();
      const currentOperator = operators.find(item => item.is_current);
      setEdit(hydrateQuote({ ...blankQuote, owner_id: currentOperator?.id || null, items: [{ ...blankItem }], exchange_rates: rateData.rates, rates_date: rateData.rates_date }));
      revealEditor();
    } catch (err: any) { setError(err.message || "今日汇率读取失败"); }
    setHasAdditionalExpenses(false);
  }
  const addItem = () => setEdit((current: any) => ({ ...current, items: [...(current.items || []), { ...blankItem, _unit_price_foreign: 0 }] }));
  const fillExample = () => setEdit((current: any) => hydrateQuote({ ...current, items: [{ ...exampleItem }], first_leg_cost_cny: 65, last_leg_cost_cny: 25 }));
  const removeItem = (index: number) => setEdit((current: any) => ({ ...current, items: (current.items || []).filter((_: any, itemIndex: number) => itemIndex !== index) }));
  const changeQuantity = (index: number, value: string) => {
    setItem(index, { quantity: value });
    setError(value && !/^\d+$/.test(value) ? `第 ${index + 1} 个商品的数量只能输入整数数字` : "");
  };
  const setCnyQuotePrice = (index: number, value: string) => {
    const cny = value === "" ? "" : Math.max(0, Number(value));
    setItem(index, { unit_price_cny: cny, _unit_price_foreign: value === "" ? "" : roundedAmount(Number(cny) * activeRate()) });
  };
  const setForeignQuotePrice = (index: number, value: string) => {
    const rate = activeRate();
    const foreign = value === "" ? "" : Math.max(0, Number(value));
    setItem(index, { _unit_price_foreign: foreign, unit_price_cny: value === "" ? "" : rate ? roundedAmount(Number(foreign) / rate) : 0 });
  };
  const changePreferredCurrency = (code: string) => setEdit((current: any) => {
    const rate = activeRate(current, code);
    return { ...current, preferred_currency: code, items: (current.items || []).map((item: any) => ({ ...item, _unit_price_foreign: rate ? roundedAmount(Number(item.unit_price_cny || 0) * rate) : 0 })) };
  });
  const addExpense = () => { setHasAdditionalExpenses(true); setEdit((current: any) => ({ ...current, additional_expenses: [...(current.additional_expenses || []), { id: crypto.randomUUID(), description: "", amount_cny: 0 }] })); };
  const setExpense = (index: number, patch: any) => setEdit((current: any) => ({ ...current, additional_expenses: (current.additional_expenses || []).map((expense: any, expenseIndex: number) => expenseIndex === index ? { ...expense, ...patch } : expense) }));
  const removeExpense = (index: number) => setEdit((current: any) => ({ ...current, additional_expenses: (current.additional_expenses || []).filter((_: any, expenseIndex: number) => expenseIndex !== index) }));
  const productsTotal = useMemo(() => (edit?.items || []).reduce((sum: number, item: any) => sum + Number(item.unit_price_cny || 0) * quantityValue(item.quantity), 0), [edit]);
  const productCostTotal = useMemo(() => (edit?.items || []).reduce((sum: number, item: any) => sum + Number(item.cost_price_cny || 0) * quantityValue(item.quantity), 0), [edit]);
  const additionalExpenseTotal = useMemo(() => (edit?.additional_expenses || []).reduce((sum: number, expense: any) => sum + Number(expense.amount_cny || 0), 0), [edit]);
  const total = productsTotal + Number(edit?.first_leg_cost_cny || 0) + Number(edit?.last_leg_cost_cny || 0);
  const projectedProfit = total - productCostTotal - Number(edit?.first_leg_cost_cny || 0) - Number(edit?.last_leg_cost_cny || 0) - additionalExpenseTotal;
  const money = (value: any) => `¥${Number(value || 0).toFixed(2)}`;
  const foreignMoney = (value: any, currency = edit?.preferred_currency || "USD") => { try { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: ["JPY", "KRW"].includes(currency) ? 0 : 2 }).format(Number(value || 0)); } catch { return `${currency} ${Number(value || 0).toFixed(2)}`; } };
  const publicUrl = (quote: any) => `https://www.plynook.com/en/procurement/${quote.quote_code}`;

  async function openQuote(quoteId: number) {
    setSaved(""); setError("");
    const requestId = ++openRequestRef.current;
    setOpeningQuoteId(quoteId);
    try {
      let latest = await adminFetch<any>(`/api/admin/procurement-quotes/${quoteId}`);
      if (!Object.keys(latest.exchange_rates || {}).length) {
        const rateData = await fetchRates(); latest = { ...latest, exchange_rates: rateData.rates, rates_date: rateData.rates_date };
      }
      if (requestId !== openRequestRef.current) return;
      setHasAdditionalExpenses(Boolean((latest.additional_expenses || []).length));
      setEdit(hydrateQuote(latest));
      revealEditor();
    } catch (err: any) { setError(err.message || "读取采购单最新数据失败"); }
    finally { if (requestId === openRequestRef.current) setOpeningQuoteId(null); }
  }

  async function refreshQuote() {
    if (!edit?.id) return;
    await openQuote(edit.id);
    setSaved("已同步客户提交的最新数据");
  }

  async function uploadImage(index: number, file?: File) {
    if (!file) return;
    setUploading(index); setError("");
    try {
      const form = new FormData(); form.append("file", file);
      const token = localStorage.getItem("plynook_token") || "";
      const response = await fetch("/api/admin/upload/image", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setItem(index, { image: data.url });
    } catch (err: any) { setError(err.message || "图片上传失败"); }
    finally { setUploading(null); }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaved(""); setError("");
    const activeItems = (edit.items || []).filter((item: any) => item.name || item.image);
    const invalidIndex = activeItems.findIndex((item: any) => !quantityValue(item.quantity));
    if (invalidIndex >= 0) { setError(`第 ${invalidIndex + 1} 个商品的数量必须是大于 0 的整数`); return; }
    setSaving(true);
    try {
      const payload = { ...edit, items: activeItems.map((item: any) => { const { _unit_price_foreign, ...cleanItem } = item; return { ...cleanItem, quantity: quantityValue(item.quantity), cost_price_cny: Math.max(0, Number(item.cost_price_cny || 0)), unit_price_cny: Math.max(0, Number(item.unit_price_cny || 0)), procurement_source_text: String(item.procurement_source_text || "") }; }) };
      const result = await adminFetch<any>(edit.id ? `/api/admin/procurement-quotes/${edit.id}` : "/api/admin/procurement-quotes", { method: edit.id ? "PUT" : "POST", body: JSON.stringify(payload) });
      setSaved(result.status === "published" ? `报价单已发布，汇率已锁定为 ${result.rates_date}` : "采购报价单已保存为草稿");
      setEdit(null);
      await load();
    } catch (err: any) {
      const conflictMessage = String(err.message || "");
      if (edit?.id && (conflictMessage.includes("409") || conflictMessage.includes("采购单已被客户更新"))) {
        try {
          const latest = await adminFetch<any>(`/api/admin/procurement-quotes/${edit.id}`);
          setEdit(latest);
          setError("检测到客户刚提交了新数据，已为您刷新。请核对最新内容后重新保存。");
        } catch { setError("客户已更新采购单，请刷新页面后重新保存"); }
      } else setError(err.message || "保存失败");
    }
    finally { setSaving(false); }
  }

  async function resetPassword() {
    if (!edit?.id || !confirm("重置后客户之前保存的登录状态会失效，确定继续吗？")) return;
    const result = await adminFetch<any>(`/api/admin/procurement-quotes/${edit.id}/reset-password`, { method: "POST" });
    setEdit(result); setSaved("打开密码已重置");
  }
  async function refreshRates() {
    if (!edit?.id) return;
    setSaving(true); setError("");
    try { const result = await adminFetch<any>(`/api/admin/procurement-quotes/${edit.id}/refresh-rates`, { method: "POST" }); setEdit(result); setSaved(`今日汇率已更新并锁定：${result.rates_date}`); }
    catch (err: any) { setError(err.message || "汇率更新失败"); }
    finally { setSaving(false); }
  }
  async function cancelQuote(quote: any) {
    if (quote.status === "cancelled" || !confirm(`确定取消采购报价单 ${quote.quote_code} 吗？`)) return;
    await adminFetch(`/api/admin/procurement-quotes/${quote.id}/cancel`, { method: "POST" }); load();
  }
  async function deleteQuote(quote: any) {
    if (quote.status !== "cancelled") {
      setError(`请先取消采购单 ${quote.quote_code}，取消成功后才能永久删除`);
      return;
    }
    const warning = `确定永久删除已取消的采购单 ${quote.quote_code} 吗？删除后无法恢复。`;
    if (!confirm(warning)) return;
    setDeletingQuoteId(quote.id); setSaved(""); setError("");
    try {
      await adminFetch(`/api/admin/procurement-quotes/${quote.id}`, { method: "DELETE" });
      if (edit?.id === quote.id) setEdit(null);
      setSaved(`采购单 ${quote.quote_code} 已永久删除`);
      await load();
    } catch (err: any) { setError(err.message || "删除采购单失败"); }
    finally { setDeletingQuoteId(null); }
  }
  async function copyShare(quote: any) {
    await navigator.clipboard.writeText(`Hello, here is your cooolmake procurement quotation.\nLink: ${publicUrl(quote)}\nPassword: ${quote.access_password}\nYour login will stay active on this device for 30 days.`);
    setSaved("客户链接和密码已复制");
  }
  async function exportExcel(quote: any) {
    if (!quote?.id) return;
    setExporting(quote.id); setSaved(""); setError("");
    try {
      const token = localStorage.getItem("plynook_token") || "";
      const response = await fetch(`/api/admin/procurement-quotes/${quote.id}/export`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `${quote.quote_code}.xlsx`; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      URL.revokeObjectURL(url);
      setSaved(`采购报价单 ${quote.quote_code} 已导出为 Excel`);
    } catch (err: any) { setError(err.message || "Excel 导出失败"); }
    finally { setExporting(null); }
  }

  return <AdminShell title="商品采购单" actions={<button className="btn btn-primary" onClick={startNewQuote}><Plus size={16} />新增采购单</button>}>
    {saved && <div className="notice success procurement-page-notice">{saved}</div>}
    {edit && <div ref={editorRef} className="panel procurement-editor">
      <div className="admin-header"><div><h2>{edit.id ? `编辑采购单 ${edit.quote_code}` : "新增商品采购单"}</h2><p className="muted">先保存草稿，报价完成后设为“已发布”。发布时会获取并锁定今日全球汇率。</p></div><div className="procurement-editor-head-actions">{edit.id && <button className="btn btn-soft" onClick={refreshQuote}><RefreshCcw size={16} />同步客户数据</button>}<button className="btn btn-soft" onClick={() => setEdit(null)}><X size={18} /></button></div></div>
      <form className="form-grid" onSubmit={save}>
        <div className="wide procurement-owner-assignment"><div><strong>报价单负责人</strong><p>用于区分这张采购单当前由哪位管理员跟进，重新指派不会改变历史创建人。</p></div><label><span>负责管理员</span><select className="field" value={edit.owner_id || ""} onChange={event => setField("owner_id", Number(event.target.value))} required><option value="" disabled>请选择管理员</option>{operators.map(operator => <option key={operator.id} value={operator.id} disabled={!operator.is_active && operator.id !== edit.owner_id}>{operator.label}{operator.role === "super_admin" ? "（超级管理员）" : ""}{operator.is_current ? "（当前账号）" : ""}{!operator.is_active ? "（已禁用）" : ""}</option>)}</select></label></div>
        {edit.quote_code && <div className="wide procurement-share"><div><span>客户访问地址</span><strong>{publicUrl(edit)}</strong><small>打开密码：{edit.access_password} · 登录状态保留 30 天</small></div><button type="button" className="btn btn-soft" onClick={() => copyShare(edit)}><Copy size={15} />复制客户文案</button><button type="button" className="btn btn-soft" disabled={exporting === edit.id} onClick={() => exportExcel(edit)}><Download size={15} />{exporting === edit.id ? "导出中…" : "导出 Excel"}</button><button type="button" className="btn btn-soft" onClick={resetPassword}><RefreshCcw size={15} />重置密码</button></div>}
        {edit.id && <div className="wide procurement-arrival-admin"><div><span>客户预期到货时间</span><strong>{edit.expected_arrival_local ? edit.expected_arrival_local.replace("T", " ") : "客户尚未填写"}</strong><small>{edit.customer_timezone ? `客户当地时区：${edit.customer_timezone}` : "客户填写后会自动识别当地时区"}</small></div><div><span>换算后的中国时间</span><strong>{edit.expected_arrival_china ? `${edit.expected_arrival_china.replace("T", " ")}（北京时间）` : "—"}</strong><small>系统会在客户保存时自动完成换算</small></div></div>}
        <label>报价单标题<input className="field" value={edit.title || ""} onChange={event => setField("title", event.target.value)} /></label>
        <label>客户名称（可选）<input className="field" value={edit.customer_name || ""} onChange={event => setField("customer_name", event.target.value)} /></label>
        <label>报价单状态<select className="field" value={edit.status || "draft"} onChange={event => setField("status", event.target.value)}><option value="draft">草稿（外部不可访问）</option><option value="published">已发布（客户可访问）</option><option value="customer_confirmed">客户已确认</option><option value="cancelled">已取消</option></select></label>
        <label>默认展示币种<select className="field" value={edit.preferred_currency || "USD"} onChange={event => changePreferredCurrency(event.target.value)}>{["USD", "EUR", "GBP", "HKD", "JPY", "KRW", "SGD", "AUD", "CAD", "CNY"].map(code => <option key={code}>{code}</option>)}</select></label>
        <div className="wide procurement-items-editor"><div className="variant-header"><div><strong>采购商品与报价</strong><p className="muted">客户可以添加商品、数量和备注；人民币单价与报价备注仅内部管理员可以编辑。</p></div><div className="procurement-item-tools">{!(edit.items || []).length && <button type="button" className="btn btn-soft" onClick={fillExample}><FileText size={15} />填入示例</button>}<button type="button" className="btn btn-soft" onClick={addItem}><Plus size={15} />添加商品</button></div></div>
          {!(edit.items || []).length && <div className="procurement-example-row procurement-finance-empty"><div><strong>还没有商品</strong><small>可以添加空白商品，或填入带成本、报价和采购来源的示例。</small></div><button type="button" className="btn btn-soft" onClick={fillExample}>使用示例</button></div>}
          <div className="procurement-finance-list">{(edit.items || []).map((item: any, index: number) => { const quantity = quantityValue(item.quantity); const lineQuote = quantity * Number(item.unit_price_cny || 0); const lineCost = quantity * Number(item.cost_price_cny || 0); return <section className="procurement-finance-item" key={item.id || index}>
            <div className="procurement-finance-item-head"><span>商品 {String(index + 1).padStart(2, "0")}</span><div className="procurement-customer-note"><span className={`quote-decision ${item.decision || "pending"}`}>{item.decision === "confirmed" ? "客户已确认" : item.unit_price_cny > 0 ? "等待客户确认" : "待报价"}</span>{item.added_by === "customer" && <small>客户添加</small>}</div><button type="button" className="danger" aria-label={`删除第 ${index + 1} 个商品`} onClick={() => removeItem(index)}><Trash2 size={17} /></button></div>
            <div className="procurement-finance-main">
              <div className="procurement-image-field">{item.image ? <button type="button" className="procurement-image-preview" onClick={() => setPreviewImage(item.image)} aria-label="放大查看商品图片"><img src={item.image} alt="" /><ZoomIn size={16} /></button> : <ImagePlus />}<label>{uploading === index ? "上传中…" : "上传"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => uploadImage(index, event.target.files?.[0])} /></label></div>
              <label>商品名称<input className="field" placeholder="商品名称" value={item.name || ""} onChange={event => setItem(index, { name: event.target.value })} /></label>
              <label>数量<input className="field procurement-quantity-input" type="text" inputMode="numeric" enterKeyHint="done" pattern="[0-9]*" placeholder="数量" value={item.quantity ?? ""} aria-label={`第 ${index + 1} 个商品数量`} onFocus={event => event.currentTarget.select()} onClick={event => event.currentTarget.select()} onInput={event => changeQuantity(index, (event.target as HTMLInputElement).value)} onChange={event => changeQuantity(index, event.target.value)} /></label>
              <label>成本单价（人民币）<input className="field" type="number" min="0" step="0.01" value={item.cost_price_cny ?? 0} onChange={event => setItem(index, { cost_price_cny: event.target.value === "" ? "" : Number(event.target.value) })} /></label>
              <div className="procurement-dual-price"><label>客户报价（人民币）<input className="field" type="number" min="0" step="0.01" value={item.unit_price_cny ?? ""} onChange={event => setCnyQuotePrice(index, event.target.value)} /></label><span>⇄</span><label>客户报价（{edit.preferred_currency || "USD"}）<input className="field" type="number" min="0" step="0.01" value={item._unit_price_foreign ?? 0} disabled={!activeRate()} onChange={event => setForeignQuotePrice(index, event.target.value)} /></label></div>
            </div>
            <div className="procurement-finance-secondary"><label>采购链接 / 采购平台文字<input className="field" type="text" placeholder="可填写 1688 链接、供应商名称或其他采购信息" value={item.procurement_source_text || ""} onChange={event => setItem(index, { procurement_source_text: event.target.value })} /></label><label>给客户的报价备注<textarea className="field" placeholder="给客户展示的报价说明" value={item.admin_note || ""} onChange={event => setItem(index, { admin_note: event.target.value })} /></label><div className="procurement-customer-note"><strong>客户备注</strong><p>{item.customer_note || "暂无客户备注"}</p></div></div>
            <div className="procurement-finance-summary"><span>成本小计 <strong>{money(lineCost)}</strong></span><span>报价小计 <strong>{money(lineQuote)}</strong> <small>≈ {foreignMoney(lineQuote * activeRate())}</small></span><span className="profit">单品利润 <strong>{money(lineQuote - lineCost)}</strong></span></div>
          </section>; })}</div>
          <button type="button" className="procurement-add-line" onClick={addItem}><Plus size={20} />继续添加采购商品</button>
        </div>
        <label>头程运费（人民币）<input className="field" type="number" min="0" step="0.01" value={edit.first_leg_cost_cny ?? 0} onChange={event => setField("first_leg_cost_cny", Number(event.target.value))} /></label>
        <label>尾程运费（人民币）<input className="field" type="number" min="0" step="0.01" value={edit.last_leg_cost_cny ?? 0} onChange={event => setField("last_leg_cost_cny", Number(event.target.value))} /></label>
        <div className="wide procurement-extra-expenses"><label className="procurement-expense-toggle"><input type="checkbox" checked={hasAdditionalExpenses} onChange={event => { const checked = event.target.checked; setHasAdditionalExpenses(checked); if (checked && !(edit.additional_expenses || []).length) addExpense(); if (!checked) setField("additional_expenses", []); }} /><span>是否有额外支出</span></label>{hasAdditionalExpenses && <><div className="procurement-expense-list">{(edit.additional_expenses || []).map((expense: any, index: number) => <div className="procurement-expense-row" key={expense.id || index}><input className="field" placeholder="费用说明，例如包装、手续费" value={expense.description || ""} onChange={event => setExpense(index, { description: event.target.value })} /><input className="field" type="number" min="0" step="0.01" placeholder="金额（人民币）" value={expense.amount_cny ?? 0} onChange={event => setExpense(index, { amount_cny: Number(event.target.value) })} /><button type="button" className="danger" aria-label="删除额外支出" onClick={() => removeExpense(index)}><Trash2 size={16} /></button></div>)}</div><button type="button" className="btn btn-soft" onClick={addExpense}><Plus size={15} />添加一项费用</button></>}</div>
        <div className="wide procurement-total procurement-finance-total"><span>商品报价 {money(productsTotal)}</span><span>商品成本 {money(productCostTotal)}</span><span>运费 {money(Number(edit.first_leg_cost_cny || 0) + Number(edit.last_leg_cost_cny || 0))}</span><span>额外支出 {money(additionalExpenseTotal)}</span><span>客户报价总计 {money(total)} <small>≈ {foreignMoney(total * activeRate())}</small></span><strong className="profit-total">预计总盈利 {money(projectedProfit)}</strong>{edit.rates_date && <small>汇率锁定日期：{edit.rates_date} · {Object.keys(edit.exchange_rates || {}).length} 种币种 · 当前结算币种 {edit.preferred_currency}</small>}</div>
        <label className="wide">后台内部备注（客户不可见）<textarea className="field" value={edit.internal_note || ""} onChange={event => setField("internal_note", event.target.value)} /></label>
        {edit.id && <div className="wide operator-card"><span>创建人：{edit.created_by || "—"}</span><span>最后处理：{edit.updated_by || "—"}</span></div>}
        {error && <div className="error wide">{error}</div>}
        <div className="wide procurement-save-actions"><button className="btn btn-accent" disabled={saving}><Save size={16} />{saving ? "正在保存并获取汇率…" : "保存采购报价单"}</button>{edit.id && <button type="button" className="btn btn-soft" disabled={saving} onClick={refreshRates}><RefreshCcw size={15} />刷新今日汇率</button>}</div>
      </form>
    </div>}
    <div className="panel">
      <form className="admin-product-search" onSubmit={event => { event.preventDefault(); load(); }}><div><strong>搜索采购报价单</strong><p className="muted">支持报价单号、客户名称、标题搜索</p></div><input className="field" value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="例如 PQ20260811" /><select className="field" value={status} onChange={event => { setStatus(event.target.value); load(keyword, event.target.value); }}><option value="">全部状态</option>{Object.entries(statusText).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="btn btn-primary"><Search size={16} />搜索</button></form>
      <table className="table procurement-table"><thead><tr><th>报价单号</th><th>客户 / 标题</th><th>状态</th><th>负责人</th><th>商品数</th><th>人民币总价</th><th>已确认盈利</th><th>汇率日期</th><th>创建人</th><th>最后处理人</th><th>操作</th></tr></thead><tbody>{quotes.map(quote => <tr key={quote.id} className={quote.status === "cancelled" ? "order-row-cancelled" : ""}><td><button className="copy-code" onClick={() => navigator.clipboard.writeText(quote.quote_code)}>{quote.quote_code}<Copy size={13} /></button></td><td><strong>{quote.customer_name || "未填写客户"}</strong><div className="muted">{quote.title}</div></td><td><span className={`procurement-status ${quote.status}`}>{statusText[quote.status] || quote.status}</span></td><td><span className="procurement-owner-pill">{quote.owner || quote.created_by || "未分配"}</span></td><td>{(quote.items || []).length}</td><td>{money(quote.total_cny)}</td><td><strong className="procurement-list-profit">{money(quote.display_profit_cny || 0)}</strong></td><td>{quote.rates_date || "尚未锁定"}</td><td>{quote.created_by || "—"}</td><td>{quote.updated_by || "—"}</td><td><div className="table-actions"><button type="button" className="table-action" disabled={openingQuoteId !== null || deletingQuoteId === quote.id} onClick={() => openQuote(quote.id)}><FileText size={14} />{openingQuoteId === quote.id ? "读取中…" : "编辑报价"}</button><button className="table-action" disabled={exporting === quote.id || deletingQuoteId === quote.id} onClick={() => exportExcel(quote)}><Download size={14} />{exporting === quote.id ? "导出中" : "Excel"}</button>{quote.status === "published" && <button className="table-action table-action-primary" disabled={deletingQuoteId === quote.id} onClick={() => copyShare(quote)}><Copy size={14} />客户文案</button>}{quote.status !== "cancelled" ? <button className="table-action table-action-danger" disabled={deletingQuoteId === quote.id} onClick={() => cancelQuote(quote)}><Ban size={14} />取消</button> : <button className="table-action table-action-danger" disabled={deletingQuoteId === quote.id} onClick={() => deleteQuote(quote)}><Trash2 size={14} />{deletingQuoteId === quote.id ? "删除中…" : "永久删除"}</button>}</div></td></tr>)}</tbody></table>
      {!quotes.length && <div className="empty">还没有采购报价单</div>}
    </div>
    {previewImage && <div className="procurement-lightbox" role="dialog" aria-modal="true" aria-label="商品图片预览" onClick={() => setPreviewImage("")}><button type="button" aria-label="关闭图片预览" onClick={() => setPreviewImage("")}><X size={24} /></button><img src={previewImage} alt="商品大图" onClick={event => event.stopPropagation()} /></div>}
  </AdminShell>;
}
