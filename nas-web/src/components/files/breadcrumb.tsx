"use client";

/**
 * Breadcrumb — 文件路径面包屑导航
 *
 * 将 /data/alice/photos 展示为 可点击的路径段：
 *   [data] > [alice] > [photos]
 *
 * 最后一段（当前目录）不可点击（已在此处）。
 * 点击前面的段会跳转到对应层级。
 *
 * Props：
 *   - path: 当前完整路径，如 "/data/alice/photos"
 *   - onNavigate: 点击面包屑段时回调，传入目标路径
 */

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";

interface BreadcrumbProps {
  /** 当前完整路径 */
  path: string;
  /** 点击面包屑段时导航到目标路径 */
  onNavigate: (targetPath: string) => void;
}

/**
 * 将路径 "/data/alice/photos" 拆分为：
 * [{ label: "data", path: "/data" }, { label: "alice", path: "/data/alice" }, ...]
 */
interface Segment {
  label: string;
  path: string;
}

function parseSegments(fullPath: string): Segment[] {
  // 去掉首尾斜杠后拆分
  const parts = fullPath.replace(/^\/|\/$/g, "").split("/");
  const segments: Segment[] = [];
  let accumulated = "";
  for (const part of parts) {
    accumulated += "/" + part;
    segments.push({ label: part, path: accumulated });
  }
  return segments;
}

export function Breadcrumb({ path, onNavigate }: BreadcrumbProps) {
  const segments = useMemo(() => parseSegments(path), [path]);

  if (segments.length === 0) return null;

  return (
    <nav
      aria-label="文件路径"
      className="flex items-center gap-1 text-sm text-muted-foreground"
    >
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={seg.path} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0" />}
            {isLast ? (
              // 最后一个段 — 当前目录，不可点击，高亮显示
              <span className="font-medium text-foreground">{seg.label}</span>
            ) : (
              // 前面的段 — 可点击导航
              <button
                type="button"
                className="cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-accent hover:text-accent-foreground"
                onClick={() => onNavigate(seg.path)}
              >
                {seg.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
