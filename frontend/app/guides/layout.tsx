import { PublicLayout } from "@/components/PublicLayout";

// Guides 复用站点公共布局（页头/页脚/WhatsApp 悬浮按钮/主题），英文站点
export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return <PublicLayout locale="en">{children}</PublicLayout>;
}
