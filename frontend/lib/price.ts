import {Locale} from "./types";
const rates:Record<Locale,number>={zh:1,en:0.14,ja:20.5,ko:190};
const currency:Record<Locale,string>={zh:"CNY",en:"USD",ja:"JPY",ko:"KRW"};
export function approximatePrice(priceCny:number,locale:Locale){const value=priceCny*rates[locale];return new Intl.NumberFormat(locale,{style:"currency",currency:currency[locale],maximumFractionDigits:locale==="en"?2:0}).format(value)}
export function pricePrefix(locale:Locale){return({zh:"约",en:"Approx.",ja:"約",ko:"약"} as const)[locale]}
export function shippingText(locale:Locale,free:boolean){if(free)return({zh:"包邮",en:"Free shipping",ja:"送料無料",ko:"무료 배송"} as const)[locale];return({zh:"运费另询",en:"Shipping quoted separately",ja:"送料は別途お見積り",ko:"배송비 별도 문의"} as const)[locale]}

// Convert weight from grams to pounds (1 pound = 453.592 grams)
export function convertWeightToPounds(weightInGrams: string): string {
  if (!weightInGrams) return "";

  // Extract numeric value from string (e.g., "14g" -> 14, "14" -> 14)
  const match = weightInGrams.match(/^(\d+(\.\d+)?)\s*g?$/i);
  if (!match) return weightInGrams; // Return original if format doesn't match

  const grams = parseFloat(match[1]);
  const pounds = grams / 453.592;

  // Format: show 1-2 decimal places depending on the value
  const formatted = pounds >= 1 ? pounds.toFixed(1) : pounds.toFixed(2);
  return `${formatted}LB`;
}

// If backend stores in pounds already, just add LB suffix
export function formatWeight(weightValue: string): string {
  if (!weightValue) return "";
  const trimmed = String(weightValue).trim();
  if (/(kg|g|lb|lbs|pound|pounds)$/i.test(trimmed)) return trimmed.replace(/\s*(lbs|pounds?)$/i, " lb");
  const match = trimmed.match(/^(\d+(\.\d+)?)$/);
  if (match) {
    const value = parseFloat(match[1]);
    if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)} kg`;
    return `${value}${Number.isInteger(value) ? "" : ""} g`;
  }
  return trimmed;
}
