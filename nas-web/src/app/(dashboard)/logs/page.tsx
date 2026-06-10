"use client";

/**
 * 审计日志页面 — admin 可查看所有操作存证记录。
 *
 * 主视图：表格列表（时间 / 用户 / 操作 / 路径 / 详情）
 * 详情弹窗：操作信息 + 文件元信息 + 内容指纹 + 哈希链位置
 */

import { useEffect, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollText, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";
import { logsApi } from "@/services";
import type { CertifiedOperation, ProofRecordResponse } from "@/lib/types";

const ACTION_LABELS: Record<string, string> = {
  upload: "上传",
  download: "下载",
  mkdir: "创建目录",
  delete: "删除",
  move: "移动",
};
const ACTION_BADGES: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  upload: "default",
  download: "secondary",
  mkdir: "outline",
  delete: "destructive",
  move: "outline",
};

function formatTime(ns: number): string {
  return new Date(ns / 1_000_000).toLocaleString("zh-CN");
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function LogsPage() {
  const [entries, setEntries] = useState<CertifiedOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // 详情弹窗
  const [detail, setDetail] = useState<CertifiedOperation | null>(null);
  const [proofRecord, setProofRecord] = useState<ProofRecordResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadLogs = async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await logsApi.list(p, 20);
      setEntries(res.entries);
      setTotalPages(res.total_pages);
      setTotal(res.total);
    } catch (e: any) {
      setError(e.message ?? "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(page); }, [page]);

  const openDetail = async (entry: CertifiedOperation) => {
    setDetail(entry);
    setProofRecord(null);
    setDetailLoading(true);
    try {
      const res = await logsApi.detail(entry.id);
      setProofRecord(res.proof_record);
    } catch {
      // 存证记录可能还不存在（puf-agent 未就绪时）——静默处理
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const bundle = await logsApi.bundle(1);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nas-proof-bundle-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("存证包已导出");
    } catch {
      toast.error("导出失败");
    }
  };

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">审计日志</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "加载中..." : `共 ${total} 条记录`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={total === 0}>
          <Download className="size-4" />
          导出存证包
        </Button>
      </div>

      {/* 内容 */}
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : error ? (
        <div className="text-center py-8 text-sm text-destructive">
          <p>{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => loadLogs(page)}>重试</Button>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <ScrollText className="mx-auto size-8 mb-2 opacity-50" />
          暂无操作记录
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>用户</TableHead>
                <TableHead>操作</TableHead>
                <TableHead>文件</TableHead>
                <TableHead className="w-20">详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTime(e.timestamp)}
                  </TableCell>
                  <TableCell className="font-medium">{e.user_name}</TableCell>
                  <TableCell>
                    <Badge variant={ACTION_BADGES[e.action] || "secondary"}>
                      {ACTION_LABELS[e.action] || e.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-48 truncate">
                    {e.file_name || e.path.split("/").pop()}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openDetail(e)}>
                      查看
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline" size="icon" disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline" size="icon" disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* 详情弹窗 */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) { setDetail(null); setProofRecord(null); } }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>操作详情 — #{detail?.id}</DialogTitle>
          </DialogHeader>

          {detail && (
            <div className="space-y-4 text-sm">
              {/* 操作信息 */}
              <Section title="操作信息">
                <InfoRow label="时间" value={formatTime(detail.timestamp)} />
                <InfoRow label="类型" value={detail.type} />
                <InfoRow label="用户" value={`${detail.user_name} (UID: ${detail.user_uid})`} />
                <InfoRow label="操作" value={ACTION_LABELS[detail.action] || detail.action}
                  badge={detail.action as keyof typeof ACTION_BADGES} />
                <InfoRow label="路径" value={detail.path} mono />
                {detail.dest_path && <InfoRow label="目标路径" value={detail.dest_path} mono />}
                {detail.detail && <InfoRow label="备注" value={detail.detail} />}
              </Section>

              {/* 文件元信息 */}
              <Section title="文件元信息">
                <InfoRow label="文件名" value={detail.file_name} />
                <InfoRow label="类型" value={detail.is_dir ? "目录" : detail.mime_type || "—"} />
                <InfoRow label="大小" value={detail.is_dir ? "—" : formatSize(detail.file_size)} />
                <InfoRow label="所有者" value={`${detail.owner_name || "—"} (${detail.owner_uid})`} />
                <InfoRow label="组" value={detail.group_name || "—"} />
                <InfoRow label="权限" value={detail.file_perm || "—"} mono />
                <InfoRow label="修改时间" value={detail.mod_time ? formatTime(detail.mod_time) : "—"} />
              </Section>

              {/* 内容指纹 */}
              <Section title="内容指纹">
                <InfoRow label="哈希算法" value={detail.hash_algo || "—"} />
                {detail.file_hash ? (
                  <InfoRow label="文件哈希" value={detail.file_hash} mono truncate />
                ) : (
                  <InfoRow label="文件哈希" value="（非文件操作或无内容指纹）" />
                )}
              </Section>

              {/* 哈希链 */}
              <Section title="哈希链">
                {detailLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : proofRecord ? (
                  <>
                    <InfoRow label="链序号" value={`#${proofRecord.chain_index}`} />
                    {proofRecord.prev_hash && <InfoRow label="前驱哈希" value={proofRecord.prev_hash} mono truncate />}
                    <InfoRow label="本链哈希" value={proofRecord.data_hash} mono truncate />
                    <InfoRow label="哈希算法" value={proofRecord.hash_algo} />
                    {proofRecord.signature ? (
                      <InfoRow label="PUF 签名" value="已签名" />
                    ) : (
                      <div className="text-xs text-muted-foreground pt-1">
                        PUF 签名待启用（puf-agent 就绪后自动签名）
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    存证记录尚不可用
                  </div>
                )}
              </Section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** 详情弹窗中的 section 标题 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </h3>
      <div className="space-y-1 rounded-md border bg-muted/30 p-3">
        {children}
      </div>
    </div>
  );
}

/** 详情弹窗中的单行信息 */
function InfoRow({
  label, value, mono, truncate, badge,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
  badge?: string;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      {badge ? (
        <Badge variant={ACTION_BADGES[badge] as "default" | "secondary" | "outline" | "destructive" || "secondary"}>
          {value}
        </Badge>
      ) : (
        <span className={`${mono ? "font-mono" : ""} ${truncate ? "truncate" : "break-all"}`}>
          {value}
        </span>
      )}
    </div>
  );
}
