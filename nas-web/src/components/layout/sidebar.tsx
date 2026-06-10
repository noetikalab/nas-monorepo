"use client";

/**
 * Sidebar — 左侧纵向导航栏
 *
 * 特性：
 *   - 可折叠（240px ↔ 56px）
 *   - 选中态：左侧 2px 蓝色竖线指示器
 *   - 底部包含主题切换和导航模式切换
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Settings,
  ScrollText,
  PanelLeftClose,
  PanelLeft,
  HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavMode } from "@/providers/nav-provider";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "./theme-toggle";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly: boolean;
}

const navItems: NavItem[] = [
  { label: "仪表盘", href: "/", icon: LayoutDashboard, adminOnly: true },
  { label: "文件管理", href: "/files", icon: FolderOpen, adminOnly: false },
  { label: "用户管理", href: "/users", icon: Users, adminOnly: true },
  { label: "审计日志", href: "/logs", icon: ScrollText, adminOnly: true },
  { label: "系统设置", href: "/settings", icon: Settings, adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, setCollapsed, toggle } = useNavMode();
  const { role } = useAuth();

  // 普通用户只显示非 adminOnly 的菜单项
  const visibleItems = role === "admin"
    ? navItems
    : navItems.filter((item) => !item.adminOnly);

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border bg-card transition-all duration-200",
        collapsed ? "w-14" : "w-60",
      )}
    >
      {/* Logo 区域 */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-3">
        <HardDrive className="h-5 w-5 shrink-0" />
        {!collapsed && <span className="text-sm font-semibold">NAS</span>}
      </div>

      {/* 导航列表 */}
      <nav className="flex-1 space-y-1 p-2">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>

      <Separator />

      {/* 底部操作 */}
      <div className="flex flex-col gap-1 p-2">
        <ThemeToggle collapsed={collapsed} />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={collapsed ? "icon" : "default"}
              onClick={toggle}
              className={cn("w-full", !collapsed && "justify-start gap-3")}
            >
              <PanelLeft className="h-4 w-4" />
              {!collapsed && <span className="text-sm">切换顶栏模式</span>}
            </Button>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">切换顶栏模式</TooltipContent>}
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="w-full"
            >
              {collapsed ? (
                <PanelLeft className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? "展开侧栏" : "折叠侧栏"}
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
