"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ClipboardList, Copy, ExternalLink, GripVertical, Plus, Save, Search, Trash2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { adminFetch } from "@/lib/api";
import { copyToClipboard, uuid } from "@/lib/secure";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const blank: any = {
  sku: "", slug: "", status: "draft", category_id: null, tag_ids: [], main_image: "", gallery_images: [], detail_images: [], video_url: "",
  price: null, show_price: true, is_free_shipping: false, stock_quantity: 0, color_variants: [], source_platform: "1688", source_url: "",
  title_zh: "", title_en: "", short_description_zh: "", short_description_en: "", description_zh: "", description_en: "",
  features_zh: [], features_en: [], material: "", size: "", package_info: "", usage_scene: "", weight: "", auto_translate: true,
  is_featured: false, is_new: false, is_best_seller: false, sort_order: 0, allow_whatsapp: true, stock_status: "in_stock", price_mode: "uniform",
};
const hasVariantPrices = (product: any) => (product?.color_variants || []).some((variant: any) => variant.price != null && variant.price !== "");
const priceModeOf = (product: any) => (hasVariantPrices(product) ? "per_variant" : "uniform");
const priceCellText = (product: any) => {
  const prices = (product.color_variants || []).map((variant: any) => variant.price).filter((price: any) => price != null).map(Number);
  if (prices.length) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? `¥${min.toFixed(2)}` : `¥${min.toFixed(2)} ~ ¥${max.toFixed(2)}`;
  }
  return product.price != null ? `¥${Number(product.price).toFixed(2)}` : "未设置";
};
const statusText: Record<string, string> = { draft: "草稿", published: "已上架", archived: "已归档", sold_out: "已售罄", coming_soon: "即将上架" };
const sourceText: Record<string, string> = { "1688": "1688", douyin: "抖音", taobao: "淘宝", other: "其他" };
type UploadProgress = { active: boolean; percent: number; fileName: string; message: string; error?: string };

async function compressImageForUpload(file: File) {
  if (!file.type.startsWith("image/") || file.type === "image/webp") return file;
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("图片读取失败，请重新选择图片"));
      img.src = imageUrl;
    });
    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", 0.84));
    if (!blob || blob.size >= file.size) return file;
    const safeName = file.name.replace(/\.[^.]+$/, "") || "product-image";
    return new File([blob], `${safeName}.webp`, { type: "image/webp", lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export default function Products() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [edit, setEdit] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const [videoUpload, setVideoUpload] = useState<UploadProgress>({ active: false, percent: 0, fileName: "", message: "" });
  const [imageUploads, setImageUploads] = useState<Record<string, UploadProgress>>({});
  const [keyword, setKeyword] = useState("");
  const [trafficProduct, setTrafficProduct] = useState<any | null>(null);
  const [trafficData, setTrafficData] = useState<any | null>(null);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [draggingImage, setDraggingImage] = useState<{ key: "gallery_images" | "detail_images"; index: number } | null>(null);
  const saveLockRef = useRef(false);
  const load = (search = "") => Promise.all([adminFetch<any[]>(`/api/admin/products${search ? `?keyword=${encodeURIComponent(search)}` : ""}`), adminFetch<any[]>("/api/admin/categories"), adminFetch<any[]>("/api/admin/tags")]).then(([products, categoryItems, tagItems]) => { setItems(products); setCategories(categoryItems); setTags(tagItems); });
  useEffect(() => { load(); }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saveLockRef.current) return;
    saveLockRef.current = true;
    setError("");
    setSaved("");
    setSaving(true);
    try {
      const { _create_request_id, price_mode, ...editableProduct } = edit;
      const perVariantPrice = price_mode === "per_variant";
      const body = {
        ...editableProduct,
        category_id: edit.category_id ? Number(edit.category_id) : null,
        tag_ids: edit.tag_ids || edit.tags?.map((tag: any) => tag.id) || [],
        gallery_images: (edit.gallery_images || []).filter(Boolean),
        detail_images: (edit.detail_images || []).filter(Boolean),
        features_zh: typeof edit.features_zh === "string" ? edit.features_zh.split("\n").filter(Boolean) : edit.features_zh || [],
        color_variants: (edit.color_variants || []).map((variant: any) => {
          const next = { ...variant, stock_quantity: Number(variant.stock_quantity || 0) };
          if (perVariantPrice) next.price = variant.price === "" || variant.price == null ? null : Number(variant.price);
          else delete next.price;
          return next;
        }),
        stock_quantity: Number(edit.stock_quantity || 0),
      };
      const savedProduct = await adminFetch<any>(edit.id ? `/api/admin/products/${edit.id}` : "/api/admin/products", {
        method: edit.id ? "PUT" : "POST",
        headers: edit.id ? undefined : { "X-Idempotency-Key": _create_request_id },
        body: JSON.stringify(body),
      });
      setEdit({ ...savedProduct, auto_translate: true, tag_ids: savedProduct.tags?.map((tag: any) => tag.id) || [], price_mode: perVariantPrice ? "per_variant" : "uniform" });
      setSaved(savedProduct.status === "published" ? "商品已保存并发布成功" : "商品已保存成功");
      await load(keyword);
      setTimeout(() => setSaved(""), 2600);
    } catch (saveError: any) {
      setError(saveError.message || "保存失败，请稍后重试");
    } finally {
      saveLockRef.current = false;
      setSaving(false);
    }
  }

  function uploadFile(file: File, type: "image" | "video", onProgress?: (percent: number) => void) {
    return new Promise<string>((resolve, reject) => {
      const form = new FormData();
      form.append("file", file);
      const token = localStorage.getItem("plynook_token");
      const request = new XMLHttpRequest();
      request.open("POST", `/api/admin/upload/${type}`);
      if (token) request.setRequestHeader("Authorization", `Bearer ${token}`);
      request.upload.onprogress = event => {
        if (event.lengthComputable && onProgress) onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      };
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) {
          try {
            resolve(JSON.parse(request.responseText).url as string);
          } catch {
            reject(new Error("上传成功但返回数据格式不正确"));
          }
          return;
        }
        reject(new Error(request.responseText || "上传失败，请检查文件格式或大小"));
      };
      request.onerror = () => reject(new Error("网络异常，上传失败"));
      request.ontimeout = () => reject(new Error("上传超时，请稍后重试"));
      request.timeout = type === "video" ? 10 * 60 * 1000 : 2 * 60 * 1000;
      request.send(form);
    });
  }
  const setImageUpload = (key: string, progress: UploadProgress) => setImageUploads(current => ({ ...current, [key]: progress }));
  const clearImageUploadLater = (key: string) => window.setTimeout(() => setImageUploads(current => {
    const next = { ...current };
    delete next[key];
    return next;
  }), 1800);
  const progressCard = (progress?: UploadProgress) => progress?.active ? <div className={`upload-progress-card ${progress.error ? "failed" : progress.percent === 100 ? "done" : ""}`}>
    <div className="upload-progress-head"><span>{progress.fileName || "上传文件"}</span><strong>{progress.percent}%</strong></div>
    <div className="upload-progress-track"><i style={{ width: `${progress.percent}%` }} /></div>
    <p>{progress.error || progress.message}</p>
  </div> : null;

  async function handleUpload(file: File | undefined, type: "image" | "video", apply: (url: string) => void, uploadKey = "image") {
    if (!file) return;
    setError("");
    let uploadFilePayload = file;
    if (type === "video") {
      setVideoUpload({ active: true, percent: 0, fileName: file.name, message: "准备上传视频…" });
    } else {
      setImageUpload(uploadKey, { active: true, percent: 0, fileName: file.name, message: "正在压缩图片…" });
      uploadFilePayload = await compressImageForUpload(file);
    }
    try {
      const url = await uploadFile(uploadFilePayload, type, percent => {
        if (type === "video") setVideoUpload({ active: true, percent, fileName: file.name, message: percent >= 99 ? "正在保存，请稍候…" : "视频上传中…" });
        else setImageUpload(uploadKey, { active: true, percent, fileName: uploadFilePayload.name, message: percent >= 99 ? "正在保存，请稍候…" : "图片上传中…" });
      });
      apply(url);
      if (type === "video") setVideoUpload({ active: true, percent: 100, fileName: file.name, message: "视频上传完成" });
      else {
        setImageUpload(uploadKey, { active: true, percent: 100, fileName: uploadFilePayload.name, message: "图片上传完成" });
        clearImageUploadLater(uploadKey);
      }
    } catch (uploadError: any) {
      const message = uploadError.message || "上传失败，请检查文件格式或大小";
      if (type === "video") setVideoUpload(current => ({ ...current, active: true, message: "视频上传失败", error: message }));
      else setImageUpload(uploadKey, { active: true, percent: 0, fileName: file.name, message: "图片上传失败", error: message });
    } finally {
      if (type !== "video") setUploading("");
    }
  }
  async function handleImageListUpload(files: FileList | null, key: "gallery_images" | "detail_images") {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    setError("");
    setUploading(`正在上传 ${selected.length} 张图片…`);
    try {
      const urls: string[] = [];
      for (const [index, file] of selected.entries()) {
        const uploadKey = `${key}-batch-${file.name}-${index}`;
        setImageUpload(uploadKey, { active: true, percent: 0, fileName: file.name, message: `第 ${index + 1}/${selected.length} 张正在压缩…` });
        const uploadFilePayload = await compressImageForUpload(file);
        const url = await uploadFile(uploadFilePayload, "image", percent => setImageUpload(uploadKey, { active: true, percent, fileName: uploadFilePayload.name, message: percent >= 99 ? "正在保存，请稍候…" : `第 ${index + 1}/${selected.length} 张上传中…` }));
        urls.push(url);
        setImageUpload(uploadKey, { active: true, percent: 100, fileName: uploadFilePayload.name, message: `第 ${index + 1}/${selected.length} 张上传完成` });
        clearImageUploadLater(uploadKey);
      }
      setEdit((current: any) => ({ ...current, [key]: [...(current?.[key] || []), ...urls] }));
    } catch (uploadError: any) {
      setError(uploadError.message || "上传失败，请检查图片格式或大小");
    } finally {
      setUploading("");
    }
  }
  const updateImageList = (key: "gallery_images" | "detail_images", index: number, url: string) => setEdit((current: any) => ({ ...current, [key]: (current?.[key] || []).map((item: string, itemIndex: number) => itemIndex === index ? url : item) }));
  const removeImageList = (key: "gallery_images" | "detail_images", index: number) => setEdit((current: any) => ({ ...current, [key]: (current?.[key] || []).filter((_: string, itemIndex: number) => itemIndex !== index) }));
  const moveImageList = (key: "gallery_images" | "detail_images", from: number, to: number) => setEdit((current: any) => {
    const next = [...(current?.[key] || [])];
    if (from < 0 || to < 0 || from >= next.length || to >= next.length || from === to) return current;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return { ...current, [key]: next };
  });

  const addVariant = () => setEdit({ ...edit, color_variants: [...(edit.color_variants || []), { name_zh: "", name_en: "", hex: "#cccccc", image: "", stock_quantity: 0 }] });
  const updateVariant = (index: number, values: any) => setEdit({ ...edit, color_variants: edit.color_variants.map((variant: any, variantIndex: number) => variantIndex === index ? { ...variant, ...values } : variant) });
  const removeVariant = (index: number) => setEdit({ ...edit, color_variants: edit.color_variants.filter((_: any, variantIndex: number) => variantIndex !== index) });
  async function remove(id: number) { if (confirm("确定删除这个商品吗？")) { await adminFetch(`/api/admin/products/${id}`, { method: "DELETE" }); load(); } }
  async function createOrder(product: any) {
    if (!confirm(`创建订单不可逆，订单创建后不能删除，只能取消。\n一个商品可以生成多个订单。\n确认要为 ${product.product_code} 创建订单吗？`)) return;
    const order = await adminFetch<any>("/api/admin/orders", {
      method: "POST",
      body: JSON.stringify({
        locale: "zh",
        status: "draft",
        payment_method: "WhatsApp 确认",
        is_paid: false,
        items: [{
          product_id: product.id,
          product_code: product.product_code,
          title: product.title_zh || product.title_en,
          image: product.main_image || "",
          quantity: 1,
          unit_price: Number(product.price || 0),
        }],
        product_cost: Number(product.price || 0),
        first_leg_cost: 0,
        last_leg_cost: 0,
        total_price: Number(product.price || 0),
        currency: "CNY",
      }),
    });
    router.push(`/admin/orders?keyword=${encodeURIComponent(order.order_code)}`);
  }
  async function openTraffic(product: any) {
    setTrafficProduct(product);
    setTrafficData(null);
    setTrafficLoading(true);
    try {
      setTrafficData(await adminFetch(`/api/admin/products/${product.id}/analytics?days=30`));
    } finally {
      setTrafficLoading(false);
    }
  }
  const copyId = (code: string) => copyToClipboard(code);
  const field = (key: string, label: string, wide = false, type = "text", required = false) => <label className={wide ? "wide" : ""}>{label}<input className="field" type={type} required={required} value={edit[key] ?? ""} onChange={event => setEdit({ ...edit, [key]: type === "number" ? Number(event.target.value) : event.target.value })} /></label>;
  const imageListEditor = (key: "gallery_images" | "detail_images", title: string, hint: string) => <div className="wide image-list-editor">
    <div className="image-list-header">
      <div><strong>{title}</strong><p className="muted">{hint}</p></div>
      <label className="btn btn-soft upload-button"><Upload size={16} />批量上传<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={event => handleImageListUpload(event.target.files, key)} /></label>
    </div>
    <div className="upload-progress-list">{Object.entries(imageUploads).filter(([uploadKey]) => uploadKey.startsWith(`${key}-batch-`)).map(([uploadKey, progress]) => <div key={uploadKey}>{progressCard(progress)}</div>)}</div>
    <div className="image-list">
      {(edit[key] || []).map((src: string, index: number) => <div className={`image-list-row ${draggingImage?.key === key && draggingImage.index === index ? "dragging" : ""}`} key={`${key}-${src}-${index}`} draggable onDragStart={() => setDraggingImage({ key, index })} onDragEnd={() => setDraggingImage(null)} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (draggingImage?.key === key) moveImageList(key, draggingImage.index, index); setDraggingImage(null); }}>
        <button type="button" className="image-drag-handle" title="拖动调整位置" aria-label="拖动调整图片位置"><GripVertical size={20} /></button>
        <img src={src || "/placeholder.svg"} alt="" />
        <input className="field" value={src || ""} placeholder="图片地址" onChange={event => updateImageList(key, index, event.target.value)} />
        <div className="image-order-actions"><button type="button" disabled={index === 0} onClick={() => moveImageList(key, index, index - 1)} title="上移"><ArrowUp size={16} /></button><button type="button" disabled={index === (edit[key] || []).length - 1} onClick={() => moveImageList(key, index, index + 1)} title="下移"><ArrowDown size={16} /></button></div>
        <button type="button" className="danger" onClick={() => removeImageList(key, index)}><Trash2 size={17} /></button>
      </div>)}
      {(edit[key] || []).length === 0 && <div className="image-list-empty">还没有添加图片，可以直接批量上传。</div>}
    </div>
  </div>;

  return <AdminShell title="商品管理" actions={<button className="btn btn-primary" onClick={() => setEdit({ ...blank, _create_request_id: uuid() })}><Plus size={16} />新增商品</button>}>
    {edit && <div className="panel">
      <div className="admin-header"><div><h2>{edit.id ? "编辑商品" : "新增商品"}</h2><p className="muted">以中文录入，保存时自动生成英文内容；英文前台为默认展示。</p></div><button className="btn btn-soft" onClick={() => setEdit(null)}><X /></button></div>
      <form className="form-grid" onSubmit={save}>
        {edit.product_code && <label>商品 ID<div className="copy-field"><strong>{edit.product_code}</strong><button type="button" className="btn btn-soft" onClick={() => copyId(edit.product_code)}><Copy size={14} />复制</button></div></label>}
        {field("sku", "内部 SKU（可不填，自动使用商品 ID）")}
        {field("slug", "英文链接 Slug（可不填，自动生成）")}
        <label>商品状态<select className="field" value={edit.status} onChange={event => setEdit({ ...edit, status: event.target.value })}><option value="draft">草稿</option><option value="published">已上架</option><option value="archived">已归档</option><option value="sold_out">已售罄</option><option value="coming_soon">即将上架</option></select></label>
        {field("title_zh", "中文商品标题", false, "text", true)}
        {field("title_en", "英文标题（自动生成，可修改）")}
        <label>商品分类<select className="field" value={edit.category_id || ""} onChange={event => setEdit({ ...edit, category_id: event.target.value })}><option value="">未分类</option>{categories.map(category => <option value={category.id} key={category.id}>{category.name_zh || category.name_en}</option>)}</select></label>
        <label>上品来源<select className="field" value={edit.source_platform || ""} onChange={event => setEdit({ ...edit, source_platform: event.target.value })}><option value="1688">1688</option><option value="douyin">抖音</option><option value="taobao">淘宝</option><option value="other">其他</option></select></label>
        {field("source_url", "来源商品链接", true, "url")}
        <label className="wide">商品标签<div>{tags.map(tag => <label key={tag.id} style={{ display: "inline-flex", marginRight: 16 }}><input type="checkbox" checked={(edit.tag_ids || edit.tags?.map((item: any) => item.id) || []).includes(tag.id)} onChange={event => { const ids = edit.tag_ids || edit.tags?.map((item: any) => item.id) || []; setEdit({ ...edit, tag_ids: event.target.checked ? [...ids, tag.id] : ids.filter((id: number) => id !== tag.id) }); }} />{tag.name_zh || tag.name_en}</label>)}</div></label>
        <div className="wide form-label"><span>商品主图</span><div className="media-field"><input className="field" value={edit.main_image || ""} onChange={event => setEdit({ ...edit, main_image: event.target.value })} /><label className="btn btn-soft upload-button"><Upload size={16} />上传图片<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => handleUpload(event.target.files?.[0], "image", url => setEdit((current: any) => ({ ...current, main_image: url })), "main_image")} /></label></div>{progressCard(imageUploads.main_image)}</div>
        {imageListEditor("gallery_images", "商品轮播图", "上传多张时，前台商品详情页会自动显示轮播；只有一张图时不显示轮播按钮。")}
        {imageListEditor("detail_images", "商品详情图", "用于商品页下方长图展示，用户往下滑即可查看。")}
        <div className="wide form-label"><span>商品视频（可选，无视频时前台不显示）</span><div className="media-field"><input className="field" value={edit.video_url || ""} onChange={event => setEdit({ ...edit, video_url: event.target.value })} /><label className="btn btn-soft upload-button"><Upload size={16} />上传视频<input type="file" accept="video/mp4,video/webm,video/quicktime,.mov" onChange={event => handleUpload(event.target.files?.[0], "video", url => setEdit((current: any) => ({ ...current, video_url: url })))} /></label></div>{edit.video_url && <small className="muted">已选择视频：{edit.video_url}</small>}{progressCard(videoUpload)}</div>
        <label className="wide">中文简短描述<textarea className="field" value={edit.short_description_zh || ""} onChange={event => setEdit({ ...edit, short_description_zh: event.target.value })} /></label>
        <label className="wide">中文详细描述<textarea className="field" value={edit.description_zh || ""} onChange={event => setEdit({ ...edit, description_zh: event.target.value })} /></label>
        <label className="wide">中文卖点（每行一条）<textarea className="field" value={Array.isArray(edit.features_zh) ? edit.features_zh.join("\n") : edit.features_zh || ""} onChange={event => setEdit({ ...edit, features_zh: event.target.value })} /></label>
        {field("material", "材质")}{field("size", "尺寸")}{field("weight", "重量（单位：克，例如 14g）")}{field("package_info", "包装")}{field("usage_scene", "适用场景")}
        {field("price", "人民币价格（¥）", false, "number")}{field("stock_quantity", "库存数量", false, "number")}
        <div className="wide variant-editor"><div className="variant-header"><div><strong>颜色组合</strong><p className="muted">每个颜色可设置色值、图片和独立数量，英文颜色名会自动生成。</p></div><label className="form-label"><span>款式价格</span><select className="field" value={edit.price_mode || "uniform"} onChange={event => setEdit({ ...edit, price_mode: event.target.value })}><option value="uniform">全部款式统一价格</option><option value="per_variant">不同款式/尺寸不同价格</option></select></label><button type="button" className="btn btn-soft" onClick={addVariant}><Plus size={15} />添加颜色</button></div>
        {edit.price_mode === "per_variant" ? <p className="muted variant-price-hint">已开启分款式定价：请在每个款式行内填写人民币价格；未填写的款式将不在前台显示价格。</p> : <p className="muted variant-price-hint">统一价格使用上方「人民币价格（¥）」，所有款式共用同一个价格。</p>}
        {(edit.color_variants || []).map((variant: any, index: number) => <div key={index}><div className={`variant-row ${edit.price_mode === "per_variant" ? "per-price" : ""}`}><input className="field" placeholder="中文颜色名" value={variant.name_zh || ""} onChange={event => updateVariant(index, { name_zh: event.target.value })} /><input className="field" type="color" value={variant.hex || "#cccccc"} onChange={event => updateVariant(index, { hex: event.target.value })} /><input className="field" placeholder="颜色图片地址" value={variant.image || ""} onChange={event => updateVariant(index, { image: event.target.value })} /><label className="btn btn-soft upload-button"><Upload size={14} />图片<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => handleUpload(event.target.files?.[0], "image", url => updateVariant(index, { image: url }), `variant-${index}`)} /></label><input className="field" type="number" min="0" placeholder="数量" value={variant.stock_quantity ?? 0} onChange={event => updateVariant(index, { stock_quantity: Number(event.target.value) })} />{edit.price_mode === "per_variant" && <input className="field" type="number" min="0" step="0.01" placeholder="价格 ¥" value={variant.price ?? ""} onChange={event => updateVariant(index, { price: event.target.value === "" ? null : Number(event.target.value) })} />}<button type="button" className="danger" onClick={() => removeVariant(index)}><Trash2 size={17} /></button></div>{progressCard(imageUploads[`variant-${index}`])}</div>)}</div>
        {[ ["auto_translate", "保存时自动把中文翻译成英文"], ["show_price", "前台展示价格"], ["is_free_shipping", "包邮"], ["is_featured", "推荐商品"], ["is_new", "新品"], ["is_best_seller", "热卖商品"], ["allow_whatsapp", "允许 WhatsApp 询价"] ].map(([key, label]) => <label key={key} style={{ flexDirection: "row", alignItems: "center" }}><input type="checkbox" checked={!!edit[key]} onChange={event => setEdit({ ...edit, [key]: event.target.checked })} />{label}</label>)}
        {edit.id && <div className="wide operator-card"><span>创建人：{edit.created_by || "—"}</span><span>最后处理：{edit.updated_by || "—"}</span></div>}
        {saving && <div className="notice wide">正在保存商品，请稍候。如果开启自动翻译，可能需要多等几秒。</div>}
        {uploading && <div className="notice wide">{uploading}</div>}
        {saved && <div className="notice success wide">{saved}</div>}
        {error && <div className="error wide">{error}</div>}
        <button className="btn btn-accent" disabled={saving}><Save size={16} />{saving ? "保存中，请稍候..." : "保存商品"}</button>
      </form>
    </div>}
    <div className="panel"><form className="admin-product-search" onSubmit={event => { event.preventDefault(); load(keyword); }}><div><strong>搜索商品</strong><p className="muted">支持商品 ID、SKU、中文或英文标题</p></div><input className="field" value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="例如 PLY-000001" /><button className="btn btn-primary"><Search size={16} />搜索</button>{keyword && <button type="button" className="btn btn-soft" onClick={() => { setKeyword(""); load(); }}>清除</button>}</form><table className="table"><thead><tr><th>商品 ID</th><th>商品</th><th>流量分析</th><th>人民币价格</th><th>库存</th><th>重量</th><th>商品来源</th><th>来源网址</th><th>运费</th><th>视频</th><th>状态</th><th>创建人</th><th>最后处理人</th><th>操作</th></tr></thead><tbody>{items.map(product => <tr key={product.id}><td><button className="copy-code" onClick={() => copyId(product.product_code)}>{product.product_code}<Copy size={13} /></button></td><td><strong>{product.title_zh || product.title_en}</strong><div className="muted">{product.title_en}</div></td><td><div className="product-traffic-cell"><strong>{product.analytics?.views_30d ?? 0}</strong><span>近30天浏览</span><button type="button" className="btn btn-soft traffic-detail-btn" onClick={() => openTraffic(product)}>查看分析</button></div></td><td>{priceCellText(product)}</td><td>{product.stock_quantity || 0}</td><td>{product.weight || "—"}</td><td>{sourceText[product.source_platform] || product.source_platform || "—"}</td><td>{product.source_url ? <a className="source-link" href={product.source_url} target="_blank" rel="noreferrer" title={product.source_url}>打开来源<ExternalLink size={13} /></a> : "—"}</td><td>{product.is_free_shipping ? "包邮" : "运费另询"}</td><td>{product.video_url ? "已上传" : "无视频"}</td><td><span className="status">{statusText[product.status] || product.status}</span></td><td>{product.created_by || "—"}</td><td>{product.updated_by || "—"}</td><td><div className="table-actions"><button className="table-action table-action-primary" onClick={() => createOrder(product)}><ClipboardList size={14} />生成订单</button><button className="table-action" onClick={() => setEdit({ ...product, auto_translate: true, tag_ids: product.tags.map((tag: any) => tag.id), price_mode: priceModeOf(product) })}>编辑</button><button className="table-action table-action-danger" onClick={() => remove(product.id)}>删除</button></div></td></tr>)}</tbody></table>{items.length === 0 && <div className="empty">没有找到对应商品</div>}</div>
    {trafficProduct && <div className="admin-modal-backdrop" onClick={() => setTrafficProduct(null)}>
      <div className="admin-modal traffic-modal" onClick={event => event.stopPropagation()}>
        <div className="admin-modal-head"><div><span className="eyebrow">商品流量分析</span><h2>{trafficProduct.title_zh || trafficProduct.title_en}</h2><p className="muted">{trafficProduct.product_code}</p></div><button className="btn btn-soft" onClick={() => setTrafficProduct(null)}><X size={18} /></button></div>
        {trafficLoading ? <div className="loading">正在读取商品流量数据…</div> : trafficData && <>
          <div className="traffic-stats">
            <div><span>今日浏览</span><strong>{trafficData.summary.views_today}</strong></div>
            <div><span>近 7 天浏览</span><strong>{trafficData.summary.views_7d}</strong></div>
            <div><span>近 30 天浏览</span><strong>{trafficData.summary.views_30d}</strong></div>
            <div><span>累计浏览</span><strong>{trafficData.summary.views_total}</strong></div>
            <div><span>近 30 天询价</span><strong>{trafficData.summary.whatsapp_30d}</strong></div>
          </div>
          <div className="traffic-chart-card"><h3>近 30 天趋势</h3><div style={{ height: 300 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={trafficData.trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Line type="monotone" dataKey="views" name="商品浏览" stroke="#147efb" strokeWidth={3} /><Line type="monotone" dataKey="whatsapp_clicks" name="WhatsApp 询价" stroke="#ff5a3c" strokeWidth={3} /></LineChart></ResponsiveContainer></div></div>
          <div className="traffic-breakdown-grid">
            <div className="traffic-chart-card"><h3>语言分布</h3>{trafficData.languages.length ? <div style={{ height: 240 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={trafficData.languages}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="locale" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" name="次数" fill="#7c5cff" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div> : <p className="muted">暂无语言数据</p>}</div>
            <div className="traffic-chart-card"><h3>来源渠道</h3>{trafficData.sources.length ? <table className="table"><tbody>{trafficData.sources.map((item: any) => <tr key={item.source}><td>{item.source}</td><td>{item.count}</td></tr>)}</tbody></table> : <p className="muted">暂无 UTM 来源数据</p>}</div>
          </div>
        </>}
      </div>
    </div>}
  </AdminShell>;
}
