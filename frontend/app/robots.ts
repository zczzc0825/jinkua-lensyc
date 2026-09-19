import type { MetadataRoute } from "next";
import { configuredBaseUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }],
    sitemap: `${configuredBaseUrl()}/sitemap.xml`,
  };
}
