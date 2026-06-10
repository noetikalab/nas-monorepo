"use client";

/**
 * VideoPreview — 视频文件预览组件。
 *
 * 使用 react-player 播放视频文件：
 *   - 支持 mp4、webm、ogg、mov 等常见格式
 *   - 提供播放/暂停、进度条、音量控制
 *   - 自适应容器尺寸
 *
 * 视频通过 useFileBlob 获取 Blob URL（需要 Bearer Token），
 * 然后传递给 ReactPlayer 的 url 属性。
 */

import dynamic from "next/dynamic";
import { Loader2, Video } from "lucide-react";
import { useFileBlob } from "./use-file-blob";

/** ReactPlayer 所需最小属性定义（避免 dynamic 丢失类型） */
interface PlayerProps {
  url: string;
  controls?: boolean;
  width?: string | number;
  height?: string | number;
  style?: React.CSSProperties;
}

// ReactPlayer 不支持 SSR，动态导入
const ReactPlayer = dynamic(() => import("react-player"), {
  ssr: false,
}) as unknown as React.ComponentType<PlayerProps>;

interface VideoPreviewProps {
  /** 文件完整路径 */
  filePath: string;
  /** 文件名 */
  fileName: string;
}

export function VideoPreview({ filePath, fileName }: VideoPreviewProps) {
  const { blobUrl, loading, error } = useFileBlob(filePath);

  // 加载中
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">加载视频...</span>
      </div>
    );
  }

  // 错误
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive">
        <Video className="size-8" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!blobUrl) return null;

  return (
    <div className="flex items-center justify-center h-full p-4">
      <ReactPlayer
        url={blobUrl}
        controls
        width="100%"
        height="100%"
        style={{ maxHeight: "70vh" }}
      />
    </div>
  );
}
