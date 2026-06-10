"use client";

/**
 * Dashboard 图表组件
 * 使用 recharts 渲染存储环形图、CPU/内存面积图
 */

import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes } from "@/lib/utils";
import type { DashboardStats } from "@/lib/types";

interface ChartsProps {
  stats: DashboardStats | null;
}

export function DashboardCharts({ stats }: ChartsProps) {
  if (!stats) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="h-48 animate-pulse bg-muted/50" />
          </Card>
        ))}
      </div>
    );
  }

  const storageData = [
    { name: "已用", value: stats.storage_used },
    { name: "剩余", value: Math.max(0, stats.storage_total - stats.storage_used) },
  ];

  const cpuHistory = generatePseudoHistory(stats.cpu_percent, 12);
  const memHistory = generatePseudoHistory(
    stats.mem_total > 0 ? (stats.mem_used / stats.mem_total) * 100 : 0,
    12,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* 存储环形图 */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            存储占用
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={storageData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={65}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                <Cell fill="var(--foreground)" />
                <Cell fill="var(--muted)" />
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(val) => [formatBytes(Number(val)), ""]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="text-center text-xs text-muted-foreground">
            {formatBytes(stats.storage_used)} / {formatBytes(stats.storage_total)}
          </div>
        </CardContent>
      </Card>

      {/* CPU 面积图 */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            CPU 使用率
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={cpuHistory}>
              <defs>
                <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis domain={[0, 100]} hide />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(val) => [`${Number(val).toFixed(1)}%`, "CPU"]}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke="var(--foreground)"
                fill="url(#cpuGrad)"
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="text-center text-xs text-muted-foreground">
            当前 {stats.cpu_percent.toFixed(1)}%
          </div>
        </CardContent>
      </Card>

      {/* 内存面积图 */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            内存使用率
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={memHistory}>
              <defs>
                <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--muted-foreground)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="var(--muted-foreground)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis domain={[0, 100]} hide />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(val) => [`${Number(val).toFixed(1)}%`, "内存"]}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke="var(--muted-foreground)"
                fill="url(#memGrad)"
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="text-center text-xs text-muted-foreground">
            {stats.mem_total > 0
              ? `${((stats.mem_used / stats.mem_total) * 100).toFixed(1)}%`
              : "—"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** 根据当前值生成一组伪历史数据点，模拟波动曲线 */
function generatePseudoHistory(
  current: number,
  count: number,
): { t: string; v: number }[] {
  const points: { t: string; v: number }[] = [];
  for (let i = 0; i < count; i++) {
    const jitter = (Math.sin(i * 1.2) * 8 + (Math.random() - 0.5) * 10);
    const v = Math.max(0, Math.min(100, current + jitter));
    points.push({ t: `${i}`, v: Math.round(v * 10) / 10 });
  }
  return points;
}
