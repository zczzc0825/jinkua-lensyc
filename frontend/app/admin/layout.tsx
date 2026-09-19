import type { Metadata } from "next";
export const metadata: Metadata = { robots: { index: false, follow: false }, title: { default: "cooolmake Admin", template: "%s — cooolmake Admin" } };
export default function AdminRootLayout({ children }: { children: React.ReactNode }) { return children; }
