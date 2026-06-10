"use client";

/**
 * NavProvider — 导航模式切换 Context
 *
 * 支持两种导航布局：
 *   - "sidebar" — 左侧纵向侧边栏（默认）
 *   - "topbar"  — 顶部横向导航栏
 *
 * 状态持久化到 localStorage key: "nas-nav-mode"
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type NavMode = "sidebar" | "topbar";

interface NavContextValue {
  mode: NavMode;
  setMode: (m: NavMode) => void;
  /** 切换导航模式（sidebar ↔ topbar） */
  toggle: () => void;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
}

const NavContext = createContext<NavContextValue | null>(null);

function getStoredMode(): NavMode {
  if (typeof window === "undefined") return "sidebar";
  const stored = localStorage.getItem("nas-nav-mode");
  if (stored === "topbar") return "topbar";
  return "sidebar";
}

export function NavProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<NavMode>("sidebar");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setModeState(getStoredMode());
  }, []);

  const setMode = (m: NavMode) => {
    setModeState(m);
    localStorage.setItem("nas-nav-mode", m);
  };

  const toggle = () => {
    setMode(mode === "sidebar" ? "topbar" : "sidebar");
  };

  return (
    <NavContext.Provider value={{ mode, setMode, toggle, collapsed, setCollapsed }}>
      {children}
    </NavContext.Provider>
  );
}

/** 获取导航模式 Context 的 hook */
export function useNavMode(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNavMode must be used within NavProvider");
  return ctx;
}
