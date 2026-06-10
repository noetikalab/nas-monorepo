"use client";

import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { id: "hero", label: "首页" },
  { id: "architecture", label: "架构" },
  { id: "features", label: "功能" },
  { id: "proof", label: "存证链" },
  { id: "stack", label: "技术栈" },
];

export default function Header() {
  const [active, setActive] = useState("hero");
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );

    NAV_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b bg-[#050a0f]/80 backdrop-blur-xl"
          : "bg-transparent"
      }`}
      style={{ borderColor: scrolled ? "#1a2a3a" : "transparent" }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        {/* Brand */}
        <button
          onClick={() => scrollTo("hero")}
          className="cursor-pointer font-mono text-sm tracking-[0.3em] uppercase transition-colors hover:text-[#00ff41]"
          style={{ color: "#00ff41" }}
        >
          <span className="cursor-blink">$</span> nas-core
        </button>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className="cursor-pointer rounded-md px-3 py-1.5 font-mono text-xs transition-all"
              style={{
                color: active === item.id ? "#00ff41" : "#6b8299",
                backgroundColor: active === item.id ? "#00ff410a" : "transparent",
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="cursor-pointer flex flex-col gap-1 p-2 sm:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="菜单"
        >
          <span
            className="block h-px w-5 transition-all"
            style={{
              backgroundColor: menuOpen ? "#00ff41" : "#6b8299",
              transform: menuOpen ? "rotate(45deg) translate(3px, 3px)" : "none",
            }}
          />
          <span
            className="block h-px w-5 transition-all"
            style={{
              backgroundColor: "#6b8299",
              opacity: menuOpen ? 0 : 1,
            }}
          />
          <span
            className="block h-px w-5 transition-all"
            style={{
              backgroundColor: menuOpen ? "#00ff41" : "#6b8299",
              transform: menuOpen ? "rotate(-45deg) translate(3px, -3px)" : "none",
            }}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav
          className="border-t sm:hidden"
          style={{ borderColor: "#1a2a3a", backgroundColor: "#050a0f" }}
        >
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className="cursor-pointer block w-full px-6 py-3 text-left font-mono text-sm transition-colors"
              style={{
                color: active === item.id ? "#00ff41" : "#6b8299",
                backgroundColor: active === item.id ? "#00ff4108" : "transparent",
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}
