# UI 设计系统 —「Precision」

## 设计概念

面向家庭用户的 NAS 管理后台。界面如精密仪器——冷峻、克制、可信赖。

**气质关键词**：精密 · 克制 · 简洁 · 专业

## 色彩体系

全线黑白灰，仅 `--ring`（聚焦环）使用灰蓝色调。采用 oklch 色彩空间。

### Light Mode

| Token | 值 | 用途 |
|-------|------|------|
| `--background` | oklch(1 0 0) | 页面背景 |
| `--foreground` | oklch(0.145 0 0) | 主文字 |
| `--card` | oklch(1 0 0) | 卡片背景 |
| `--muted` | oklch(0.97 0 0) | 次要背景 |
| `--muted-foreground` | oklch(0.556 0 0) | 辅助文字 |
| `--primary` | oklch(0.205 0 0) | 强调（按钮/选中态） |
| `--border` | oklch(0.922 0 0) | 边框/分割线 |
| `--destructive` | oklch(0.577 0.245 27.325) | 危险操作 |

### Dark Mode

| Token | 值 | 用途 |
|-------|------|------|
| `--background` | oklch(0.145 0 0) | 页面背景 |
| `--foreground` | oklch(0.985 0 0) | 主文字 |
| `--card` | oklch(0.205 0 0) | 卡片背景 |
| `--primary` | oklch(0.922 0 0) | 强调 |
| `--border` | oklch(1 0 0 / 10%) | 边框 |

## 字体

| 用途 | 字体 | CSS 变量 |
|------|------|----------|
| 标题/正文 | Geist Sans | `--font-geist-sans` |
| 数据/代码 | Geist Mono | `--font-geist-mono` |

通过 `next/font/google` 加载，自动子集化。

## 布局

### 侧栏模式（默认）

- 侧栏宽度：240px（折叠 56px）
- 顶栏高度：56px
- 选中态：左侧 2px 竖线指示器

### 顶栏模式

- 顶栏高度：56px
- 导航水平排列
- 选中态：底部 2px 下划线指示器

切换通过 NavProvider 管理，localStorage 持久化。

## 组件规范

使用 shadcn/ui (Radix + Nova 预设) 作为基础，通过 CSS 变量覆盖实现自定义美学。

### 圆角

```
--radius: 0.625rem (10px)
--radius-sm: 8px
--radius-md: 10px
--radius-lg: 12px
```

### 间距

内容区域统一使用 `p-6`（24px）。卡片间距 `gap-4`（16px）。

### 过渡

```
--transition-fast: 150ms ease
--transition-normal: 200ms ease
```

## 主题切换

三种模式：System / Light / Dark

- 实现：`<html class="dark">` 切换
- 存储：localStorage `nas-theme`
- 切换按钮循环：Light → Dark → System

## 相关文章
- [[architecture]] — 设计系统的架构基础
