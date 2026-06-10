import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import Header from "@/components/Header";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-display",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "NAS Core — 可信个人存储",
  description:
    "基于 PUF 硬件认证的可信 NAS 系统，多协议、多设备、零信任。",
  keywords: ["NAS", "PUF", "POSIX ACL", "WiFi Direct", "Go", "Next.js"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${spaceGrotesk.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen bg-[#050a0f] font-mono text-[#d4e0f0] antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}
