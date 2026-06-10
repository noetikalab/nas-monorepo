"use client";

/**
 * TextPreview — 代码/文本文件语法高亮预览组件。
 *
 * 使用 shiki 进行语法高亮渲染：
 *   1. 根据文件扩展名推断编程语言
 *   2. 调用 shiki 的 codeToHtml 生成带高亮的 HTML
 *   3. 通过 dangerouslySetInnerHTML 渲染（shiki 输出是可信的）
 *
 * 支持暗色/亮色主题自动切换（github-dark / github-light）。
 * 限制：文件大小 ≤ 2MB，超过时显示提示而非卡死浏览器。
 */

import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";
import { Loader2, FileText } from "lucide-react";
import { useFileText } from "./use-file-blob";

/** 扩展名 → shiki 语言标识映射 */
const EXT_LANG_MAP: Record<string, string> = {
  // Web
  js: "javascript", jsx: "jsx", ts: "typescript", tsx: "tsx",
  html: "html", css: "css", scss: "scss", less: "less",
  vue: "vue", svelte: "svelte", astro: "astro",
  // 配置
  json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
  xml: "xml", ini: "ini", env: "shell",
  // 后端
  go: "go", rs: "rust", py: "python", rb: "ruby",
  java: "java", kt: "kotlin", cs: "csharp", cpp: "cpp",
  c: "c", h: "c", hpp: "cpp", php: "php",
  // Shell
  sh: "bash", bash: "bash", zsh: "bash", fish: "fish",
  // 文档
  md: "markdown", mdx: "mdx", tex: "latex",
  // 数据库
  sql: "sql",
  // Docker / 基础设施
  dockerfile: "dockerfile",
  // 其他
  makefile: "makefile", cmake: "cmake",
  graphql: "graphql", proto: "protobuf",
  lua: "lua", dart: "dart", swift: "swift",
  r: "r", scala: "scala", zig: "zig",
};

/**
 * 根据文件名推断 shiki 语言标识。
 * 优先精确匹配文件名（如 Dockerfile），再按扩展名匹配。
 */
function detectLanguage(fileName: string): string {
  const lower = fileName.toLowerCase();
  // 特殊文件名
  if (lower === "dockerfile") return "dockerfile";
  if (lower === "makefile") return "makefile";
  if (lower === ".gitignore" || lower === ".dockerignore") return "shell";

  const ext = lower.split(".").pop() ?? "";
  return EXT_LANG_MAP[ext] || "text";
}

interface TextPreviewProps {
  /** 文件完整路径 */
  filePath: string;
  /** 文件名（用于推断语言） */
  fileName: string;
}

export function TextPreview({ filePath, fileName }: TextPreviewProps) {
  const { text, loading: textLoading, error: textError } = useFileText(filePath);
  const [html, setHtml] = useState<string | null>(null);
  const [highlighting, setHighlighting] = useState(false);

  // 文本内容加载完成后进行语法高亮
  useEffect(() => {
    if (!text) {
      setHtml(null);
      return;
    }

    let cancelled = false;
    setHighlighting(true);

    async function highlight() {
      try {
        const lang = detectLanguage(fileName);
        const result = await codeToHtml(text!, {
          lang,
          // 同时指定双主题，通过 CSS class 切换
          themes: {
            light: "github-light",
            dark: "github-dark",
          },
        });
        if (!cancelled) setHtml(result);
      } catch {
        // 高亮失败时回退为纯文本
        if (!cancelled) setHtml(`<pre class="p-4 text-sm">${escapeHtml(text!)}</pre>`);
      } finally {
        if (!cancelled) setHighlighting(false);
      }
    }

    highlight();
    return () => { cancelled = true; };
  }, [text, fileName]);

  // 加载中
  if (textLoading || highlighting) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">{textLoading ? "加载文件..." : "语法高亮中..."}</span>
      </div>
    );
  }

  // 错误
  if (textError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive">
        <FileText className="size-8" />
        <p className="text-sm">{textError}</p>
      </div>
    );
  }

  // 渲染高亮 HTML
  if (html) {
    return (
      <div
        className="overflow-auto h-full text-sm [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:rounded-md"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return null;
}

/** HTML 实体转义（回退用） */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
