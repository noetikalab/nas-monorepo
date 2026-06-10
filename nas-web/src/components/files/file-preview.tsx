"use client";

/**
 * FilePreview — 文件预览面板（Sheet 侧滑）。
 *
 * 从右侧滑出的面板，根据文件扩展名分发到对应的预览组件：
 *   - 文本/代码 → TextPreview（shiki 语法高亮）
 *   - 图片 → ImagePreview（缩放查看器）
 *   - PDF → PdfPreview（react-pdf 翻页）
 *   - 视频 → VideoPreview（react-player）
 *   - 音频 → AudioPreview（react-player）
 *   - 其他 → GenericPreview（文件信息 + 下载）
 *
 * 使用 shadcn/ui 的 Sheet 组件作为容器，宽度扩展为 lg 以提供足够的预览空间。
 */

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Download, X } from "lucide-react";
import { filesApi } from "@/services";
import { TextPreview } from "./preview/text-preview";
import { ImagePreview } from "./preview/image-preview";
import { PdfPreview } from "./preview/pdf-preview";
import { VideoPreview } from "./preview/video-preview";
import { AudioPreview } from "./preview/audio-preview";
import { GenericPreview } from "./preview/generic-preview";

// ============================================================
// 扩展名分类表 — 决定使用哪个预览组件
// ============================================================

/** 文本/代码类扩展名（可用 shiki 高亮） */
const TEXT_EXTENSIONS = new Set([
  // Web
  "js", "jsx", "ts", "tsx", "html", "css", "scss", "less", "vue", "svelte", "astro",
  // 配置
  "json", "yaml", "yml", "toml", "xml", "ini", "env", "conf", "cfg",
  // 后端
  "go", "rs", "py", "rb", "java", "kt", "cs", "cpp", "c", "h", "hpp", "php",
  // Shell
  "sh", "bash", "zsh", "fish", "bat", "ps1",
  // 文档
  "md", "mdx", "tex", "txt", "log", "csv",
  // 数据库
  "sql",
  // 基础设施
  "dockerfile", "makefile", "cmake",
  // 其他
  "graphql", "proto", "lua", "dart", "swift", "r", "scala", "zig",
  "gitignore", "dockerignore", "editorconfig", "prettierrc", "eslintrc",
]);

/** 图片类扩展名 */
const IMAGE_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "avif", "tiff", "tif",
]);

/** PDF */
const PDF_EXTENSIONS = new Set(["pdf"]);

/** 视频类扩展名 */
const VIDEO_EXTENSIONS = new Set([
  "mp4", "webm", "ogg", "ogv", "mov", "avi", "mkv", "flv", "wmv", "m4v",
]);

/** 音频类扩展名 */
const AUDIO_EXTENSIONS = new Set([
  "mp3", "wav", "ogg", "oga", "flac", "aac", "m4a", "wma", "opus",
]);

/** 预览类型枚举 */
type PreviewType = "text" | "image" | "pdf" | "video" | "audio" | "generic";

/**
 * 根据文件名推断预览类型。
 * 优先匹配特殊文件名（如 Dockerfile），再按扩展名分类。
 */
function getPreviewType(fileName: string): PreviewType {
  const lower = fileName.toLowerCase();

  // 特殊文件名（无扩展名的文本文件）
  const specialFiles = ["dockerfile", "makefile", "gemfile", "rakefile", "procfile"];
  if (specialFiles.includes(lower)) return "text";

  // 提取扩展名
  const dotIndex = lower.lastIndexOf(".");
  if (dotIndex < 0) return "generic"; // 无扩展名默认为通用预览
  const ext = lower.slice(dotIndex + 1);

  if (TEXT_EXTENSIONS.has(ext)) return "text";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (PDF_EXTENSIONS.has(ext)) return "pdf";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";
  return "generic";
}

// ============================================================
// 组件
// ============================================================

interface FilePreviewProps {
  /** 是否打开预览面板 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 当前预览的文件完整路径（如 /data/alice/code.ts） */
  filePath: string | null;
  /** 文件名 */
  fileName: string;
  /** 文件大小（字节） */
  fileSize: number;
  /** 修改时间 ISO 字符串 */
  modified: string;
}

export function FilePreview({
  open,
  onClose,
  filePath,
  fileName,
  fileSize,
  modified,
}: FilePreviewProps) {
  /** 触发下载 */
  const handleDownload = () => {
    if (filePath) {
      filesApi.download(filePath, fileName);
    }
  };

  // 确定预览类型
  const previewType = getPreviewType(fileName);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-2xl lg:max-w-4xl p-0 flex flex-col"
      >
        {/* 头部：文件名 + 操作按钮 */}
        <SheetHeader className="px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-sm font-medium truncate">{fileName}</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground truncate">
                {filePath}
              </SheetDescription>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {/* 下载按钮 */}
              <button
                type="button"
                className="p-1.5 rounded-md hover:bg-accent cursor-pointer"
                onClick={handleDownload}
                title="下载文件"
              >
                <Download className="size-4" />
              </button>
              {/* 关闭按钮 */}
              <button
                type="button"
                className="p-1.5 rounded-md hover:bg-accent cursor-pointer"
                onClick={onClose}
                title="关闭预览"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </SheetHeader>

        {/* 预览内容区域 — 根据类型分发 */}
        <div className="flex-1 overflow-hidden">
          {filePath && (
            <PreviewDispatcher
              type={previewType}
              filePath={filePath}
              fileName={fileName}
              fileSize={fileSize}
              modified={modified}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================
// 预览分发器 — 根据类型渲染对应组件
// ============================================================

interface PreviewDispatcherProps {
  type: PreviewType;
  filePath: string;
  fileName: string;
  fileSize: number;
  modified: string;
}

function PreviewDispatcher({ type, filePath, fileName, fileSize, modified }: PreviewDispatcherProps) {
  switch (type) {
    case "text":
      return <TextPreview filePath={filePath} fileName={fileName} />;
    case "image":
      return <ImagePreview filePath={filePath} fileName={fileName} />;
    case "pdf":
      return <PdfPreview filePath={filePath} fileName={fileName} />;
    case "video":
      return <VideoPreview filePath={filePath} fileName={fileName} />;
    case "audio":
      return <AudioPreview filePath={filePath} fileName={fileName} />;
    default:
      return (
        <GenericPreview
          filePath={filePath}
          fileName={fileName}
          fileSize={fileSize}
          modified={modified}
        />
      );
  }
}
