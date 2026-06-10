"use client";

/**
 * ImagePreview — 图片预览组件（支持缩放查看）。
 *
 * 使用 react-medium-image-zoom 提供点击放大功能：
 *   - 默认显示适配容器的图片
 *   - 点击/触摸后放大为原始尺寸，可平移查看细节
 *   - 再次点击或按 Esc 缩小回去
 *
 * 图片通过 useFileBlob 获取（需要 Bearer Token 认证），
 * 生成 Blob URL 后渲染。
 */

import { Loader2, ImageIcon } from "lucide-react";
import Zoom from "react-medium-image-zoom";
import "react-medium-image-zoom/dist/styles.css";
import { useFileBlob } from "./use-file-blob";

interface ImagePreviewProps {
  /** 文件完整路径 */
  filePath: string;
  /** 文件名（用于 alt 文本） */
  fileName: string;
}

export function ImagePreview({ filePath, fileName }: ImagePreviewProps) {
  const { blobUrl, loading, error } = useFileBlob(filePath);

  // 加载中
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">加载图片...</span>
      </div>
    );
  }

  // 错误
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive">
        <ImageIcon className="size-8" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  // 图片渲染 + 缩放
  if (blobUrl) {
    return (
      <div className="flex items-center justify-center h-full p-4 overflow-auto">
        <Zoom>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={blobUrl}
            alt={fileName}
            className="max-w-full max-h-[70vh] object-contain rounded-md"
          />
        </Zoom>
      </div>
    );
  }

  return null;
}
