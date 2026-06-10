import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NAS — 管理后台",
  description: "个人 NAS 存储管理后台 — 文件管理、用户管理、系统监控",
};

/**
 * RootLayout — 全局布局
 * 加载字体 → 包裹 Toaster（全局通知）
 * ThemeProvider / NavProvider 由各子 layout 的 client boundary 包裹
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
