"use client";

/**
 * AudioPreview — 音频文件预览组件。
 *
 * 使用 react-player 播放音频文件：
 *   - 支持 mp3、wav、ogg、flac、aac 等常见格式
 *   - 提供播放/暂停、进度条、音量控制
 *   - 居中展示播放器 UI（固定高度）
 *
 * 音频通过 useFileBlob 获取 Blob URL。
 */

import dynamic from "next/dynamic";
import { Loader2, Music } from "lucide-react";
import { useFileBlob } from "./use-file-blob";

/** ReactPlayer 所需最小属性定义（避免 dynamic 丢失类型） */
interface PlayerProps {
  url: string;
  controls?: boolean;
  width?: string | number;
  height?: string | number;
}

// ReactPlayer 不支持 SSR，动态导入
const ReactPlayer = dynamic(() => import("react-player"), {
  ssr: false,
}) as unknown as React.ComponentType<PlayerProps>;

interface AudioPreviewProps {
  /** 文件完整路径 */
  filePath: string;
  /** 文件名 */
  fileName: string;
}

export function AudioPreview({ filePath, fileName }: AudioPreviewProps) {
  const { blobUrl, loading, error } = useFileBlob(filePath);

  // 加载中
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">加载音频...</span>
      </div>
    );
  }

  // 错误
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive">
        <Music className="size-8" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!blobUrl) return null;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-4">
      {/* 音频图标 */}
      <div className="flex flex-col items-center gap-2">
        <Music className="size-16 text-muted-foreground" />
        <p className="text-sm text-muted-foreground truncate max-w-60">{fileName}</p>
      </div>

      {/* 播放器 */}
      <ReactPlayer
        url={blobUrl}
        controls
        width="100%"
        height="54px"
      />
    </div>
  );
}
