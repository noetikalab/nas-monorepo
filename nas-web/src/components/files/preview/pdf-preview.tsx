"use client";

/**
 * PdfPreview — PDF 文件预览组件。
 *
 * 使用 react-pdf（基于 pdf.js）渲染 PDF 文件：
 *   - 通过 useFileBlob 获取 PDF 的 Blob URL
 *   - 支持翻页导航（上一页/下一页）
 *   - 显示总页数和当前页码
 *   - 自适应容器宽度
 *
 * 注意：react-pdf v10 需要配置 worker（从 pdfjs-dist 加载），
 * 这里通过 CDN 加载 worker 以避免 webpack 配置复杂度。
 */

import { useState, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Loader2, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { useFileBlob } from "./use-file-blob";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

interface PdfPreviewProps {
  /** 文件完整路径 */
  filePath: string;
  /** 文件名 */
  fileName: string;
}

export function PdfPreview({ filePath, fileName }: PdfPreviewProps) {
  const { blobUrl, loading, error } = useFileBlob(filePath);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);

  // 仅在客户端配置 pdf.worker（避免 SSR 时 pdfjs 的 Node.js 环境警告）
  useEffect(() => {
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }, []);

  /** PDF 加载完成回调 — 获取总页数 */
  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setPageNumber(1);
  }, []);

  // 加载中
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">加载 PDF...</span>
      </div>
    );
  }

  // 错误
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive">
        <FileText className="size-8" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!blobUrl) return null;

  return (
    <div className="flex flex-col h-full">
      {/* 翻页控制栏 */}
      <div className="flex items-center justify-center gap-3 py-2 border-b border-border shrink-0">
        <button
          type="button"
          className="p-1 rounded hover:bg-accent disabled:opacity-30 cursor-pointer"
          disabled={pageNumber <= 1}
          onClick={() => setPageNumber((p) => p - 1)}
          aria-label="上一页"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-xs text-muted-foreground">
          {pageNumber} / {numPages || "..."}
        </span>
        <button
          type="button"
          className="p-1 rounded hover:bg-accent disabled:opacity-30 cursor-pointer"
          disabled={pageNumber >= numPages}
          onClick={() => setPageNumber((p) => p + 1)}
          aria-label="下一页"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* PDF 渲染区域 */}
      <div className="flex-1 overflow-auto flex justify-center p-4">
        <Document
          file={blobUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-sm">解析 PDF...</span>
            </div>
          }
          error={
            <div className="text-sm text-destructive">
              PDF 解析失败：{fileName}
            </div>
          }
        >
          <Page
            pageNumber={pageNumber}
            width={500}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  );
}
