import {notFound} from "next/navigation";import {PublicLayout} from "@/components/PublicLayout";import {locales} from "@/lib/i18n";import {Locale} from "@/lib/types";
export const dynamic="force-dynamic";
export default async function LocaleLayout({children,params}:{children:React.ReactNode;params:Promise<{locale:string}>}){const{locale}=await params;if(!locales.includes(locale as Locale))notFound();return <PublicLayout locale={locale as Locale}>{children}</PublicLayout>}
