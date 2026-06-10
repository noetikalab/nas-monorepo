"use client";

/**
 * AppTopbar — sidebar 模式下的顶部横条
 *
 * 包含面包屑/页面标题区域 + 右侧工具按钮（主题/用户菜单）
 */

import { UserMenu } from "./user-menu";
import { ThemeToggle } from "./theme-toggle";

export function AppTopbar() {
  return (
    <header className="flex h-14 items-center justify-end border-b border-border bg-card px-4">
      <div className="flex items-center gap-1">
        <ThemeToggle collapsed />
        <UserMenu />
      </div>
    </header>
  );
}
