"use client";
import {createContext,useContext} from "react";
const SettingsContext=createContext<Record<string,unknown>>({});
export function SiteSettingsProvider({settings,children}:{settings:Record<string,unknown>;children:React.ReactNode}){return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>}
export function useSiteSettings(){return useContext(SettingsContext)}
export function useWhatsAppPhone(){return String(useSiteSettings().whatsapp_phone_number||"85200000000")}
