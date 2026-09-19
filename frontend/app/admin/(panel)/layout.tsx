"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Image,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  Settings,
  Shapes,
  Tags,
  UserRound,
  UsersRound,
} from "lucide-react";
import { adminFetch } from "@/lib/api";

const links = [
  ["/admin/dashboard", "数据看板", LayoutDashboard],
  ["/admin/products", "商品管理", Package],
  ["/admin/articles", "文章管理", FileText],
  ["/admin/orders", "订单管理", ClipboardList],
  ["/admin/procurements", "商品采购单", FileSpreadsheet],
  ["/admin/categories", "分类管理", Shapes],
  ["/admin/tags", "标签管理", Tags],
  ["/admin/banners", "Banner 管理", Image],
  ["/admin/inquiries", "询价记录", MessageSquare],
  ["/admin/analytics", "流量分析", BarChart3],
  ["/admin/settings", "系统设置", Settings],
  ["/admin/profile", "个人信息", UserRound],
] as const;
const superLinks = [["/admin/admins", "管理员管理", UsersRound]] as const;

type AdminUser = { id: number; username: string; nickname: string; role: string };

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<AdminUser | null>(null);

  useEffect(() => {
    try { const cached = JSON.parse(localStorage.getItem("plynook_me") || "null"); if (cached) setMe(cached); } catch {}
    adminFetch<AdminUser>("/api/admin/auth/me").then(user => {
      try { localStorage.setItem("plynook_me", JSON.stringify(user)); } catch {}
      setMe(user);
    }).catch(() => {});
  }, []);

  if (!me) return <div className="loading">正在验证管理员身份…</div>;
  const visibleLinks = me.role === "super_admin" ? [...links, ...superLinks] : links;

  return <div className="admin-shell">
    <aside className="admin-side">
      <Link className="admin-wordmark" href="/admin/dashboard" aria-label="cooolmake 管理后台">
        <img src="/brand/logo_w.png" alt="cooolmake" />
      </Link>
      <div className="admin-side-intro">
        <span>Workspace</span>
        <strong>内容管理后台</strong>
      </div>
      <div className="admin-user-chip">
        <span>当前账号</span>
        <strong>{me.nickname || me.username}</strong>
        <small>{me.role === "super_admin" ? "超级管理员" : "管理员"}</small>
      </div>
      <nav>
        <div className="admin-nav-links">
          {visibleLinks.map(([href, label, Icon]) => <Link className={pathname === href ? "active" : ""} href={href} key={href} draggable={false}>
            <Icon className="admin-nav-icon" size={17} />
            <span>{label}</span>
          </Link>)}
        </div>
        <button className="admin-logout" onClick={() => {
          localStorage.removeItem("plynook_token");
          localStorage.removeItem("plynook_me");
          router.push("/admin/login");
        }}>
          <LogOut size={17} />
          退出登录
        </button>
      </nav>
    </aside>
    <main className="admin-main">{children}</main>
  </div>;
}
