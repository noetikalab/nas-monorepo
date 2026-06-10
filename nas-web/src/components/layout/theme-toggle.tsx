"use client";

/**
 * ThemeToggle — 主题切换按钮
 * 循环切换 light → dark → system
 */

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/providers/theme-provider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const themeIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

const themeLabels = {
  light: "浅色模式",
  dark: "深色模式",
  system: "跟随系统",
} as const;

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme();

  const cycle = () => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
  };

  const Icon = themeIcons[theme];

  if (!collapsed) {
    return (
      <Button
        variant="ghost"
        className="w-full justify-start gap-3"
        onClick={cycle}
      >
        <Icon className="h-4 w-4" />
        <span className="text-sm">{themeLabels[theme]}</span>
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={cycle}>
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{themeLabels[theme]}</TooltipContent>
    </Tooltip>
  );
}
