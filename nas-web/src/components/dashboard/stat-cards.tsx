"use client";

/**
 * StatCards — Dashboard 4 个统计卡片
 * 展示：存储用量、CPU、内存、运行时长
 */

import { HardDrive, Cpu, MemoryStick, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes, formatUptime } from "@/lib/utils";
import type { DashboardStats } from "@/lib/types";

interface StatCardsProps {
  stats: DashboardStats | null;
}

export function StatCards({ stats }: StatCardsProps) {
  if (!stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="h-24 animate-pulse bg-muted/50" />
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "存储用量",
      value: `${formatBytes(stats.storage_used)} / ${formatBytes(stats.storage_total)}`,
      sub: `${((stats.storage_used / stats.storage_total) * 100).toFixed(1)}%`,
      icon: HardDrive,
    },
    {
      title: "CPU",
      value: `${stats.cpu_percent.toFixed(1)}%`,
      sub: "使用率",
      icon: Cpu,
    },
    {
      title: "内存",
      value: `${formatBytes(stats.mem_used)} / ${formatBytes(stats.mem_total)}`,
      sub: `${((stats.mem_used / stats.mem_total) * 100).toFixed(1)}%`,
      icon: MemoryStick,
    },
    {
      title: "运行时长",
      value: formatUptime(stats.uptime),
      sub: "已运行",
      icon: Clock,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.sub}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
