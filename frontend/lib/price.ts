import {Locale} from "./types";
const rates:Record<Locale,number>={zh:1,en:0.14,ja:20.5,ko:190};
const currency:Record<Locale,string>={zh:"CNY",en:"USD",ja:"JPY",ko:"KRW"};
export function approximatePrice(priceCny:number,locale:Locale){const value=priceCny*rates[locale];return new Intl.NumberFormat(locale,{style:"currency",currency:currency[locale],maximumFractionDigits:locale==="en"?2:0}).format(value)}
export function pricePrefix(locale:Locale){return({zh:"约",en:"Approx.",ja:"約",ko:"약"} as const)[locale]}
export function shippingText(locale:Locale,free:boolean){if(free)return({zh:"包邮",en:"Free shipping",ja:"送料無料",ko:"무료 배송"} as const)[locale];return({zh:"运费另询",en:"Shipping quoted separately",ja:"送料は別途お見積り",ko:"배송비 별도 문의"} as const)[locale]}

const GRAMS_PER_POUND = 453.592;
const CM_PER_INCH = 2.54;

// 已带英制单位的字符串原样保留（管理员可能在 size_en 手动填了英制）
const hasImperialUnit = (value: string) => /\b(inch|in|lb|lbs|oz|pound|pounds)\b/i.test(value);

function gramsToImperial(grams: number): string {
  if (grams >= GRAMS_PER_POUND) return `${(grams / GRAMS_PER_POUND).toFixed(1)} lb`;
  return `${(grams / 28.3495).toFixed(1)} oz`;
}

// 后端统一以克存储重量；en 前台转英制，其余语言保持公制
export function formatWeight(weightValue: string, locale: Locale = "zh"): string {
  if (!weightValue) return "";
  const trimmed = String(weightValue).trim();
  if (hasImperialUnit(trimmed)) return trimmed.replace(/\s*(lbs|pounds?)$/i, " lb");

  // 支持 "500g"、"500 g"、"0.5kg"、"0.5 kg"、"500"（裸数字视为克）
  const match = trimmed.match(/^(\d+(\.\d+)?)\s*(kg|g)?$/i);
  if (!match) return trimmed;
  const unit = (match[3] || "g").toLowerCase();
  const grams = unit === "kg" ? parseFloat(match[1]) * 1000 : parseFloat(match[1]);

  if (locale === "en") return gramsToImperial(grams);
  if (grams >= 1000) return `${(grams / 1000).toFixed(grams % 1000 === 0 ? 0 : 1)} kg`;
  return `${Number.isInteger(grams) ? grams : grams.toFixed(1)} g`;
}

// 后端统一以厘米存储尺寸（如 "18 × 10 × 9 cm"）；en 前台转英寸，其余语言保持原样
export function formatSize(sizeValue: string, locale: Locale = "zh"): string {
  if (!sizeValue) return "";
  const trimmed = String(sizeValue).trim();
  if (locale !== "en" || hasImperialUnit(trimmed)) return trimmed;
  if (!/cm/i.test(trimmed)) return trimmed; // 没有单位标记的值不盲转

  // "18 × 10 × 9 cm"：换算串中所有数字，单位 cm 改为 in
  const withoutUnit = trimmed.replace(/\s*cm/gi, "");
  return withoutUnit.replace(/\d+(?:\.\d+)?/g, cm => {
    const inches = parseFloat(cm) / CM_PER_INCH;
    return inches >= 10 ? inches.toFixed(1) : inches.toFixed(2);
  }) + " in";
}
