"use client";

/**
 * useAuth — 鉴权状态 hook
 *
 * 返回当前用户的登录状态、角色，以及 logout 方法。
 * 未登录时自动重定向到 /login。
 */

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getToken, getUsername, getRole, logout as doLogout } from "@/lib/auth";

interface AuthState {
  user: string | null;
  role: "admin" | "user" | null;
  loading: boolean;
  logout: () => void;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<string | null>(null);
  const [role, setRole] = useState<"admin" | "user" | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/login") {
      setLoading(false);
      return;
    }

    const token = getToken();
    const username = getUsername();
    if (!token || !username) {
      router.replace("/login");
      return;
    }
    setUser(username);
    setRole(getRole());
    setLoading(false);
  }, [pathname, router]);

  const logout = () => {
    setUser(null);
    setRole(null);
    doLogout();
  };

  return { user, role, loading, logout };
}
