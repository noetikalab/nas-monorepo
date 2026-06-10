"use client";

/**
 * AppShell — 已登录页面的外壳容器
 *
 * 包裹 ThemeProvider + NavProvider，根据导航模式渲染 Sidebar 或 TopbarNav。
 * 未登录时自动重定向到 /login（通过 useAuth hook）。
 */

import { type ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ThemeProvider } from "@/providers/theme-provider";
import { NavProvider, useNavMode } from "@/providers/nav-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "./sidebar";
import { TopbarNav } from "./topbar-nav";
import { AppTopbar } from "./app-topbar";

function ShellContent({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth();
  const { mode } = useNavMode();
  const router = useRouter();
  const pathname = usePathname();

  // 非 admin 访问管理页面时重定向
  useEffect(() => {
    if (!loading && role === "user") {
      const adminPaths = ["/users", "/logs", "/settings"];
      if (adminPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
        router.replace("/files");
      }
    }
  }, [loading, role, pathname, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  if (mode === "topbar") {
    return (
      <div className="flex min-h-screen flex-col">
        <TopbarNav />
        <main className="flex-1 flex flex-col p-6">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <AppTopbar />
        <main className="flex-1 flex flex-col p-6">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <NavProvider>
        <TooltipProvider>
          <ShellContent>{children}</ShellContent>
        </TooltipProvider>
      </NavProvider>
    </ThemeProvider>
  );
}
