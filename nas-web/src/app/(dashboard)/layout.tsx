import { AppShell } from "@/components/layout/app-shell";

/**
 * DashboardLayout — 已登录页面的布局容器
 * 通过 AppShell 提供：鉴权检查 + 主题/导航 Providers + 侧栏/顶栏导航
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
