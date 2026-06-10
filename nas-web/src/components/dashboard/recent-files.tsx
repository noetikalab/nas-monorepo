"use client";

/**
 * RecentFiles — 最近文件操作列表
 * 展示最近 10 条文件操作记录（上传/下载/删除/新建/移动）
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes, formatTime, basename } from "@/lib/utils";
import type { RecentEntry } from "@/lib/types";

interface RecentFilesProps {
  entries: RecentEntry[];
}

const actionLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  upload: { label: "上传", variant: "default" },
  download: { label: "下载", variant: "secondary" },
  delete: { label: "删除", variant: "destructive" },
  mkdir: { label: "新建", variant: "outline" },
  move: { label: "移动", variant: "outline" },
};

export function RecentFiles({ entries }: RecentFilesProps) {
  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">最近操作</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">暂无操作记录</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">最近操作</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>文件名</TableHead>
              <TableHead>操作</TableHead>
              <TableHead>用户</TableHead>
              <TableHead>大小</TableHead>
              <TableHead>时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry, i) => {
              const actionMeta = actionLabels[entry.action] || {
                label: entry.action,
                variant: "secondary" as const,
              };
              return (
                <TableRow key={`${entry.path}-${i}`}>
                  <TableCell className="font-medium">
                    {basename(entry.path)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={actionMeta.variant}>{actionMeta.label}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{entry.user}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.size > 0 ? formatBytes(entry.size) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatTime(entry.time)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
