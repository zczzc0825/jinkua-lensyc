"use client";
import {useEffect} from "react";import {usePathname} from "next/navigation";import {api,sessionId} from "@/lib/api";import {Locale} from "@/lib/types";
export function PageTracker({locale}:{locale:Locale}){const pathname=usePathname();useEffect(()=>{api.event({session_id:sessionId(),event_type:"page_view",locale,page_url:location.href,referrer:document.referrer}).catch(()=>{})},[pathname,locale]);return null}
