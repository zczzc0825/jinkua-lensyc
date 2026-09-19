import type { Metadata } from "next";
import { siteBaseUrl } from "@/lib/seo";
import "./globals.css";
import "./mobile.css";
import "./apple-theme.css";
import "./product-enhancements.css";
import "./atelier-theme.css";
import "./admin-polish.css";
export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(await siteBaseUrl()),
    title: { default: "cooolmake — Objects for curious spaces", template: "%s — cooolmake" },
    description: "Art toys, expressive home decor and delightful desk companions.",
    icons: { icon: "/blank-icon.svg", shortcut: "/blank-icon.svg", apple: "/blank-icon.svg" },
    openGraph: { type: "website", siteName: "cooolmake", images: [{ url: "/brand/og-default.png", width: 1200, height: 630, alt: "cooolmake" }] },
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
  };
}
export const viewport={width:"device-width",initialScale:1,maximumScale:1,viewportFit:"cover"};
const themeScript=`(()=>{try{const root=document.documentElement;const saved=localStorage.getItem("plynook_theme");const theme=saved||((matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light");root.dataset.theme=theme;const ua=navigator.userAgent||"";const ios=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);const android=/Android/i.test(ua);const touch=navigator.maxTouchPoints>0;const w=Math.round((window.visualViewport&&window.visualViewport.width)||window.innerWidth);const h=Math.round((window.visualViewport&&window.visualViewport.height)||window.innerHeight);const dpr=window.devicePixelRatio||1;const s=Math.min(w,h);const l=Math.max(w,h);let device="desktop";if(s<=374)device="phone-small";else if(s<=430)device="phone";else if(s<=540)device="phone-large";else if(touch&&w<=1024)device="tablet";let model=device;if(ios&&device==="phone-small")model="iphone-compact";if(ios&&device==="phone")model=dpr>=3&&l>=800?"iphone-pro":"iphone";if(ios&&device==="phone-large")model="iphone-plus";if(android&&device.indexOf("phone")===0)model="android-phone";if(ios&&device==="tablet")model="ipad";if(android&&device==="tablet")model="android-tablet";root.dataset.device=device;root.dataset.deviceModel=model;root.dataset.os=ios?"ios":android?"android":"desktop";root.style.setProperty("--device-width",w+"px");root.style.setProperty("--device-height",h+"px");root.style.setProperty("--device-dpr",String(Math.round(dpr*100)/100));}catch(e){document.documentElement.dataset.theme="light";document.documentElement.dataset.device="desktop";}})();`;
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><head><meta name="darkreader-lock"/><script dangerouslySetInnerHTML={{__html:themeScript}}/></head><body>{children}</body></html>}
