import { PublicLayout } from "@/components/PublicLayout";

// 构建容器内无后端（hostname backend 不可解析），静态预渲染会因 settings 拉取失败而中断构建；
// 与 [locale] 布局保持一致使用动态渲染
export const dynamic = "force-dynamic";

// Guides 复用站点公共布局（页头/页脚/WhatsApp 悬浮按钮/主题），英文站点
export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return <PublicLayout locale="en">{children}</PublicLayout>;
}
