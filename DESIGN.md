# NAS 产品设计规范

> 统一设计语言，适用于 Web 管理后台 + Android/iOS 客户端 APP。

---

## 一、设计理念

### 1.1 定位

面向家庭用户的个人 NAS 存储系统。核心体验：**可靠、安全、高效**。

### 1.2 设计语言：「Precision」

| 关键词 | 释义 |
|--------|------|
| 精密 | 像精密仪器面板，每个元素都有功能意义 |
| 克制 | 不堆砌装饰，留白即设计 |
| 信赖 | 冷色调传达安全感、专业感 |
| 一致 | Web 和 APP 使用同一套视觉语言 |

### 1.3 设计原则

1. **功能优先** — 界面服务于操作效率，不为美观牺牲可用性
2. **减少噪音** — 一屏只聚焦一件事，辅助信息按需展开
3. **即时反馈** — 操作后 200ms 内给予视觉反馈（动画/状态变化）
4. **暗色友好** — 所有界面必须同时适配 Light 和 Dark 模式

---

## 二、色彩体系

### 2.1 核心色板

全线**无彩色**（黑白灰），仅聚焦环/链接使用蓝灰色。这是整个产品中唯一的彩色标记。

#### Light Mode

| Token | 值 (oklch) | HEX 近似 | 用途 |
|-------|-----------|----------|------|
| `background` | oklch(1 0 0) | #FFFFFF | 页面背景 |
| `foreground` | oklch(0.145 0 0) | #1A1A1A | 主文字 |
| `card` | oklch(1 0 0) | #FFFFFF | 卡片背景 |
| `muted` | oklch(0.97 0 0) | #F5F5F5 | 次要背景/悬停态 |
| `muted-foreground` | oklch(0.556 0 0) | #737373 | 辅助文字/图标 |
| `primary` | oklch(0.205 0 0) | #1A1A1A | 强调（按钮/选中） |
| `primary-foreground` | oklch(0.985 0 0) | #FAFAFA | 强调上的文字 |
| `border` | oklch(0.922 0 0) | #E5E5E5 | 边框/分割线 |
| `ring` | oklch(0.708 0 0) | #A3A3A3 | 聚焦环/选中指示 |
| `destructive` | oklch(0.577 0.245 27.325) | #DC2626 | 危险操作 |
| `success` | — | #16A34A | 成功状态 |
| `warning` | — | #F59E0B | 警告状态 |

#### Dark Mode

| Token | 值 (oklch) | HEX 近似 | 用途 |
|-------|-----------|----------|------|
| `background` | oklch(0.145 0 0) | #1A1A1A | 页面背景 |
| `foreground` | oklch(0.985 0 0) | #FAFAFA | 主文字 |
| `card` | oklch(0.205 0 0) | #262626 | 卡片背景 |
| `muted` | oklch(0.269 0 0) | #333333 | 次要背景 |
| `muted-foreground` | oklch(0.708 0 0) | #A3A3A3 | 辅助文字 |
| `primary` | oklch(0.922 0 0) | #E5E5E5 | 强调 |
| `primary-foreground` | oklch(0.205 0 0) | #262626 | 强调上的文字 |
| `border` | oklch(1 0 0 / 10%) | rgba(255,255,255,0.1) | 边框 |
| `ring` | oklch(0.556 0 0) | #737373 | 聚焦环 |
| `destructive` | oklch(0.704 0.191 22.216) | #EF4444 | 危险操作 |
| `success` | — | #22C55E | 成功状态 |
| `warning` | — | #FBBF24 | 警告状态 |

### 2.2 色彩使用规则

- **禁止**使用 ring/destructive/success/warning 以外的彩色
- 按钮、图标、文字、卡片只使用黑白灰层级
- 不使用渐变色（登录页背景点阵动画除外）
- 状态色仅用于 Badge / Toast / 表单验证，不作为装饰

### 2.3 APP 色彩映射

| 平台 | 实现方式 |
|------|----------|
| Web | CSS 变量 `var(--background)` 等，定义在 globals.css |
| Android | `colors.xml` 资源文件，或 Jetpack Compose `MaterialTheme` |
| iOS | `Assets.xcassets` Color Set，或 SwiftUI `Color(light:dark:)` |
| React Native | `StyleSheet` + 主题 Context，与 Web 共享 HEX 值 |

---

## 三、字体

### 3.1 字体选型

| 用途 | 字体 | 回退 | 字重 |
|------|------|------|------|
| 标题 | Geist Sans | system-ui, -apple-system, sans-serif | 600 (Semibold) |
| 正文 | Geist Sans | system-ui, sans-serif | 400 (Regular) |
| 数据/代码 | Geist Mono | ui-monospace, monospace | 400 |

### 3.2 字号体系

| 级别 | Web (rem) | APP (sp/pt) | 用途 |
|------|-----------|-------------|------|
| H1 | 1.5 (24px) | 24sp | 页面标题 |
| H2 | 1.25 (20px) | 20sp | 区域标题 |
| H3 | 1.125 (18px) | 18sp | 卡片标题 |
| Body | 0.875 (14px) | 14sp | 正文 |
| Caption | 0.75 (12px) | 12sp | 辅助文字/时间戳 |
| Mono | 0.8125 (13px) | 13sp | 文件名/路径/数据 |

### 3.3 行高

- 标题：1.3
- 正文：1.5
- 单行元素（按钮/标签）：1

---

## 四、间距与圆角

### 4.1 间距体系（4px 基数）

| Token | 值 | 用途 |
|-------|-----|------|
| xs | 4px | 紧凑元素间隙 |
| sm | 8px | 行内元素间距 |
| md | 12px | 组件内边距 |
| lg | 16px | 卡片间距 |
| xl | 24px | 区域内边距 |
| 2xl | 32px | 页面边距 |

### 4.2 圆角

| 级别 | 值 | 用途 |
|------|-----|------|
| sm | 8px | 小按钮、Badge |
| md | 10px | 按钮、输入框 |
| lg | 12px | 卡片、对话框 |
| xl | 16px | 大卡片、底部 Sheet |
| full | 9999px | 头像、Tag |

### 4.3 APP 适配

- Android: 直接使用 dp 值（与 px 1:1 对应）
- iOS: 使用 pt 值（同上）
- Web: 使用 rem/px

---

## 五、图标

### 5.1 图标库

统一使用 **Lucide** 图标集：
- Web: `lucide-react`
- React Native: `lucide-react-native`
- 原生 Android: Lucide SVG → Android Vector Drawable

### 5.2 图标规范

| 场景 | 尺寸 | 线宽 |
|------|------|------|
| 导航栏 | 20×20 | 1.5px |
| 列表项 | 16×16 | 1.5px |
| 按钮内 | 16×16 | 1.5px |
| 空状态 | 48×48 | 1.5px |
| 大图标 | 64×64 | 1px |

### 5.3 图标颜色

- 默认：`muted-foreground`
- 选中/激活：`foreground`
- 禁用：`muted-foreground` + 50% opacity
- 危险：`destructive`

---

## 六、组件规范

### 6.1 按钮 (Button)

| 变体 | 背景 | 文字 | 用途 |
|------|------|------|------|
| Primary | `primary` | `primary-foreground` | 主要操作（登录/保存/上传） |
| Secondary | `muted` | `foreground` | 次要操作（取消/返回） |
| Ghost | transparent | `muted-foreground` | 工具栏/紧凑区域 |
| Outline | transparent + border | `foreground` | 可选操作 |
| Destructive | `destructive/10` | `destructive` | 删除/危险操作 |

**尺寸**：

| 尺寸 | 高度 (Web) | 高度 (APP) | 字号 |
|------|-----------|-----------|------|
| xs | 24px | 28dp | 12px |
| sm | 28px | 32dp | 13px |
| default | 32px | 40dp | 14px |
| lg | 36px | 48dp | 14px |

**状态**：
- Hover: 背景色加深 10%
- Pressed: translateY(1px)（Web）/ scale(0.97)（APP）
- Disabled: opacity 50%, pointer-events none
- Focus: 2px ring（`ring` 色）

### 6.2 输入框 (Input)

- 高度：32px (Web) / 44dp (APP)
- 背景：`card`
- 边框：1px `border`
- 圆角：md (10px)
- Focus：border 变为 `ring`，外圈 3px ring/50%
- 占位符：`muted-foreground`
- 错误态：border 变为 `destructive`

### 6.3 卡片 (Card)

- 背景：`card`
- 边框：1px `border`
- 圆角：lg (12px)
- 内边距：xl (24px)
- 无阴影（极简风不用投影）
- Hover（可交互卡片）：border 颜色加深

### 6.4 表格 (Table) — 仅 Web

- 无外边框
- 行间 1px `border` 底线
- 表头背景：`muted`，sticky
- 行高：44px
- 悬停行：`muted` 背景
- 选中行：左侧 2px `primary` 指示条

### 6.5 列表项 (ListItem) — 仅 APP

- 高度：56dp（单行）/ 72dp（双行）
- 左侧图标 + 主文字 + 副文字 + 右侧箭头
- 分割线：`border`，左缩进 56dp（对齐文字）
- 按压态：`muted` 背景

### 6.6 对话框 (Dialog)

- Web：居中弹窗，遮罩 `background/80%`
- APP：底部 Sheet（Android）/ 居中 Alert（iOS）
- 圆角：xl (16px)
- 宽度：Web 最大 480px / APP 全宽 - 32dp 边距

### 6.7 Toast / Snackbar

- 位置：Web 右下角 / APP 底部居中
- 持续：3s 自动消失
- 变体：info（默认）、success（绿色左边线）、error（红色左边线）
- 背景：`card` + 边框
- 可手动关闭

---

## 七、布局

### 7.1 Web 布局

两种可切换模式：

**侧栏模式**（默认）：
```
┌────┬──────────────────────────────┐
│    │  Topbar (56px)    [工具按钮] │
│ S  ├──────────────────────────────┤
│ I  │                              │
│ D  │        Content (p-24px)      │
│ E  │                              │
│ B  │                              │
│ A  │                              │
│ R  │                              │
│    │                              │
│240 │                              │
└────┴──────────────────────────────┘
```

**顶栏模式**：
```
┌───────────────────────────────────┐
│  Logo  Nav1  Nav2  Nav3    [工具] │ 56px
├───────────────────────────────────┤
│                                   │
│          Content (p-24px)         │
│                                   │
└───────────────────────────────────┘
```

### 7.2 APP 布局

```
┌───────────────────────────────────┐
│  Status Bar                       │
├───────────────────────────────────┤
│  App Bar (56dp)       [操作按钮]  │
├───────────────────────────────────┤
│                                   │
│          Content                  │
│        (padding 16dp)             │
│                                   │
├───────────────────────────────────┤
│  Bottom Nav (64dp)                │
│  [首页] [文件] [传输] [我的]      │
└───────────────────────────────────┘
```

- 底部导航 4 个 Tab
- App Bar 固定顶部，标题居左
- 无 Drawer / 汉堡菜单（简化导航层级）

---

## 八、动效

### 8.1 原则

- 时长短：150ms（微交互）~ 300ms（页面转换）
- 缓动：`ease`（通用）、`ease-out`（进入）、`ease-in`（退出）
- 避免弹性动画（不符合精密克制风格）
- 暗色模式下动效不变

### 8.2 Web 动效清单

| 场景 | 时长 | 效果 |
|------|------|------|
| 按钮 hover | 150ms | background-color 过渡 |
| 按钮 active | 0ms | translateY(1px) |
| 侧栏展开/折叠 | 200ms | width 过渡 |
| 对话框打开 | 200ms | opacity 0→1 + scale 0.95→1 |
| Toast 进入 | 200ms | translateX(100%)→0 |
| 主题切换 | 0ms | 无过渡，瞬间切换 |

### 8.3 APP 动效清单

| 场景 | 时长 | 效果 |
|------|------|------|
| 页面切换 | 300ms | 左推/右退 (Stack) |
| Tab 切换 | 200ms | 淡入淡出 |
| 按钮 press | 100ms | scale 0.97 |
| 列表项 press | 100ms | 背景色变化 |
| 底部 Sheet | 250ms | 上滑出现 |
| Pull-to-refresh | — | 系统默认 |

---

## 九、特殊页面

### 9.1 登录页

- 独立布局，无导航
- 居中卡片（Web: 400px / APP: 全宽 - 48dp）
- 背景：点阵网格 SVG 动画（Web）/ 纯色（APP）
- 卡片顶部：NAS 图标 + 产品名 + 副标题
- 输入框：用户名 + 密码
- 主按钮：「登 录」

### 9.2 空状态

- 居中显示大图标（48px/48dp）
- 图标颜色：`muted-foreground`
- 一行文案：14px，`muted-foreground`
- 可选：一个操作按钮

### 9.3 加载状态

- 全页加载：居中 spinner（旋转圆环，`primary` 色）
- 局部加载：区域 skeleton 骨架屏（`muted` 色块闪烁）
- 按钮加载：文字替换为 spinner + "处理中..."

---

## 十、平台差异对照

| 特性 | Web | APP (React Native) |
|------|-----|---------------------|
| 主题切换 | `<html class="dark">` | React Context + StyleSheet |
| 导航 | Sidebar / Topbar | Bottom Tab + Stack |
| 图标 | lucide-react | lucide-react-native |
| 字体 | next/font (Geist) | 系统字体 / 自定义 TTF |
| 动画 | CSS transition | react-native-reanimated |
| 圆角 | CSS border-radius | style.borderRadius |
| 色彩 | CSS 变量 | 主题对象/StyleSheet |
| 对话框 | 居中弹窗 | 底部 Sheet / Alert |
| Toast | sonner (右下角) | react-native-toast-message |
| 表格 | HTML table | FlatList / 自定义 |
| 文件管理 | 目录树 + 文件列表 | 层级列表 (drill-down) |

---

## 十一、设计 Checklist

新功能/页面上线前，对照检查：

- [ ] Light / Dark 模式均正常显示
- [ ] 只使用规范内的颜色 Token，无硬编码色值
- [ ] 按钮/输入框/卡片使用统一组件，无自定义样式覆盖
- [ ] 空状态有明确提示
- [ ] 加载状态有视觉反馈
- [ ] 操作成功/失败有 Toast 反馈
- [ ] 文字不超过规范字号范围
- [ ] 间距使用 4px 倍数
- [ ] 图标来自 Lucide 库，尺寸符合规范
- [ ] 无装饰性彩色（ring/destructive/success/warning 除外）
