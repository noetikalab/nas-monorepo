<h1 align="center">
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=flat&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-✓-3178C6?style=flat&logo=typescript" alt="TS">
  <img src="https://img.shields.io/badge/Tailwind-4-38BDF8?style=flat&logo=tailwindcss" alt="Tailwind">
  <img src="https://img.shields.io/badge/shadcn/ui-✓-000000?style=flat" alt="shadcn">
  <img src="https://img.shields.io/badge/Docker-✓-2496ED?style=flat&logo=docker" alt="Docker">
</h1>

<h1 align="center">NAS Web</h1>
<h3 align="center">个人 NAS 管理后台</h3>

<p align="center">文件管理 · 用户管理 · 审计日志 · PUF 存证 | Precision 暗色设计系统</p>

---

## ✨ 功能

| 页面 | 功能 | 角色 |
|------|------|------|
| 📊 **仪表盘** | 存储/CPU/内存概览、最近文件操作、服务状态 | admin |
| 📁 **文件管理** | 目录树 + 网格/列表双视图、上传/下载/预览/删除/重命名、右键菜单 | all |
| 👤 **用户管理** | 用户列表、创建/删除用户、角色分配（admin/user） | admin |
| 🔗 **文件共享** | ACL 权限管理：授权/撤销用户对文件/目录的只读/读写权限 | admin |
| 🗃️ **审计日志** | 22 字段完整操作快照、详情弹窗（元信息+指纹+哈希链）、导出存证包 | admin |
| ⚙️ **系统设置** | 主题切换（Dark/Light/System）、侧栏/顶栏双布局 | all |

### 角色自适应

- **admin**：全部 5 个导航项可见，可访问所有页面
- **user**：仅显示「文件管理」，手动访问管理页面自动重定向；UI 导航隐藏管理入口

---

## 🏗️ 技术栈

| 层 | 选型 |
|----|------|
| 框架 | Next.js 16 App Router + TypeScript |
| 样式 | Tailwind CSS 4 + shadcn/ui (Radix Nova) |
| 图标 | Lucide React |
| 状态 | React Context（Theme / Nav / Auth），不用 Redux |
| HTTP | 原生 fetch 封装 (ApiClient) — JWT 注入 + 401 拦截 + 全局错误 Toast |
| 部署 | Docker standalone + nginx 反代 → Go authd |

---

## 🎨 Precision 设计系统

全线黑白灰，冷峻克制。仅聚焦环使用强调色。

| Token | 值 | 用途 |
|-------|-----|------|
| `background` | `#FFFFFF` | 页面背景 |
| `foreground` | `#1C1C1C` | 主文字 |
| `primary` | `#2D2D2D` | 按钮、选中态、Header |
| `muted` | `#F5F5F5` | 次要背景 |
| `border` | `#E8E8E8` | 边框/分割线 |

Dark Mode 自动切换，侧栏/顶栏双布局模式持久化。

---

## 🚀 快速开始

```bash
git clone https://github.com/noetikalab/nas-web.git
cd nas-web

# 使用 Node 22（.nvmrc）
nvm use
pnpm install

# 开发模式（需 authd 后端在 :8080 运行）
pnpm dev

# Docker 部署
sudo docker compose up --build -d
```

---

## 📂 项目结构

```
src/
├── app/
│   ├── (dashboard)/          # 已登录页面
│   │   ├── page.tsx          # 仪表盘
│   │   ├── files/page.tsx    # 文件管理
│   │   ├── users/page.tsx    # 用户管理
│   │   └── logs/page.tsx     # 审计日志
│   └── login/page.tsx        # 登录页
├── components/
│   ├── layout/               # AppShell / Sidebar / TopbarNav
│   ├── files/                # 文件组件
│   │   ├── file-list.tsx     # 列表视图 (react-virtuoso)
│   │   ├── file-grid.tsx     # 网格视图
│   │   ├── file-preview.tsx  # 预览面板 (Sheet)
│   │   ├── file-context-menu.tsx  # 右键菜单 (react-contexify)
│   │   ├── directory-tree.tsx    # 目录树
│   │   ├── share-dialog.tsx      # 共享权限弹窗
│   │   └── preview/              # 各类型预览组件
│   ├── dashboard/            # 图表组件 (recharts)
│   └── ui/                   # shadcn/ui 基础组件
├── hooks/                    # useAuth / useFiles / useFileAnimation
├── lib/                      # api.ts (ApiClient) / auth.ts / types.ts
├── services/                 # API 调用层（auth/files/users/logs/dashboard）
├── providers/                # ThemeProvider / NavProvider
└── middleware.ts             # 开发环境 API 代理
```

---

## 🔗 前后端对接

API 前缀统一 `/api`，开发环境通过 `middleware.ts` 代理到 authd `:8080`，生产环境由 nginx 转发。

```typescript
// lib/api.ts — 统一的 ApiClient
const API_BASE = "/api";
api.get<UserListResponse>("/users");
api.post<CreateUserResponse>("/users", data);
```

所有组件通过 `@/services` 调用后端，不直接使用 `api.get/post/...`。

---

## 📚 文档

| 文档 | 说明 |
|------|------|
| [CLAUDE.md](CLAUDE.md) | AI/同事接手指引 — 架构、约束、踩坑记录 |
| [architecture.md](docs/architecture.md) | 整体架构设计 |
| [design-system.md](docs/design-system.md) | UI 设计系统规范 |
| [api-map.md](docs/api-map.md) | 前后端 API 对照表 |

---

## 🔗 相关项目

| 项目 | 说明 |
|------|------|
| [nas-core](https://github.com/noetikalab/nas-core) | NAS 后端（Go） |
| NasApp | Android 客户端（React Native） |
