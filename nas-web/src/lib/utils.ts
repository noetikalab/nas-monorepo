import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import dayjs from "dayjs"
import duration from "dayjs/plugin/duration"

dayjs.extend(duration)

/** shadcn/ui 标准工具：合并 Tailwind 类名，自动去重和处理冲突 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 将字节数格式化为人类可读的字符串。
 * 例如：formatBytes(2411724800) → "2.25 GB"
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = bytes / Math.pow(k, i)
  return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

/**
 * 将秒数格式化为人类可读的运行时长。
 * 例如：formatUptime(90061) → "1 天 1 时 1 分"
 */
export function formatUptime(seconds: number): string {
  const dur = dayjs.duration(seconds, "seconds")
  const d = Math.floor(dur.asDays())
  const h = dur.hours()
  const m = dur.minutes()
  const parts: string[] = []
  if (d > 0) parts.push(`${d} 天`)
  if (h > 0) parts.push(`${h} 时`)
  if (m > 0) parts.push(`${m} 分`)
  return parts.length > 0 ? parts.join(" ") : "不到 1 分钟"
}

/**
 * 将 RFC3339 时间字符串格式化为本地友好的显示格式。
 * 例如：formatTime("2026-05-25T14:32:00Z") → "05-25 14:32"
 */
export function formatTime(isoStr: string): string {
  return dayjs(isoStr).format("MM-DD HH:mm")
}

/**
 * 从完整路径中提取文件名。
 * 例如：basename("/data/alice/document.pdf") → "document.pdf"
 */
export function basename(path: string): string {
  const parts = path.replace(/\/+$/, "").split("/")
  return parts[parts.length - 1] || "/"
}

/**
 * 从完整路径中提取父目录路径。
 * 例如：dirname("/data/alice/document.pdf") → "/data/alice"
 */
export function dirname(path: string): string {
  const parts = path.replace(/\/+$/, "").split("/")
  parts.pop()
  return parts.join("/") || "/"
}
