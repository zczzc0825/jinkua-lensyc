"use client";

import { use, useEffect, useMemo, useState } from "react";
import { CheckCircle2, LockKeyhole, MessageCircle, PackageCheck, Save, Truck } from "lucide-react";
import { Locale } from "@/lib/types";
import { approximatePrice, pricePrefix } from "@/lib/price";

type Copy = {
  title: string;
  subtitle: string;
  password: string;
  unlock: string;
  wrong: string;
  orderInfo: string;
  products: string;
  price: string;
  logistics: string;
  customer: string;
  hidden: string;
  save: string;
  confirm: string;
  confirmed: string;
  paid: string;
  unpaid: string;
  payment: string;
  productCost: string;
  firstCost: string;
  lastCost: string;
  total: string;
  firstLogistics: string;
  lastLogistics: string;
  name: string;
  phone: string;
  address: string;
  country: string;
  province: string;
  city: string;
  district: string;
  detailAddress: string;
  note: string;
  contact: string;
};

const copy: Record<Locale, Copy> = {
  zh: { title: "订单确认", subtitle: "请输入打开密码查看您的商品订单、价格、物流和收货信息。", password: "打开密码", unlock: "查看订单", wrong: "订单号或密码不正确", orderInfo: "订单信息", products: "商品信息", price: "价格信息", logistics: "物流信息", customer: "收货信息", hidden: "您已确认收货信息，个人信息已隐藏。如需修改，请联系客服。", save: "保存修改", confirm: "确认收货信息无误", confirmed: "已确认", paid: "已支付", unpaid: "未支付", payment: "支付方式", productCost: "商品成本价", firstCost: "头程价", lastCost: "尾程价", total: "总价", firstLogistics: "头程物流", lastLogistics: "尾程物流", name: "姓名", phone: "电话", address: "地址", country: "国家", province: "省/州", city: "城市", district: "区/县", detailAddress: "详细地址", note: "备注", contact: "联系客服" },
  en: { title: "Order confirmation", subtitle: "Enter the password to view your products, price, logistics and shipping information.", password: "Password", unlock: "View order", wrong: "Invalid order number or password", orderInfo: "Order information", products: "Products", price: "Price details", logistics: "Logistics", customer: "Shipping information", hidden: "You have confirmed your shipping information. Personal information is now hidden. Please contact support if changes are needed.", save: "Save changes", confirm: "Confirm shipping information", confirmed: "Confirmed", paid: "Paid", unpaid: "Unpaid", payment: "Payment method", productCost: "Product cost", firstCost: "First-leg shipping", lastCost: "Last-leg shipping", total: "Total", firstLogistics: "First-leg logistics", lastLogistics: "Last-leg logistics", name: "Name", phone: "Phone", address: "Address", country: "Country", province: "State / Province", city: "City", district: "District", detailAddress: "Detailed address", note: "Note", contact: "Contact support" },
  ja: { title: "注文確認", subtitle: "パスワードを入力して、商品、価格、物流、配送先情報をご確認ください。", password: "パスワード", unlock: "注文を見る", wrong: "注文番号またはパスワードが正しくありません", orderInfo: "注文情報", products: "商品情報", price: "価格情報", logistics: "物流情報", customer: "配送先情報", hidden: "配送先情報は確認済みです。個人情報は非表示になりました。変更が必要な場合はお問い合わせください。", save: "変更を保存", confirm: "配送先情報を確認する", confirmed: "確認済み", paid: "支払い済み", unpaid: "未払い", payment: "支払い方法", productCost: "商品原価", firstCost: "一次送料", lastCost: "最終送料", total: "合計", firstLogistics: "一次物流", lastLogistics: "最終物流", name: "氏名", phone: "電話", address: "住所", country: "国", province: "都道府県", city: "市区町村", district: "区/郡", detailAddress: "詳細住所", note: "メモ", contact: "問い合わせ" },
  ko: { title: "주문 확인", subtitle: "비밀번호를 입력하여 상품, 가격, 물류 및 배송 정보를 확인하세요.", password: "비밀번호", unlock: "주문 보기", wrong: "주문번호 또는 비밀번호가 올바르지 않습니다", orderInfo: "주문 정보", products: "상품 정보", price: "가격 정보", logistics: "물류 정보", customer: "배송 정보", hidden: "배송 정보가 확인되었습니다. 개인정보는 숨김 처리되었습니다. 수정이 필요한 경우 고객센터로 문의해 주세요.", save: "변경 저장", confirm: "배송 정보 확인", confirmed: "확인됨", paid: "결제 완료", unpaid: "미결제", payment: "결제 방식", productCost: "상품 원가", firstCost: "1차 배송비", lastCost: "최종 배송비", total: "총액", firstLogistics: "1차 물류", lastLogistics: "최종 물류", name: "이름", phone: "전화", address: "주소", country: "국가", province: "주/도", city: "도시", district: "구/군", detailAddress: "상세 주소", note: "메모", contact: "고객센터 문의" },
};

async function publicFetch(path: string, body: object, method = "POST") {
  const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export default function PublicOrderPage({ params }: { params: Promise<{ locale: Locale; code: string }> }) {
  const resolvedParams = use(params);
  const m = copy[resolvedParams.locale] || copy.en;
  const [password, setPassword] = useState("");
  const [order, setOrder] = useState<any | null>(null);
  const [customer, setCustomer] = useState<any>({});
  const [error, setError] = useState("");
  const [available, setAvailable] = useState<"checking" | "yes" | "no">("checking");
  const total = useMemo(() => Number(order?.total_price || 0), [order]);
  const moneyLocale: Locale = resolvedParams.locale === "zh" ? "en" : resolvedParams.locale;
  const money = (value: any) => `${pricePrefix(resolvedParams.locale)} ${approximatePrice(Number(value || 0), moneyLocale)}`;
  const cancelledLabels: Record<Locale, string> = { zh: "已取消", en: "Cancelled", ja: "キャンセル済み", ko: "취소됨" };
  const draftLabels: Record<Locale, string> = { zh: "草稿", en: "Draft", ja: "下書き", ko: "초안" };
  const paymentState = order?.status === "cancelled" ? "cancelled" : order?.status === "draft" ? "draft" : order?.is_paid ? "paid" : "unpaid";
  const paymentLabel = paymentState === "cancelled" ? cancelledLabels[resolvedParams.locale] : paymentState === "draft" ? draftLabels[resolvedParams.locale] : order?.is_paid ? m.paid : m.unpaid;
  useEffect(() => {
    fetch(`/api/public/orders/${resolvedParams.code}/availability`).then(response => setAvailable(response.ok ? "yes" : "no")).catch(() => setAvailable("no"));
  }, [resolvedParams.code]);
  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const data = await publicFetch(`/api/public/orders/${resolvedParams.code}`, { password });
      setOrder(data);
      setCustomer({ customer_name: data.customer_name || "", customer_phone: data.customer_phone || "", customer_country: data.customer_country || "", customer_province: data.customer_province || "", customer_city: data.customer_city || "", customer_district: data.customer_district || "", customer_detail_address: data.customer_detail_address || "", customer_address: data.customer_address || "", customer_note: data.customer_note || "" });
    } catch {
      setError(m.wrong);
    }
  }
  async function saveCustomer(confirm = false) {
    setError("");
    try {
      let data = await publicFetch(`/api/public/orders/${resolvedParams.code}/customer`, { password, ...customer }, "PUT");
      if (confirm) data = await publicFetch(`/api/public/orders/${resolvedParams.code}/confirm-customer`, { password });
      setOrder(data);
      setCustomer({ customer_name: data.customer_name || "", customer_phone: data.customer_phone || "", customer_country: data.customer_country || "", customer_province: data.customer_province || "", customer_city: data.customer_city || "", customer_district: data.customer_district || "", customer_detail_address: data.customer_detail_address || "", customer_address: data.customer_address || "", customer_note: data.customer_note || "" });
    } catch (err: any) {
      setError(err.message || m.wrong);
    }
  }
  if (available === "checking") return <main className="container public-order-page"><section className="public-order-lock"><div className="loading">Loading...</div></section></main>;
  if (available === "no") return <main className="container public-order-page"><section className="public-order-lock"><h1>404</h1><p>This order could not be found.</p></section></main>;
  if (!order) return <main className="container public-order-page"><section className="public-order-lock"><div className="order-lock-icon"><LockKeyhole /></div><span className="eyebrow">Plynook secure order</span><h1>{m.title}</h1><p>{m.subtitle}</p><form onSubmit={unlock}><input className="field" type="password" value={password} placeholder={m.password} onChange={event => setPassword(event.target.value)} /><button className="btn btn-primary">{m.unlock}</button></form>{error && <div className="error">{error}</div>}</section></main>;
  return <main className="container public-order-page">
    <section className="public-order-hero"><span className="eyebrow">Plynook order</span><h1>{m.title}</h1><p>{resolvedParams.code}</p><div className="order-status-row"><span>{order.customer_confirmed ? m.confirmed : m.customer}</span><span className={`public-payment-dot ${paymentState}`}><i />{paymentLabel}</span></div></section>
    <section className="public-order-grid">
      <div className="order-panel wide"><div className="order-panel-title"><PackageCheck /><h2>{m.products}</h2></div><div className="public-order-items">{(order.items || []).map((item: any, index: number) => <div className="public-order-item" key={index}>{item.image && <img src={item.image} alt="" />}<div><strong>{item.title || item.product_code}</strong><p>{item.product_code}</p></div><span>× {item.quantity || 1}</span><b>{money(item.unit_price)}</b></div>)}</div></div>
      <div className="order-panel"><h2>{m.price}</h2><dl className="order-money-list"><div><dt>{m.productCost}</dt><dd>{money(order.product_cost)}</dd></div><div><dt>{m.firstCost}</dt><dd>{money(order.first_leg_cost)}</dd></div><div><dt>{m.lastCost}</dt><dd>{money(order.last_leg_cost)}</dd></div><div className="total"><dt>{m.total}</dt><dd>{money(total)}</dd></div></dl><p className="muted">{m.payment}: {order.payment_method || "—"} · {order.is_paid ? m.paid : m.unpaid}</p></div>
      <div className="order-panel"><div className="order-panel-title"><Truck /><h2>{m.logistics}</h2></div><div className="logistics-card"><strong>{m.firstLogistics}</strong><p>{order.first_logistics_company || "—"}</p><p>{order.first_tracking_no || "—"}</p><small>{order.first_logistics_note}</small></div><div className="logistics-card"><strong>{m.lastLogistics}</strong><p>{order.last_logistics_company || "—"}</p><p>{order.last_tracking_no || "—"}</p><small>{order.last_logistics_note}</small></div></div>
      <div className="order-panel wide"><h2>{m.customer}</h2>{order.customer_confirmed ? <div className="confirmed-hidden"><CheckCircle2 /><p>{m.hidden}</p></div> : <div className="form-grid public-customer-form"><label>{m.name}<input className="field" value={customer.customer_name || ""} onChange={event => setCustomer({ ...customer, customer_name: event.target.value })} /></label><label>{m.phone}<input className="field" value={customer.customer_phone || ""} onChange={event => setCustomer({ ...customer, customer_phone: event.target.value })} /></label><label>{m.country}<input className="field" value={customer.customer_country || ""} onChange={event => setCustomer({ ...customer, customer_country: event.target.value })} /></label><label>{m.province}<input className="field" value={customer.customer_province || ""} onChange={event => setCustomer({ ...customer, customer_province: event.target.value })} /></label><label>{m.city}<input className="field" value={customer.customer_city || ""} onChange={event => setCustomer({ ...customer, customer_city: event.target.value })} /></label><label>{m.district}<input className="field" value={customer.customer_district || ""} onChange={event => setCustomer({ ...customer, customer_district: event.target.value })} /></label><label className="wide">{m.detailAddress}<textarea className="field" value={customer.customer_detail_address || ""} onChange={event => setCustomer({ ...customer, customer_detail_address: event.target.value })} /></label><label className="wide">{m.note}<textarea className="field" value={customer.customer_note || ""} onChange={event => setCustomer({ ...customer, customer_note: event.target.value })} /></label><button className="btn btn-soft" onClick={() => saveCustomer(false)}><Save size={16} />{m.save}</button><button className="btn btn-primary" onClick={() => saveCustomer(true)}><CheckCircle2 size={16} />{m.confirm}</button></div>}{error && <div className="error">{error}</div>}</div>
    </section>
    <a className="mobile-whatsapp public-order-contact" href="https://wa.me/85200000000" aria-label={m.contact}><MessageCircle /></a>
  </main>;
}
