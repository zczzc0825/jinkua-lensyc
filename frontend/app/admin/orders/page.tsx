"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Plus, RefreshCcw, Save, Search, Trash2, X } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { adminFetch } from "@/lib/api";

const blankItem = { product_code: "", title: "", image: "", quantity: 1, unit_price: 0 };
const blankOrder: any = {
  locale: "zh",
  status: "pending_confirm",
  items: [{ ...blankItem }],
  payment_method: "WhatsApp 确认",
  is_paid: false,
  customer_name: "",
  customer_phone: "",
  customer_country: "",
  customer_province: "",
  customer_city: "",
  customer_district: "",
  customer_detail_address: "",
  customer_address: "",
  customer_note: "",
  product_cost: 0,
  first_leg_cost: 0,
  last_leg_cost: 0,
  total_price: 0,
  currency: "CNY",
  first_logistics_company: "",
  first_tracking_no: "",
  first_logistics_note: "",
  last_logistics_company: "",
  last_tracking_no: "",
  last_logistics_note: "",
  admin_note: "",
};
const statusText: Record<string, string> = { draft: "草稿", pending_confirm: "待客户确认", customer_confirmed: "客户已确认", paid: "已支付", shipped: "已发货", completed: "已完成", cancelled: "已取消" };
const copyText: Record<string, (order: any, url: string) => string> = {
  zh: (order, url) => `您好，这是您的 cooolmake 商品订单确认页。\n订单号：${order.order_code}\n订单链接：${url}\n打开密码：${order.access_password}\n\n请妥善保管好信息。如遗忘密码，可以通过订单号或付款记录联系客服获取订单页信息。详情页包含您的个人信息、电话和地址，请您确认；确认后个人信息将隐藏且无法再次自行修改，如需修改请联系客服。`,
  en: (order, url) => `Hello, this is your cooolmake order confirmation page.\nOrder No.: ${order.order_code}\nOrder link: ${url}\nPassword: ${order.access_password}\n\nPlease keep this information safe. If you forget the password, contact us with your order number or payment record. The page contains your personal information, phone number and address. Please confirm carefully; after confirmation, personal information will be hidden and cannot be edited by yourself. Please contact customer service if changes are needed.`,
  ja: (order, url) => `こんにちは。こちらは cooolmake のご注文確認ページです。\n注文番号：${order.order_code}\nリンク：${url}\nパスワード：${order.access_password}\n\n情報を大切に保管してください。パスワードを忘れた場合は、注文番号または支払い記録でお問い合わせください。ページにはお名前、電話番号、住所が含まれます。確認後、個人情報は非表示となり、ご自身では変更できません。変更が必要な場合はカスタマーサービスへご連絡ください。`,
  ko: (order, url) => `안녕하세요. cooolmake 주문 확인 페이지입니다.\n주문번호: ${order.order_code}\n주문 링크: ${url}\n비밀번호: ${order.access_password}\n\n해당 정보를 안전하게 보관해 주세요. 비밀번호를 잊으신 경우 주문번호 또는 결제 기록으로 고객센터에 문의해 주세요. 페이지에는 개인정보, 전화번호, 주소가 포함되어 있습니다. 확인 후 개인정보는 숨김 처리되며 직접 수정할 수 없습니다. 수정이 필요한 경우 고객센터로 문의해 주세요.`,
};

export default function OrdersPage() {
  const [items, setItems] = useState<any[]>([]);
  const [edit, setEdit] = useState<any | null>(null);
  const [keyword, setKeyword] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState("");
  const [copyLocale, setCopyLocale] = useState("zh");
  const productRowsTotal = useMemo(() => (edit?.items || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0), [edit]);
  const calculatedTotal = useMemo(() => Number(edit?.product_cost || 0) + Number(edit?.first_leg_cost || 0) + Number(edit?.last_leg_cost || 0), [edit]);
  const load = (search = keyword, payment = paymentFilter) => {
    const params = new URLSearchParams();
    if (search) params.set("keyword", search);
    if (payment) params.set("payment", payment);
    return adminFetch<any[]>(`/api/admin/orders${params.toString() ? `?${params}` : ""}`).then(setItems);
  };
  useEffect(() => {
    const initialKeyword = new URLSearchParams(window.location.search).get("keyword") || "";
    if (initialKeyword) setKeyword(initialKeyword);
    load(initialKeyword, "");
  }, []);
  const setField = (key: string, value: any) => setEdit((current: any) => ({ ...current, [key]: value }));
  const setItem = (index: number, patch: any) => setEdit((current: any) => ({ ...current, items: current.items.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, ...patch } : item) }));
  const addItem = () => setEdit((current: any) => ({ ...current, items: [...(current.items || []), { ...blankItem }] }));
  const removeItem = (index: number) => setEdit((current: any) => ({ ...current, items: current.items.filter((_: any, itemIndex: number) => itemIndex !== index) }));
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaved("");
    setSaving(true);
    try {
      const body = { ...edit, total_price: Number(edit.total_price || calculatedTotal), items: (edit.items || []).filter((item: any) => item.title || item.product_code) };
      const saved = await adminFetch<any>(edit.id ? `/api/admin/orders/${edit.id}` : "/api/admin/orders", { method: edit.id ? "PUT" : "POST", body: JSON.stringify(body) });
      setEdit(saved);
      load(keyword, paymentFilter);
      setSaved("订单已保存成功");
      setTimeout(() => setSaved(""), 2200);
    } catch (err: any) {
      setError(err.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }
  async function cancelOrder(order: any) {
    if (order.status === "cancelled") return;
    if (!confirm(`订单创建后不可删除，只能取消。\n确定取消订单 ${order.order_code} 吗？`)) return;
    await adminFetch(`/api/admin/orders/${order.id}/cancel`, { method: "POST" });
    load(keyword, paymentFilter);
  }
  async function resetPassword(order: any) {
    if (!confirm("确定重置打开密码吗？旧密码会失效。")) return;
    const updated = await adminFetch<any>(`/api/admin/orders/${order.id}/reset-password`, { method: "POST" });
    setEdit(updated);
    load(keyword, paymentFilter);
  }
  function paymentState(order: any) {
    if (order.status === "cancelled") return { className: "cancelled", label: "已取消" };
    if (order.status === "draft") return { className: "draft", label: "草稿" };
    if (order.is_paid) return { className: "paid", label: "已付款" };
    return { className: "unpaid", label: "未付款" };
  }
  function orderUrl(order: any, locale = copyLocale) {
    return `https://www.plynook.com/${locale}/order/${order.order_code}`;
  }
  async function copyMessage(order: any) {
    const locale = copyLocale in copyText ? copyLocale : "zh";
    await navigator.clipboard.writeText(copyText[locale](order, orderUrl(order, locale)));
    setCopied(order.order_code);
    setTimeout(() => setCopied(""), 1800);
  }
  const money = (value: any) => `¥${Number(value || 0).toFixed(2)}`;
  const displayMoney = (order: any) => order.status === "cancelled" ? "—" : money(order.total_price);
  const displayPayment = (order: any) => order.status === "cancelled" ? "—" : order.is_paid ? "已支付" : "未支付";
  const displayPaymentMethod = (order: any) => order.status === "cancelled" ? "订单已取消" : order.payment_method || "—";
  const displayConfirm = (order: any) => order.status === "cancelled" ? "—" : order.customer_confirmed ? "已确认" : "待确认";
  const displayTracking = (order: any, value: any) => order.status === "cancelled" ? "—" : value || "—";

  return <AdminShell title="订单管理">
    {edit && <div className="panel order-editor">
      <div className="admin-header"><div><h2>{edit.id ? `编辑订单 ${edit.order_code}` : "新增订单确认页"}</h2><p className="muted">生成后复制 WhatsApp 文案发给客户，客户输入密码确认信息。</p></div><button className="btn btn-soft" onClick={() => setEdit(null)}><X /></button></div>
      <form className="form-grid" onSubmit={save}>
        {edit.order_code && <div className="wide order-share-box"><div><span>订单链接</span><strong>{orderUrl(edit, edit.locale || "zh")}</strong><small>打开密码：{edit.access_password}</small></div><button type="button" className="btn btn-soft" onClick={() => navigator.clipboard.writeText(orderUrl(edit, edit.locale || "zh"))}><Copy size={15} />复制链接</button><button type="button" className="btn btn-soft" onClick={() => resetPassword(edit)}><RefreshCcw size={15} />重置密码</button></div>}
        <label>订单语言<select className="field" value={edit.locale || "zh"} onChange={event => setField("locale", event.target.value)}><option value="zh">中文</option><option value="en">English</option><option value="ja">日本語</option><option value="ko">한국어</option></select></label>
        <label>订单状态<select className="field" value={edit.status || "pending_confirm"} onChange={event => setField("status", event.target.value)}>{Object.entries(statusText).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>支付方式<input className="field" value={edit.payment_method || ""} onChange={event => setField("payment_method", event.target.value)} /></label>
        <label style={{ flexDirection: "row", alignItems: "center" }}><input type="checkbox" checked={!!edit.is_paid} onChange={event => setField("is_paid", event.target.checked)} />是否已支付</label>
        <div className="wide order-items-editor"><div className="variant-header"><div><strong>商品信息</strong><p className="muted">填写发给客户确认的商品信息。</p></div><button type="button" className="btn btn-soft" onClick={addItem}><Plus size={15} />添加商品</button></div>{(edit.items || []).map((item: any, index: number) => <div className="order-item-row" key={index}><input className="field" placeholder="商品 ID" value={item.product_code || ""} onChange={event => setItem(index, { product_code: event.target.value })} /><input className="field" placeholder="商品名称" value={item.title || ""} onChange={event => setItem(index, { title: event.target.value })} /><input className="field" placeholder="图片地址" value={item.image || ""} onChange={event => setItem(index, { image: event.target.value })} /><input className="field" type="number" min="1" placeholder="数量" value={item.quantity ?? 1} onChange={event => setItem(index, { quantity: Number(event.target.value) })} /><input className="field" type="number" min="0" placeholder="单价" value={item.unit_price ?? 0} onChange={event => setItem(index, { unit_price: Number(event.target.value) })} /><button type="button" className="danger" onClick={() => removeItem(index)}><Trash2 size={17} /></button></div>)}</div>
        <label>商品成本价<input className="field" type="number" value={edit.product_cost ?? 0} onChange={event => setField("product_cost", Number(event.target.value))} /></label>
        <label>头程价<input className="field" type="number" value={edit.first_leg_cost ?? 0} onChange={event => setField("first_leg_cost", Number(event.target.value))} /></label>
        <label>尾程价<input className="field" type="number" value={edit.last_leg_cost ?? 0} onChange={event => setField("last_leg_cost", Number(event.target.value))} /></label>
        <label>总价<input className="field" type="number" value={edit.total_price ?? calculatedTotal} onChange={event => setField("total_price", Number(event.target.value))} /><small className="muted">按成本+头程+尾程计算：{money(calculatedTotal)}；商品行小计：{money(productRowsTotal)}</small></label>
        <label>客户姓名<input className="field" value={edit.customer_name || ""} onChange={event => setField("customer_name", event.target.value)} disabled={!!edit.customer_confirmed} /></label>
        <label>客户电话<input className="field" value={edit.customer_phone || ""} onChange={event => setField("customer_phone", event.target.value)} disabled={!!edit.customer_confirmed} /></label>
        <div className="wide structured-address"><strong>收货地址</strong><div className="address-grid"><label>国家<input className="field" value={edit.customer_country || ""} onChange={event => setField("customer_country", event.target.value)} disabled={!!edit.customer_confirmed} placeholder="例如 中国 / United States" /></label><label>省/州<input className="field" value={edit.customer_province || ""} onChange={event => setField("customer_province", event.target.value)} disabled={!!edit.customer_confirmed} /></label><label>城市<input className="field" value={edit.customer_city || ""} onChange={event => setField("customer_city", event.target.value)} disabled={!!edit.customer_confirmed} /></label><label>区/县<input className="field" value={edit.customer_district || ""} onChange={event => setField("customer_district", event.target.value)} disabled={!!edit.customer_confirmed} /></label><label className="wide">详细地址<textarea className="field" value={edit.customer_detail_address || ""} onChange={event => setField("customer_detail_address", event.target.value)} disabled={!!edit.customer_confirmed} /></label></div></div>
        <label className="wide">客户备注<textarea className="field" value={edit.customer_note || ""} onChange={event => setField("customer_note", event.target.value)} disabled={!!edit.customer_confirmed} /></label>
        <label>头程物流公司<input className="field" value={edit.first_logistics_company || ""} onChange={event => setField("first_logistics_company", event.target.value)} /></label>
        <label>头程单号<input className="field" value={edit.first_tracking_no || ""} onChange={event => setField("first_tracking_no", event.target.value)} /></label>
        <label className="wide">头程物流信息<textarea className="field" value={edit.first_logistics_note || ""} onChange={event => setField("first_logistics_note", event.target.value)} /></label>
        <label>尾程物流公司<input className="field" value={edit.last_logistics_company || ""} onChange={event => setField("last_logistics_company", event.target.value)} /></label>
        <label>尾程单号<input className="field" value={edit.last_tracking_no || ""} onChange={event => setField("last_tracking_no", event.target.value)} /></label>
        <label className="wide">尾程物流信息<textarea className="field" value={edit.last_logistics_note || ""} onChange={event => setField("last_logistics_note", event.target.value)} /></label>
        <label className="wide">后台备注<textarea className="field" value={edit.admin_note || ""} onChange={event => setField("admin_note", event.target.value)} /></label>
        {edit.customer_confirmed && <div className="notice wide">客户已确认地址，前台个人信息已隐藏，后台仍可查看和处理。</div>}
        {saved && <div className="notice success wide">{saved}</div>}
        {error && <div className="error wide">{error}</div>}
        <button className="btn btn-accent" disabled={saving}><Save size={16} />{saving ? "保存中..." : "保存订单"}</button>
      </form>
      {edit.order_code && <div className="order-copy-panel"><div><strong>复制给客户的 WhatsApp 文案</strong><p className="muted">选择对应语言后复制发送给客户。</p></div><select className="field" value={copyLocale} onChange={event => setCopyLocale(event.target.value)}><option value="zh">中文</option><option value="en">English</option><option value="ja">日本語</option><option value="ko">한국어</option></select><button className="btn btn-primary" onClick={() => copyMessage(edit)}><Copy size={16} />{copied === edit.order_code ? "已复制" : "复制文案"}</button><pre>{copyText[copyLocale in copyText ? copyLocale : "zh"](edit, orderUrl(edit, copyLocale))}</pre></div>}
    </div>}
    <div className="panel">
      <form className="admin-product-search" onSubmit={event => { event.preventDefault(); load(keyword, paymentFilter); }}><div><strong>搜索订单</strong><p className="muted">订单从商品管理里点击“生成订单”创建；这里按订单号、客户姓名、电话搜索。</p></div><input className="field" value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="例如 PO20260810" /><button className="btn btn-primary"><Search size={16} />搜索</button>{keyword && <button type="button" className="btn btn-soft" onClick={() => { setKeyword(""); load("", paymentFilter); }}>清除</button>}</form>
      <div className="order-filter-bar"><button className={!paymentFilter ? "active" : ""} onClick={() => { setPaymentFilter(""); load(keyword, ""); }}>全部订单</button><button className={paymentFilter === "paid" ? "active paid" : "paid"} onClick={() => { setPaymentFilter("paid"); load(keyword, "paid"); }}>已付款</button><button className={paymentFilter === "unpaid" ? "active unpaid" : "unpaid"} onClick={() => { setPaymentFilter("unpaid"); load(keyword, "unpaid"); }}>未付款</button></div>
      <table className="table"><thead><tr><th>订单号</th><th>状态</th><th>商品</th><th>总价</th><th>支付</th><th>客户确认</th><th>物流</th><th>创建人</th><th>最后处理人</th><th>操作</th></tr></thead><tbody>{items.map(order => { const state = paymentState(order); const isCancelled = order.status === "cancelled"; return <tr key={order.id} className={isCancelled ? "order-row-cancelled" : ""}><td><button className="copy-code" onClick={() => navigator.clipboard.writeText(order.order_code)}>{order.order_code}<Copy size={13} /></button></td><td><span className={`order-state-dot ${state.className}`}><i />{state.label}</span></td><td>{(order.items || []).slice(0, 2).map((item: any) => <div key={`${order.id}-${item.product_code}-${item.title}`}>{item.product_code} · {item.title} × {item.quantity}</div>)}</td><td>{displayMoney(order)}</td><td>{displayPayment(order)}<div className="muted">{displayPaymentMethod(order)}</div></td><td>{displayConfirm(order)}</td><td><div>头程：{displayTracking(order, order.first_tracking_no)}</div><div>尾程：{displayTracking(order, order.last_tracking_no)}</div></td><td>{order.created_by || "—"}</td><td>{order.updated_by || "—"}</td><td><div className="table-actions"><button className="table-action" onClick={() => setEdit(order)}>编辑</button><button className="table-action table-action-primary" onClick={() => copyMessage(order)}><Copy size={14} />文案</button><button className="table-action table-action-danger" disabled={isCancelled} onClick={() => cancelOrder(order)}>{isCancelled ? "已取消" : "取消"}</button></div></td></tr>; })}</tbody></table>
      {items.length === 0 && <div className="empty">没有找到订单</div>}
    </div>
  </AdminShell>;
}
