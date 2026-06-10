"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const NasHero = dynamic(() => import("@/components/NasHero"), { ssr: false });

const techStack = [
  "Go", "Gin", "Docker", "LDAP", "SQLite", "Next.js", "TypeScript",
  "Tailwind", "shadcn/ui", "React Native", "Android", "WiFi Direct",
  "PUF CCM3302", "SM2/SM3", "SHA-256", "POSIX ACL", "mDNS", "eBPF",
];

const features = [
  {
    id: "puf",
    title: "/dev/puf",
    tagline: "硬件认证存证",
    lines: [
      "每次文件操作生成 SHA-256 指纹。",
      "哈希链式结构，不可篡改。",
      "链头由 PUF SM2 签名锚定。",
      "可导出 ProofBundle，独立验证，司法可用。",
    ],
    color: "#00ff41",
  },
  {
    id: "wifi-p2p",
    title: "/dev/wifi-p2p",
    tagline: "没有路由器？NAS 就是路由器。",
    lines: [
      "开机即创建 WiFi Direct 群组。",
      "mDNS → 缓存 IP → P2P 三层降级。",
      "手机直连 192.168.49.1。",
      "桌面端自动跳过，服务端自动创建。",
    ],
    color: "#b388ff",
  },
  {
    id: "acl",
    title: "/dev/acl",
    tagline: "一套权限，三种协议。",
    lines: [
      "POSIX ACL 是唯一权限真相。",
      "HTTP/WebDAV、SMB (ldapsam)、NFS (UID 映射)。",
      "setfacl 统一管理，无权限漂移。",
      "LDAP 用户名 → UID 解析，兼容容器环境。",
    ],
    color: "#ffa940",
  },
  {
    id: "shared",
    title: "/dev/shared-dir",
    tagline: "默认私有，按需共享。",
    lines: [
      "/data/{user}/ chmod 700，仅属主可访问。",
      "/data/shared/ chmod 755，setgid，全员可读。",
      "管理员 ACL 授权 → 按需开放写入。",
      "用户间共享（规划中）。",
    ],
    color: "#00d4ff",
  },
];

function FeatureCard({
  feature,
}: {
  feature: (typeof features)[number];
}) {
  return (
    <div
      className="feature-card group relative rounded-xl border p-6 transition-all duration-500 hover:scale-[1.02]"
      style={{ borderColor: feature.color + "33", boxShadow: `0 0 20px ${feature.color}0a` }}
    >
      <div
        className="absolute inset-0 rounded-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ boxShadow: `0 0 60px ${feature.color}20`, borderColor: feature.color }}
      />
      <h3 className="mb-2 text-sm font-bold" style={{ color: feature.color }}>
        {feature.title}
      </h3>
      <p className="mb-4 text-xs" style={{ color: feature.color, opacity: 0.7 }}>
        {feature.tagline}
      </p>
      <ul className="space-y-2">
        {feature.lines.map((line, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-[13px] leading-relaxed"
            style={{ color: "#6b8299" }}
          >
            <span className="mt-1.5 block h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: feature.color }} />
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const archRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const proofRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // Hero text stagger
      gsap.from(".hero-line", {
        opacity: 0,
        y: 30,
        duration: 0.8,
        stagger: 0.3,
        ease: "power3.out",
        delay: 0.5,
      });

      // Architecture section
      gsap.set(".arch-item", { opacity: 0, y: 40 });
      gsap.to(".arch-item", {
        scrollTrigger: { trigger: archRef.current, start: "top 85%", toggleActions: "play none none none" },
        opacity: 1,
        y: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: "power2.out",
      });

      // Feature cards
      gsap.set(".feature-card", { opacity: 0, y: 80 });
      gsap.to(".feature-card", {
        scrollTrigger: { trigger: featuresRef.current, start: "top 85%", toggleActions: "play none none none" },
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.2,
        ease: "power3.out",
      });

      // Proof chain nodes
      gsap.set(".proof-node", { opacity: 0, scale: 0.5 });
      gsap.to(".proof-node", {
        scrollTrigger: { trigger: proofRef.current, start: "top 85%", toggleActions: "play none none none" },
        opacity: 1,
        scale: 1,
        duration: 0.6,
        stagger: 0.3,
        ease: "back.out(1.7)",
      });

      // Tech tags
      gsap.set(".tech-tag", { opacity: 0, y: 20 });
      gsap.to(".tech-tag", {
        scrollTrigger: { trigger: footerRef.current, start: "top 90%", toggleActions: "play none none none" },
        opacity: 1,
        y: 0,
        duration: 0.4,
        stagger: { amount: 0.6, from: "random" },
        ease: "back.out(1.5)",
      });
    });

    ScrollTrigger.refresh();

    return () => ctx.revert();
  }, []);

  return (
    <main className="relative min-h-screen bg-[#050a0f]">
      {/* ============================== HERO ============================== */}
      <section id="hero" className="relative grid h-screen grid-cols-1 overflow-hidden md:grid-cols-2" ref={heroRef}>
        {/* Left: 3D scene */}
        <div className="relative order-2 md:order-1">
          <NasHero />
        </div>

        {/* Right: text content */}
        <div className="relative z-10 flex flex-col justify-center px-8 text-left order-1 md:order-2 md:px-16">
          <p className="hero-line mb-4 font-mono text-sm tracking-[0.3em] uppercase" style={{ color: "#00ff41" }}>
            <span className="cursor-blink">$</span> nas-core
          </p>
          <h1
            className="hero-line mb-6 max-w-xl font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-4xl lg:text-6xl"
            style={{ color: "#d4e0f0" }}
          >
            Your data.
            <br />
            Your hardware.
            <br />
            <span style={{ color: "#00ff41" }}>Your proof.</span>
          </h1>
          <p
            className="hero-line mb-10 max-w-md font-mono text-sm leading-relaxed"
            style={{ color: "#6b8299" }}
          >
            基于 PUF 硬件认证的可信 NAS 系统。多协议、多设备。一切本地存储，一切可验证。
          </p>
          <div className="hero-line flex gap-4">
            <a
              href="https://github.com/noetikalab/nas-core"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border px-6 py-3 font-mono text-sm font-medium transition-all duration-300 hover:scale-105"
              style={{ borderColor: "#00ff4133", color: "#00ff41", backgroundColor: "#00ff4108" }}
            >
              $ git clone nas-core
            </a>
            <a
              href="https://github.com/noetikalab/nas-web"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border px-6 py-3 font-mono text-sm font-medium transition-all duration-300 hover:scale-105"
              style={{ borderColor: "#00d4ff33", color: "#00d4ff", backgroundColor: "#00d4ff08" }}
            >
              在线演示 →
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <p className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2 font-mono text-xs animate-bounce" style={{ color: "#6b8299" }}>
          ↓ 向下滚动探索
        </p>
      </section>

      {/* ============================== ARCHITECTURE ============================== */}
      <section id="architecture" className="relative px-6 py-32" ref={archRef}>
        <div className="mx-auto max-w-4xl">
          <p className="mb-2 font-mono text-xs tracking-[0.3em] uppercase" style={{ color: "#00d4ff" }}>
            系统架构
          </p>
          <h2 className="mb-4 font-display text-4xl font-bold" style={{ color: "#d4e0f0" }}>
            4 种协议，1 个内核。
          </h2>
          <p className="mb-16 max-w-lg font-mono text-sm leading-relaxed" style={{ color: "#6b8299" }}>
            LDAP 为唯一身份源。Go authd 负责 JWT 认证、POSIX ACL 权限控制、
            mDNS 服务发现和 PUF 硬件认证。其余组件皆为传输层适配。
          </p>

          {/* Architecture diagram */}
          <div className="arch-item space-y-3 font-mono text-sm">
            <div className="rounded-xl border p-6" style={{ borderColor: "#1a2a3a" }}>
              <div className="flex flex-wrap items-center gap-2">
                <span style={{ color: "#00ff41" }}>Android</span>
                <span style={{ color: "#6b8299" }}>├── mDNS discovery →</span>
                <span style={{ color: "#00ff41" }}>React Native</span>
                <span style={{ color: "#6b8299" }}>├── REST JSON →</span>
              </div>
              <div className="my-4 h-px" style={{ background: "linear-gradient(90deg, transparent, #1a2a3a, transparent)" }} />
              <div className="rounded-lg p-4" style={{ backgroundColor: "#0a1119" }}>
                <span className="font-bold" style={{ color: "#00ff41" }}>Go authd</span>
                <span style={{ color: "#6b8299" }} className="ml-2">:8080</span>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {["", "", "PUF 签名", ""].map((m, idx) => {
                    const labels = ["JWT 认证", "POSIX ACL", "PUF 签名", "mDNS"];
                    return (
                      <span key={labels[idx]} className="rounded-md px-3 py-1.5 text-center text-xs" style={{ backgroundColor: "#050a0f", color: labels[idx] === "PUF 签名" ? "#00ff41" : "#6b8299" }}>
                        {labels[idx]}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="my-4 h-px" style={{ background: "linear-gradient(90deg, transparent, #1a2a3a, transparent)" }} />
              <div className="flex flex-wrap gap-3">
                {[
                  { label: "HTTP+JWT", color: "#00d4ff" },
                  { label: "WebDAV :8081", color: "#00ff41" },
                  { label: "SMB :445", color: "#ffa940" },
                  { label: "NFS :2049", color: "#ff6b9d" },
                  { label: "P2P :49.1", color: "#b388ff" },
                ].map((p) => (
                  <span
                    key={p.label}
                    className="rounded-md px-3 py-1 text-xs"
                    style={{ color: p.color, backgroundColor: p.color + "10" }}
                  >
                    {p.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="arch-item mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { value: "4", label: "协议" },
              { value: "1", label: "身份源" },
              { value: "22", label: "存证字段" },
              { value: "0", label: "云依赖" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border p-5 text-center" style={{ borderColor: "#1a2a3a" }}>
                <p className="mb-1 font-display text-3xl font-bold" style={{ color: "#00ff41" }}>{s.value}</p>
                <p className="text-xs" style={{ color: "#6b8299" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== FEATURES ============================== */}
      <section id="features" className="relative px-6 py-32" ref={featuresRef}>
        <div className="mx-auto max-w-6xl">
          <p className="mb-2 font-mono text-xs tracking-[0.3em] uppercase" style={{ color: "#b388ff" }}>
            工作原理
          </p>
          <h2 className="mb-16 font-display text-4xl font-bold" style={{ color: "#d4e0f0" }}>
            /dev/技术解析
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {features.map((f) => (
              <FeatureCard key={f.id} feature={f} />
            ))}
          </div>
        </div>
      </section>

      {/* ============================== PUF PROOF CHAIN ============================== */}
      <section id="proof" className="relative px-6 py-32" ref={proofRef}>
        <div className="mx-auto max-w-4xl">
          <p className="mb-2 font-mono text-xs tracking-[0.3em] uppercase" style={{ color: "#ffa940" }}>
            存证链
          </p>
          <h2 className="mb-4 font-display text-4xl font-bold" style={{ color: "#d4e0f0" }}>
            不可篡改。可验证。可导出。
          </h2>
          <p className="mb-16 max-w-lg font-mono text-sm leading-relaxed" style={{ color: "#6b8299" }}>
            每次文件操作经哈希计算后链式存储，由 PUF 签名锚定。持有导出的 ProofBundle
            和 PUF 公钥，即可独立验证完整操作历史。
          </p>

          {/* Hash chain visualization */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="proof-node flex items-center gap-4">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-xl font-mono text-xs font-bold"
                  style={{
                    border: `1px solid ${i < 4 ? "#00ff4133" : "#b388ff33"}`,
                    backgroundColor: i < 4 ? "#00ff4108" : "#b388ff08",
                    color: i < 4 ? "#00ff41" : "#b388ff",
                    boxShadow: i === 4 ? "0 0 20px #b388ff20" : "",
                  }}
                >
                  {i < 4 ? `OP${i + 1}` : "PUF"}
                </div>
                {i < 4 && (
                  <span className="font-mono text-lg" style={{ color: "#6b8299" }}>
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-8 text-center font-mono text-sm" style={{ color: "#00ff41" }}>
            OP1 → SM3 → OP2 → SM3 → ... → PUF SM2 签名 → ✅ 可验证存证包
          </p>
        </div>
      </section>

      {/* ============================== FOOTER ============================== */}
      <section id="stack" className="relative px-6 py-32" ref={footerRef}>
        <div className="mx-auto max-w-3xl">
          <p className="mb-2 font-mono text-xs tracking-[0.3em] uppercase" style={{ color: "#ff6b9d" }}>
            技术栈
          </p>
          <h2 className="mb-12 font-display text-4xl font-bold" style={{ color: "#d4e0f0" }}>
            核心技术
          </h2>
          <div className="flex flex-wrap gap-3">
            {techStack.map((tech) => (
              <span
                key={tech}
                className="tech-tag cursor-default rounded-lg border px-4 py-2 font-mono text-xs transition-all hover:scale-105"
                style={{ borderColor: "#1a2a3a", color: "#6b8299", backgroundColor: "#0a1119" }}
              >
                {tech}
              </span>
            ))}
          </div>

          <div className="mt-20 flex items-center justify-between border-t pt-8" style={{ borderColor: "#1a2a3a" }}>
            <p className="font-mono text-xs" style={{ color: "#6b8299" }}>
              <a
                href="https://github.com/noetikalab/nas-core"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-[#00ff41]"
              >
                github.com/noetikalab/nas-core
              </a>
            </p>
            <p className="font-mono text-xs" style={{ color: "#3a4a5a" }}>
              无 Cookie。无追踪。只有 NAS。
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
