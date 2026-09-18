"use client";

import { use, useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, CheckCircle2, Copy, ImagePlus, LockKeyhole, MessageCircle, PackageSearch, Plus, Save, Trash2, Upload, X, ZoomIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { Locale } from "@/lib/types";
import { copyToClipboard, uuid } from "@/lib/secure";

const copy = { secure: "cooolmake secure sourcing quote", title: "Procurement quotation", subtitle: "Enter your password to view the quote and add anything you would like us to source.", password: "Password", open: "Open quotation", invalid: "Invalid quotation or password", addHint: "Add product photos, quantities, and notes. Your quotation will appear beside each item.", quoteNo: "Quotation number", copied: "Quotation number copied", product: "Product", qty: "Quantity", unitPrice: "Unit price", lineTotal: "Total", note: "Your note", itemTotal: "Item total", waiting: "Waiting for quote", confirm: "Confirm this item", confirmed: "Confirmed", save: "Save this product", saveAll: "Save all products", saveHint: "Save before leaving this page so our team can see your latest product details.", remove: "Remove", first: "First-leg shipping", last: "Last-leg shipping", goods: "Products subtotal", total: "Quotation total", currency: "Currency", rates: "This quotation uses a locked daily exchange rate", addMore: "Add another product", saved: "All product details have been saved", uploaded: "Image uploaded", arrivalTitle: "Expected arrival", arrivalHint: "Choose the date and time in your local time zone. We will automatically convert it to China Standard Time for our team.", arrivalField: "Your local date and time", arrivalSave: "Save expected arrival", arrivalSaved: "Expected arrival saved", confirmAsk: "Accept this item and quotation? Once confirmed, you cannot edit or remove it yourself.", deleteAsk: "Remove this item from the quotation?", contact: "Ask on WhatsApp", source: "Rates by ExchangeRate-API" };
const quantityValue = (value: any) => /^[1-9]\d*$/.test(String(value ?? "").trim()) ? Number(value) : 0;

export default function ProcurementQuotePage({ params }: { params: Promise<{ locale: Locale; code: string }> }) {
  const route = use(params);
  const router = useRouter();
  const m = copy;
  const tokenKey = `plynook_procurement_${route.code}`;
  const currencyKey = `${tokenKey}_currency`;
  const [available, setAvailable] = useState<"checking" | "yes" | "no">("checking");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [quote, setQuote] = useState<any | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [arrivalLocal, setArrivalLocal] = useState("");
  const [customerTimezone, setCustomerTimezone] = useState("UTC");
  const [previewImage, setPreviewImage] = useState("");
  const rates: Record<string, number> = quote?.exchange_rates || {};
  const currencyCodes = useMemo(() => Object.keys(rates).sort((a, b) => a === "USD" ? -1 : b === "USD" ? 1 : a.localeCompare(b)), [quote]);
  const productsTotalCny = useMemo(() => (quote?.items || []).reduce((sum: number, item: any) => sum + Number(item.unit_price_cny || 0) * quantityValue(item.quantity), 0), [quote?.items]);
  const quotationTotalCny = productsTotalCny + Number(quote?.first_leg_cost_cny || 0) + Number(quote?.last_leg_cost_cny || 0);

  useEffect(() => {
    if (route.locale !== "en") router.replace(`/en/procurement/${route.code}`);
  }, [route.locale, route.code, router]);

  useEffect(() => {
    setCustomerTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  }, []);

  useEffect(() => {
    if (quote?.expected_arrival_local) setArrivalLocal(quote.expected_arrival_local.slice(0, 16));
    if (quote?.customer_timezone) setCustomerTimezone(quote.customer_timezone);
  }, [quote?.expected_arrival_local, quote?.customer_timezone]);

  const authFetch = async (path: string, init?: RequestInit, accessToken = token) => {
    const response = await fetch(path, { ...init, headers: { ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }), Authorization: `Bearer ${accessToken}`, ...(init?.headers || {}) } });
    if (!response.ok) throw new Error(await response.text());
    return response.status === 204 ? null : response.json();
  };
  const loadQuote = async (accessToken: string) => {
    try {
      const data = await authFetch(`/api/public/procurement-quotes/${route.code}`, undefined, accessToken);
      setToken(accessToken); setQuote(data); setAvailable("yes");
      const storedCurrency = localStorage.getItem(currencyKey);
      setCurrency(storedCurrency && data.exchange_rates?.[storedCurrency] ? storedCurrency : data.preferred_currency || "USD");
    } catch {
      localStorage.removeItem(tokenKey); setToken(""); setQuote(null);
    }
  };
  useEffect(() => {
    fetch(`/api/public/procurement-quotes/${route.code}/availability`).then(async response => {
      if (!response.ok) { setAvailable("no"); return; }
      setAvailable("yes");
      const stored = localStorage.getItem(tokenKey);
      if (stored) await loadQuote(stored);
    }).catch(() => setAvailable("no"));
  }, [route.code]);

  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy("login"); setError("");
    try {
      const response = await fetch(`/api/public/procurement-quotes/${route.code}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      if (!response.ok) throw new Error();
      const data = await response.json();
      localStorage.setItem(tokenKey, data.access_token); setToken(data.access_token); setQuote(data.quote);
      const preferred = localStorage.getItem(currencyKey) || data.quote.preferred_currency || "USD"; setCurrency(preferred);
    } catch { setError(m.invalid); }
    finally { setBusy(""); }
  }
  const changeCurrency = (code: string) => { setCurrency(code); localStorage.setItem(currencyKey, code); };
  const copyQuoteCode = async () => { await copyToClipboard(quote.quote_code); setError(""); setNotice(m.copied); };
  const money = (valueCny: any) => {
    const value = Number(valueCny || 0) * Number(rates[currency] || 1);
    try { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: ["JPY", "KRW", "VND"].includes(currency) ? 0 : 2 }).format(value); }
    catch { return `${currency} ${value.toFixed(2)}`; }
  };
  const updateLocalItem = (itemId: string, patch: any) => setQuote((current: any) => ({ ...current, items: (current.items || []).map((item: any) => item.id === itemId ? { ...item, ...patch } : item) }));
  const changeQuantity = (itemId: string, value: string) => {
    updateLocalItem(itemId, { quantity: value });
    setError(value && !/^\d+$/.test(value) ? "Quantity must contain whole numbers only." : "");
  };
  const newLocalItem = () => setQuote((current: any) => ({ ...current, items: [...(current.items || []), { id: `new-${uuid()}`, name: "", image: "", quantity: 1, customer_note: "", unit_price_cny: 0, decision: "pending", added_by: "customer", _new: true }] }));

  async function saveItem(item: any) {
    const quantity = quantityValue(item.quantity);
    if (!quantity) { setError("Quantity must be a whole number greater than 0."); setNotice(""); return; }
    setBusy(item.id); setError(""); setNotice("");
    try {
      const body = JSON.stringify({ name: item.name, image: item.image, quantity, customer_note: item.customer_note });
      const data = await authFetch(item._new ? `/api/public/procurement-quotes/${route.code}/items` : `/api/public/procurement-quotes/${route.code}/items/${item.id}`, { method: item._new ? "POST" : "PUT", body });
      setQuote(data); setNotice(m.saved);
    } catch (err: any) { setError(err.message || m.invalid); }
    finally { setBusy(""); }
  }
  async function saveAllItems() {
    const editableItems = (quote?.items || []).filter((item: any) => item.decision !== "confirmed" && (item.name || item.image || item.customer_note));
    if (!editableItems.length) { setError("Please add a product name or photo before saving."); setNotice(""); return; }
    const invalid = editableItems.find((item: any) => !quantityValue(item.quantity));
    if (invalid) { setError("Every quantity must be a whole number greater than 0."); setNotice(""); return; }
    setBusy("save-all"); setError(""); setNotice("");
    try {
      let latest = quote;
      for (const item of editableItems) {
        const body = JSON.stringify({ name: item.name, image: item.image, quantity: quantityValue(item.quantity), customer_note: item.customer_note });
        latest = await authFetch(item._new ? `/api/public/procurement-quotes/${route.code}/items` : `/api/public/procurement-quotes/${route.code}/items/${item.id}`, { method: item._new ? "POST" : "PUT", body });
      }
      setQuote(latest); setNotice(m.saved);
    } catch (err: any) { setError(err.message || m.invalid); }
    finally { setBusy(""); }
  }
  async function deleteItem(item: any) {
    if (!confirm(m.deleteAsk)) return;
    if (item._new) { setQuote((current: any) => ({ ...current, items: current.items.filter((row: any) => row.id !== item.id) })); return; }
    setBusy(item.id);
    try { await authFetch(`/api/public/procurement-quotes/${route.code}/items/${item.id}`, { method: "DELETE" }); await loadQuote(token); }
    catch (err: any) { setError(err.message || m.invalid); }
    finally { setBusy(""); }
  }
  async function confirmItem(item: any) {
    if (!confirm(m.confirmAsk)) return;
    setBusy(item.id); setError("");
    try {
      const data = await authFetch(`/api/public/procurement-quotes/${route.code}/items/${item.id}/decision`, { method: "POST", body: JSON.stringify({ decision: "confirmed" }) });
      setQuote(data); setNotice(m.confirmed);
    } catch (err: any) { setError(err.message || m.invalid); }
    finally { setBusy(""); }
  }
  async function uploadImage(item: any, file?: File) {
    if (!file) return;
    setBusy(`upload-${item.id}`); setError("");
    try {
      const form = new FormData(); form.append("file", file);
      const data = await authFetch(`/api/public/procurement-quotes/${route.code}/upload/image`, { method: "POST", body: form });
      updateLocalItem(item.id, { image: data.url }); setNotice(m.uploaded);
    } catch (err: any) { setError(err.message || m.invalid); }
    finally { setBusy(""); }
  }

  async function saveArrival() {
    if (!arrivalLocal) { setError("Please choose your expected arrival date and time."); return; }
    setBusy("arrival"); setError(""); setNotice("");
    try {
      const data = await authFetch(`/api/public/procurement-quotes/${route.code}/expected-arrival`, { method: "PUT", body: JSON.stringify({ expected_arrival_local: arrivalLocal, customer_timezone: customerTimezone, timezone_offset_minutes: new Date().getTimezoneOffset() }) });
      setQuote(data); setNotice(m.arrivalSaved);
    } catch (err: any) { setError(err.message || m.invalid); }
    finally { setBusy(""); }
  }

  if (route.locale !== "en" || available === "checking") return <main className="procurement-public"><div className="procurement-lock"><div className="loading">Loading…</div></div></main>;
  if (available === "no") return <main className="procurement-public"><div className="procurement-lock"><h1>404</h1><p>This quotation could not be found.</p></div></main>;
  if (!quote) return <main className="procurement-public"><div className="procurement-lock"><div className="procurement-lock-icon"><LockKeyhole /></div><span className="eyebrow">{m.secure}</span><h1>{m.title}</h1><p>{m.subtitle}</p><form onSubmit={login}><input className="field" type="password" value={password} placeholder={m.password} onChange={event => setPassword(event.target.value)} autoFocus /><button className="btn btn-primary" disabled={busy === "login"}>{busy === "login" ? "…" : m.open}</button></form>{error && <div className="error">{error}</div>}<small>Secure access stays active on this device for 30 days.</small></div></main>;

  return <main className="procurement-public">
    <header className="procurement-public-head"><div><span className="eyebrow">cooolmake sourcing</span><button type="button" className="procurement-public-code" onClick={copyQuoteCode}><span>{m.quoteNo}</span><strong>{quote.quote_code}</strong><Copy size={16} /></button><h1>{m.title}</h1><p>{m.addHint}</p></div><label className="procurement-currency"><span>{m.currency}</span><select value={currency} onChange={event => changeCurrency(event.target.value)}>{currencyCodes.map(code => <option key={code} value={code}>{code}</option>)}</select><small>{m.rates}: {quote.rates_date}</small></label></header>
    <section className="procurement-arrival"><div className="procurement-arrival-copy"><span className="procurement-arrival-icon"><CalendarClock /></span><div><h2>{m.arrivalTitle}</h2><p>{m.arrivalHint}</p></div></div><div className="procurement-arrival-form"><label>{m.arrivalField}<input className="field" type="datetime-local" value={arrivalLocal} onInput={event => { setArrivalLocal((event.target as HTMLInputElement).value); setError(""); }} onChange={event => { setArrivalLocal(event.target.value); setError(""); }} /></label><button className="btn btn-primary" disabled={busy === "arrival"} onClick={saveArrival}><Save size={15} />{busy === "arrival" ? "Saving…" : m.arrivalSave}</button></div><div className="procurement-arrival-meta"><span>Detected time zone: <strong>{customerTimezone}</strong></span>{quote.expected_arrival_china && <span>cooolmake reference: <strong>{quote.expected_arrival_china.replace("T", " ")} China Standard Time</strong></span>}</div></section>
    <section className="procurement-public-summary"><div><PackageSearch /><span>{m.goods}</span><strong>{money(productsTotalCny)}</strong></div><div><span>{m.first}</span><strong>{money(quote.first_leg_cost_cny)}</strong></div><div><span>{m.last}</span><strong>{money(quote.last_leg_cost_cny)}</strong></div><div className="grand"><span>{m.total}</span><strong>{money(quotationTotalCny)}</strong></div></section>
    {(notice || error) && <div className={`procurement-toast ${error ? "failed" : ""}`}>{error || notice}</div>}
    <section className="procurement-public-items">
      <div className="procurement-mobile-table-head"><span>{m.product}</span><span>{m.qty}</span><span>{m.unitPrice}</span><span>{m.lineTotal}</span></div>
      {(quote.items || []).map((item: any, index: number) => { const confirmed = item.decision === "confirmed"; const quoted = Number(item.unit_price_cny || 0) > 0; return <article className={`procurement-public-item ${confirmed ? "confirmed" : ""}`} key={item.id}>
        <div className="procurement-item-number">{String(index + 1).padStart(2, "0")}</div>
        <div className="procurement-public-image">{item.image ? <button type="button" className="procurement-image-preview" onClick={() => setPreviewImage(item.image)} aria-label="View larger product image"><img src={item.image} alt="" /><ZoomIn size={18} /></button> : <ImagePlus />} {!confirmed && <label><Upload size={15} />{busy === `upload-${item.id}` ? "…" : "Photo"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => uploadImage(item, event.target.files?.[0])} /></label>}</div>
        <div className="procurement-public-fields"><label>{m.product}<input className="field" value={item.name || ""} disabled={confirmed} onChange={event => updateLocalItem(item.id, { name: event.target.value })} /></label><label>{m.qty}<input className="field procurement-quantity-input" type="text" inputMode="numeric" enterKeyHint="done" pattern="[0-9]*" placeholder="1" value={item.quantity ?? ""} disabled={confirmed} onFocus={event => event.currentTarget.select()} onClick={event => event.currentTarget.select()} onInput={event => changeQuantity(item.id, (event.target as HTMLInputElement).value)} onChange={event => changeQuantity(item.id, event.target.value)} /></label><label className="wide">{m.note}<textarea className="field" value={item.customer_note || ""} disabled={confirmed} onChange={event => updateLocalItem(item.id, { customer_note: event.target.value })} /></label></div>
        <div className="procurement-public-price"><span>{quoted ? m.itemTotal : m.waiting}</span>{quoted && <><strong className="procurement-line-price">{money(Number(item.unit_price_cny) * quantityValue(item.quantity))}</strong><strong className="procurement-mobile-unit-price">{money(item.unit_price_cny)}</strong><small>{quantityValue(item.quantity) || "—"} × {money(item.unit_price_cny)} = {money(Number(item.unit_price_cny) * quantityValue(item.quantity))}</small><em>Price set by cooolmake · view only</em></>}</div>
        <div className="procurement-mobile-line-total"><strong>{quoted ? money(Number(item.unit_price_cny) * quantityValue(item.quantity)) : "—"}</strong></div>
        <div className="procurement-public-actions">{confirmed ? <span className="confirmed-pill"><CheckCircle2 />{m.confirmed}</span> : <><button className="btn btn-soft" disabled={busy === item.id} onClick={() => saveItem(item)}><Save size={15} />{m.save}</button>{quoted && !item._new && <button className="btn btn-primary" disabled={busy === item.id} onClick={() => confirmItem(item)}><Check size={15} />{m.confirm}</button>}<button className="btn procurement-remove" disabled={busy === item.id} onClick={() => deleteItem(item)}><Trash2 size={15} />{m.remove}</button></>}</div>
      </article>; })}
      <button className="procurement-public-add" onClick={newLocalItem}><Plus size={26} /><span>{m.addMore}</span></button>
    </section>
    <section className="procurement-public-save-all"><div><strong>{m.saveAll}</strong><p>{m.saveHint}</p></div><button className="btn btn-primary" disabled={busy === "save-all"} onClick={saveAllItems}><Save size={18} />{busy === "save-all" ? "Saving…" : m.saveAll}</button></section>
    <footer className="procurement-public-footer"><span>{m.source}</span><a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">ExchangeRate-API</a><a className="btn btn-primary" href="https://wa.me/85200000000"><MessageCircle size={17} />{m.contact}</a></footer>
    {previewImage && <div className="procurement-lightbox" role="dialog" aria-modal="true" aria-label="Product image preview" onClick={() => setPreviewImage("")}><button type="button" aria-label="Close image preview" onClick={() => setPreviewImage("")}><X size={24} /></button><img src={previewImage} alt="Product image" onClick={event => event.stopPropagation()} /></div>}
  </main>;
}
