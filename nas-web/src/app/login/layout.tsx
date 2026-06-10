"use client";

/**
 * LoginLayout — 登录页独立布局
 * 无侧栏、无顶栏，仅包裹 ThemeProvider 以支持暗色模式。
 */

import { ThemeProvider } from "@/providers/theme-provider";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
