"use client";

import { CrudManager } from "@/components/CrudManager";

function hasCjk(value?: string) {
  return /[\u4e00-\u9fff]/.test(value || "");
}

function normalizeTag(item: Record<string, any>) {
  const name = String(item.name_zh || item.name_en || "").trim();
  const existingEnglishName = String(item.name_en || "").trim();
  return {
    ...item,
    name_zh: name,
    name_en: existingEnglishName && !hasCjk(existingEnglishName) ? existingEnglishName : "",
    name_ja: null,
    name_ko: null,
  };
}

export default function Page() {
  return <CrudManager
    title="标签管理"
    path="/api/admin/tags"
    defaults={{ sort_order: 0, is_active: true, color: "#7c5cff", name_zh: "", slug: "" }}
    beforeSave={normalizeTag}
    fields={[
      { key: "name_zh", label: "标签名称", required: true },
      { key: "slug", label: "标签路径", required: true },
      { key: "color", label: "标签颜色", type: "color" },
      { key: "is_active", label: "前台显示", type: "checkbox" },
      { key: "sort_order", label: "排序", type: "number" },
    ]}
  />;
}
