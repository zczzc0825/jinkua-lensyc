"use client";

import { CrudManager } from "@/components/CrudManager";

function hasCjk(value?: string) {
  return /[\u4e00-\u9fff]/.test(value || "");
}

function normalizeCategory(item: Record<string, any>) {
  const name = String(item.name_zh || item.name_en || "").trim();
  const description = String(item.description_zh || item.description_en || "").trim();
  const existingEnglishName = String(item.name_en || "").trim();
  const existingEnglishDescription = String(item.description_en || "").trim();
  return {
    ...item,
    name_zh: name,
    name_en: existingEnglishName && !hasCjk(existingEnglishName) ? existingEnglishName : "",
    name_ja: null,
    name_ko: null,
    description_zh: description,
    description_en: existingEnglishDescription && !hasCjk(existingEnglishDescription) ? existingEnglishDescription : null,
    description_ja: null,
    description_ko: null,
  };
}

export default function Page() {
  return <CrudManager
    title="分类管理"
    path="/api/admin/categories"
    defaults={{ sort_order: 0, is_active: true, name_zh: "", slug: "", description_zh: "" }}
    beforeSave={normalizeCategory}
    fields={[
      { key: "name_zh", label: "分类名称", required: true },
      { key: "slug", label: "分类路径", required: true },
      { key: "sort_order", label: "排序", type: "number" },
      { key: "is_active", label: "前台显示", type: "checkbox" },
      { key: "description_zh", label: "分类描述", type: "textarea" },
      { key: "banner_image", label: "Banner 图片地址" },
    ]}
  />;
}
