# NasApp UI 设计规范 —「Precision」

> 基于 NAS 管理后台「Precision」设计系统，适配 React Native 移动端。
> 气质关键词：**精密 · 克制 · 简洁 · 专业**

---

## 一、色彩体系

全线黑白灰，无彩色强调色。仅功能性状态色（成功/危险）保留色彩。

### Design Tokens

```ts
// src/theme/tokens.ts
export const Colors = {
  // 核心
  background: '#FFFFFF',       // 页面背景
  foreground: '#1C1C1C',       // 主文字
  card:      '#FFFFFF',        // 卡片背景
  muted:     '#F5F5F5',        // 次要背景（tab 容器、卡片底色）
  mutedForeground: '#838383',  // 辅助文字
  primary:   '#2D2D2D',        // 强调（按钮、选中态、header 背景）
  border:    '#E8E8E8',        // 边框 / 分割线

  // 功能性（保留色彩）
  destructive: '#DC2626',      // 危险操作、错误提示
  success:     '#16A34A',      // 连接成功指示（仅 ping 点）
} as const;
```

### 与 Web 端 Precision 对应

| APP Token | Web Token | 用途 |
|-----------|-----------|------|
| `background` | `--background` | 页面背景 |
| `foreground` | `--foreground` | 主文字 |
| `card` | `--card` | 卡片背景 |
| `muted` | `--muted` | 次要背景 |
| `mutedForeground` | `--muted-foreground` | 辅助文字 |
| `primary` | `--primary` | 强调 |
| `border` | `--border` | 边框/分割线 |
| `destructive` | `--destructive` | 危险操作 |

暗色模式后续补充（低优先级）。

---

## 二、字体

使用系统默认字体，不做自定义引入。

| 用途 | iOS | Android |
|------|-----|---------|
| 标题 | SF Pro Display | Roboto |
| 正文 | SF Pro Text | Roboto |
| 数据/代码 | SF Mono | Droid Sans Mono |

---

## 三、间距与圆角

```ts
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 28,
} as const;

export const Radius = {
  sm: 8,    // tab、小按钮
  md: 10,   // 输入框、卡片内图标
  lg: 12,   // 按钮、卡片
} as const;
```

内容区域统一 `paddingHorizontal: 28`，卡片间距 `gap: 8`。

---

## 四、逐页面改造方案

### 4.1 LoginScreen

**当前问题**：Teal 装饰圆形、Teal logo 底、绿色输入框聚焦态、"温暖"配色。

**改造后**：

```
┌──────────────────────────────┐
│                              │
│    ┌──────────┐              │
│    │    N     │  ← 黑底白字  │
│    └──────────┘              │
│    NAS                   │
│    私有云存储       │
│                              │
│  ┌────────────────────────┐  │
│  │ ⚡ 192.168.1.100:8080  ›│  │  ← 灰底 server bar
│  └────────────────────────┘  │
│                              │
│  ┌──────────┬──────────┐    │
│  │   登录   │   注册   │     │  ← 无彩色 tab
│  └──────────┴──────────┘    │
│                              │
│  用户名                       │
│  ┌────────────────────────┐  │
│  │ 请输入用户名             │  │  ← 灰边框，聚焦时变深
│  └────────────────────────┘  │
│                              │
│  密码                        │
│  ┌────────────────────────┐  │
│  │ 请输入密码               │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │         登录            │  │  ← 黑底白字
│  └────────────────────────┘  │
│                              │
│     忘记密码请联系管理员       │
│                              │
└──────────────────────────────┘
```

**具体改动：**

| 元素 | 当前值 | 新值 | Token |
|------|--------|------|-------|
| 装饰圆 circle1/circle2 | Teal 渐变 | **删除** | — |
| Logo 图标底色 | `#0D9488` | `#2D2D2D` | `primary` |
| Logo 文字色 | `#FFFFFF` | `#FFFFFF` | — |
| 标题 "NAS" | `#0F172A` | `#1C1C1C` | `foreground` |
| 副标题 | `#94A3B8` | `#838383` | `mutedForeground` |
| Server bar 底 | `#F8FAFC` | `#F5F5F5` | `muted` |
| Tab 容器底 | `#F1F5F9` | `#F5F5F5` | `muted` |
| Tab 选中态 | 白底 + shadow | 白底 + `border` 1.5px | — |
| 输入框边框 | `#E2E8F0` | `#E8E8E8` | `border` |
| 输入框聚焦边框 | `#0D9488` | `#2D2D2D` | `primary` |
| 输入框聚焦底 | `#F0FDFA` (teal tint) | `#FFFFFF` | `background` |
| 提交按钮底 | `#0D9488` | `#2D2D2D` | `primary` |
| Ping 未测底色 | `#F1F5F9` | `#F5F5F5` | `muted` |
| Ping 成功色 | `#DCFCE7` / `#22C55E` | `#DCFCE7` / `#16A34A` | `success` |
| Ping 失败色 | `#FEE2E2` / `#EF4444` | `#FEE2E2` / `#DC2626` | `destructive` |
| 页面背景 | `#F8FAFC` | `#FFFFFF` | `background` |

### 4.2 HomeScreen

**当前问题**：Teal header、emoji 文件图标、彩色 retry 按钮。

**改造后**：

```
┌──────────────────────────────┐
│ NAS 文件           [退出]    │  ← 黑底 header
│ alice                        │
├──────────────────────────────┤
│ 📄 readme.txt                │  ← emoji 替换为几何图标
│    12.5 KB · 2026-05-20     │     或纯文字标识
├──────────────────────────────┤
│ 📁 documents                 │
│    -- · 2026-05-19          │
├──────────────────────────────┤
│ ...                          │
└──────────────────────────────┘
```

**具体改动：**

| 元素 | 当前值 | 新值 | Token |
|------|--------|------|-------|
| Header 背景 | `#0D9488` | `#2D2D2D` | `primary` |
| Header 文字 | `#FFFFFF` | `#FFFFFF` | — |
| Header 用户文字 | `#CCFBF1` (teal-tint) | `rgba(255,255,255,0.6)` | — |
| 退出按钮边框 | `rgba(255,255,255,0.5)` | `rgba(255,255,255,0.2)` | — |
| 文件行背景 | `#FFFFFF` | `#FFFFFF` | `card` |
| 文件名色 | `#0F172A` | `#1C1C1C` | `foreground` |
| 文件元信息色 | `#94A3B8` | `#838383` | `mutedForeground` |
| 行分隔线 | `#E2E8F0` | `#E8E8E8` | `border` |
| 错误文字色 | `#DC2626` | `#DC2626` | `destructive` |
| Retry 按钮 | `#0D9488` | `#2D2D2D` | `primary` |
| 页面背景 | `#F8FAFC` | `#FFFFFF` | `background` |

### 4.3 DiscoveryScreen

**当前问题**：Teal 雷达动画、emoji 状态图标、Teal 卡片选中态。

**改造后**：

```
┌──────────────────────────────┐
│                              │
│         ◉                    │  ← 灰底灰心雷达动画
│    正在搜索局域网 NAS...       │
│   请确保手机与 NAS 在同一网络   │
│                              │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │ ●  NAS-zhangli-ASUS-TUF │ │  ← 选中时深色边框 + 灰底
│ │    10.20.132.121:8080  →│ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ ●  NAS-other-device     │ │
│ │    10.20.132.122:8080  →│ │
│ └──────────────────────────┘ │
│                              │
│        ⟳ 重新搜索            │  ← 深灰文字
└──────────────────────────────┘
```

**具体改动：**

| 元素 | 当前值 | 新值 | Token |
|------|--------|------|-------|
| 雷达外圈 | `#CCFBF1` | `#F5F5F5` | `muted` |
| 雷达中心点 | `#0D9488` | `#2D2D2D` | `primary` |
| 标题文字 | `#0F172A` | `#1C1C1C` | `foreground` |
| 副标题文字 | `#94A3B8` | `#838383` | `mutedForeground` |
| 扫描区背景 | `#FFFFFF` | `#FFFFFF` | `background` |
| 设备卡片 | `#FFFFFF` | `#FFFFFF` | `card` |
| 卡片选中态边框 | `#0D9488` | `#2D2D2D` | `primary` |
| 卡片选中态底色 | `#CCFBF1` | `#F5F5F5` | `muted` |
| 设备图标底色 | `#F0FDF9` | `#F5F5F5` | `muted` |
| 设备图标 | 📡 emoji | `●` 文字圆点 （`#1C1C1C`） | — |
| 选中勾 | `#0D9488` `✓` | `#1C1C1C` `✓` | `foreground` |
| 重搜文字 | `#0D9488` | `#2D2D2D` | `primary` |
| 空状态图标 | ⚠️📭 emoji | 删除，纯文字 | — |
| 重新搜索按钮 | `#0D9488` | `#2D2D2D` | `primary` |
| 手动输入文字 | `#94A3B8` | `#838383` | `mutedForeground` |
| 页面背景 | `#F8FAFC` | `#FFFFFF` | `background` |

### 4.4 DevSettingsScreen

| 元素 | 当前值 | 新值 | Token |
|------|--------|------|-------|
| 输入框边框 | Teal 系 | `#E8E8E8` / `#2D2D2D` | `border` / `primary` |
| 保存按钮 | `#0D9488` | `#2D2D2D` | `primary` |

---

## 五、实施步骤

| 阶段 | 内容 | 文件 |
|------|------|------|
| 1 | 创建 Design Token 文件 | `src/theme/tokens.ts` |
| 2 | 改造 LoginScreen | `src/screens/LoginScreen.tsx` |
| 3 | 改造 HomeScreen | `src/screens/HomeScreen.tsx` |
| 4 | 改造 DiscoveryScreen | `src/screens/DiscoveryScreen.tsx` |
| 5 | 改造 DevSettingsScreen | `src/screens/DevSettingsScreen.tsx` |

---

## 六、设计原则检查清单

- [ ] 所有页面无 Teal `#0D9488` 残留
- [ ] 所有页面无 `#CCFBF1`、`#F0FDFA` 等 teal-tint 残留
- [ ] 所有页面无 emoji 装饰图标（⚠️📭📡📁📄）
- [ ] 所有页面无渐变色圆形装饰
- [ ] 所有颜色引用来自 `src/theme/tokens.ts`，无硬编码色值
- [ ] 按钮/输入框/卡片圆角统一为 `Radius.lg` (12px)
- [ ] 边框色统一为 `Colors.border`
- [ ] 主文字色统一为 `Colors.foreground`
- [ ] 辅助文字色统一为 `Colors.mutedForeground`
