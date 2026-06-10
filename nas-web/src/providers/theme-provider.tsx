"use client";

/**
 * ThemeProvider — 主题切换 Context
 *
 * 支持三种模式：
 *   - "system" — 跟随系统 prefers-color-scheme
 *   - "light"  — 强制亮色
 *   - "dark"   — 强制暗色
 *
 * 实现方式：
 *   - 在 <html> 上添加/移除 "dark" class
 *   - 状态持久化到 localStorage key: "nas-theme"
 *   - 初始化时从 localStorage 读取，无则默认 "dark"
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "system" | "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolved: "light" | "dark"; // 实际应用的主题（system 解析后的结果）
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** 从 localStorage 读取主题设置 */
function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem("nas-theme");
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "dark";
}

/** 根据 Theme 设置解析实际应用的 light/dark */
function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

/** 应用主题到 DOM（<html> 上添加/移除 dark class） */
function applyTheme(resolved: "light" | "dark") {
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  // 初始化：从 localStorage 读取并应用
  useEffect(() => {
    const stored = getStoredTheme();
    setThemeState(stored);
    const r = resolveTheme(stored);
    setResolved(r);
    applyTheme(r);
    setMounted(true);
  }, []);

  // 监听系统主题变化（仅在 theme === "system" 时响应）
  useEffect(() => {
    if (!mounted) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") {
        const r = resolveTheme("system");
        setResolved(r);
        applyTheme(r);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme, mounted]);

  // 切换主题
  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("nas-theme", t);
    const r = resolveTheme(t);
    setResolved(r);
    applyTheme(r);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** 获取主题 Context 的 hook */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
