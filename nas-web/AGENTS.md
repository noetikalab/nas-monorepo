<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
# CLAUDE.md

NAS Web 管理后台 — 面向家庭用户的 NAS 存储管理界面，提供文件管理、用户管理、系统监控功能。

## 常用命令

```bash
pnpm install          # 安装依赖
pnpm dev              # 启动开发服务器（→ localhost:3000）
pnpm build            # 生产构建
npx tsc --noEmit      # TypeScript 类型检查
```

Docker 部署：

```bash
sudo docker compose up --build -d    # 独立部署（无需 ldap-demo docker compose）
# → 监听 :80（nginx 反代 API 到 authd:8080）
```

## 技术栈

| 层 | 选型 | 说明 |
|----|------|------|
| 框架 | Next.js 16.2 App Router | TypeScript，`output: "standalone"` |
| 样式 | Tailwind CSS 4 + shadcn/ui (Radix Nova) | oklch 色彩空间，class 切换 dark mode |
| 图标 | Lucide React | 黑白风格匹配 Precision 设计 |
| 图表 | recharts 3.8 | Dashboard 环形图 + 面积图 |
| 字体 | Geist Sans / Geist Mono | next/font/google 加载 |
| 状态 | React Context | ThemeProvider / NavProvider，不用 Redux/Zustand |
| HTTP | 原生 fetch 封装 | `lib/api.ts`：JWT 注入 + 401 拦截 |

## 架构关键决策

### 为何不用 Redux/Zustand

全局状态只有主题和导航模式两个，React Context 足够。页面数据各自 useEffect fetch，不跨页面共享。

### 双布局模式（sidebar / topbar）

- localStorage key `nas-nav-mode`，默认 `sidebar`
- 切换按钮放在顶栏右侧
- 所有页面自动适应，通过 CSS 类名控制

### 主题（system / light / dark）

- 默认 `dark`（`getStoredTheme()` 无存储时返回 `"dark"`）
- `<html class="dark">` 切换
- Tailwind `darkMode: "class"`
- 使用 oklch CSS 变量，暗色/亮色模式自动切换

### JWT 鉴权

- token 存 localStorage key `nas-token`，role 存 `nas-role`
- `lib/api.ts` 的 ApiClient 自动注入 `Authorization: Bearer <token>`
- 401 响应自动清除 token 并重定向 `/login`

### API 服务层

`src/services/` 按领域拆分所有后端接口调用，组件不直接使用 `api.get/post/...`：

| 模块 | 对应接口 | 用途 |
|------|---------|------|
| `auth.ts` | `/api/login` `/api/register` `/api/validate-token` | 认证 |
| `files.ts` | `/api/files` `/api/files/upload` 等 | 文件操作 |
| `dashboard.ts` | `/api/dashboard/stats` `/api/dashboard/recent` | 系统概览 |
| `users.ts` | `/api/users` `/api/users/count` `/api/users/:name` | 用户管理 |
| `logs.ts` | `/api/logs` | 审计日志 |
| `services.ts` | `/api/services` | 服务状态 |
| `device.ts` | `/api/device-info` | 设备信息 |

所有 API 统一使用 `/api/` 前缀，`lib/api.ts` 中 `API_BASE = "/api"` 全局生效。

### 开发环境 API 代理

`next.config.ts` 中 `beforeFiles` rewrites 将 `/api/*` 转发到 Go 后端（默认 `localhost:8080`，可通过 `AUTH_BACKEND` 环境变量覆盖）。生产环境 nginx 在更前面已将 `/api/*` 转发，此 rewrite 不会被执行。

## 踩坑记录

### NavProvider SSR 问题

**现象**：`pnpm build` 时报 `useNavMode must be used within NavProvider`

**根因**：NavProvider 原本有 `if (!mounted) return <>{children}</>` 逻辑，SSR 阶段 `mounted=false` 直接返回 children，跳过了 Context.Provider 的渲染

**修复**：移除 early return，始终渲染 NavContext.Provider，初始值从 localStorage 读取默认值

### Docker 构建：pnpm onlyBuiltDependencies

**现象**：`docker build` 时 `ERR_PNPM_IGNORED_BUILDS` 错误，sharp、msw 等包的构建脚本被阻止

**根因**：pnpm 10+ 默认阻止 build scripts，而 `pnpm install --frozen-lockfile` 不让修改 lockfile

**修复**：
1. 在 `package.json` 添加 `pnpm.onlyBuiltDependencies: ["sharp", "msw", "unrs-resolver"]`
2. Dockerfile 中改用 `pnpm install --ignore-scripts`（Docker 构建不需要 build scripts）

### Docker 构建：npm 镜像超时

**现象**：Docker 构建时拉取依赖超时

**根因**：默认 npm registry (`https://registry.npmjs.org/`) 在国内访问不稳定

**修复**：创建 `.npmrc`，设置 `registry=https://registry.npmmirror.com`，Dockerfile 中 COPY .npmrc 到构建阶段

### Docker 构建：node:24-alpine 拉取失败

**现象**：`docker build` 时 `short read: unexpected EOF`

**根因**：镜像版本较新，网络不稳定导致拉取失败

**修复**：改用 `node:22-alpine`（22.22.3），同时创建 `.nvmrc` 固定本地 Node 版本

### shadcn/ui CLI：必须用 npx

**现象**：`pnpm exec shadcn add <component>` 不工作

**根因**：当前环境 shadcn CLI 路径解析问题

**解决**：使用 `npx shadcn@latest add <component>`（注意这是完全不同包的路径）

### react-virtuoso 列表高度为 0 导致不可见

**现象**：FileList 列表模式什么都看不到，DOM 元素为空，但 Grid 模式正常且有数据

**根因**：Virtuoso 用 `height: calc(100% - 33px)` 但父容器是 `flex-1 min-h-0`，flex 分配的隐式高度无法被百分比继承，算出 0px

**修复**：用 `ResizeObserver` 精确测量容器高度（containerHeight - headerHeight），传给 Virtuoso 的 `style={{ height: listHeight }}`。表头用 `shrink-0` 固定在顶部

### Sheet 组件右侧面板关闭按钮重叠

**现象**：文件预览面板右上角两个 X 重叠，位置错乱

**根因**：shadcn/ui 的 `SheetContent` 默认 `showCloseButton=true`，会在 `absolute top-3 right-3` 渲染一个 X。我们又手动在 header 里加了一个 X

**修复**：`<SheetContent showCloseButton={false}>` 关掉自带的，只保留自定义 header 中的关闭按钮

### react-resizable-panels v4 布局异常

**现象**：左侧目录树面板特别窄（几乎不可见），`defaultSize` 不生效

**根因**：react-resizable-panels v4 API 变更后行为不稳定，且容器需要完整 flex 链才能正确计算尺寸

**修复**：移除该库，用自定义方案替代——左侧 div `style={{ width: sidebarWidth }}` + 拖拽分隔条 `onMouseDown` 联动，宽度 180-500px，localStorage 持久化

### AppShell main 缺少 flex 导致页面高度塌缩

**现象**：文件管理页面 flex 布局不生效，高度无法向下传递

**根因**：`app-shell.tsx` 的 `<main>` 元素只有 `flex-1`（作为 flex child 生效），但没有 `display: flex`（不是 flex container），子元素的 `flex-1` 无效

**修复**：`<main className="flex-1 flex flex-col p-6">` 使其既是 flex child 又是 flex container

### Docker 部署文件上传请求挂起（暂未解决）

**现象**：浏览器上传文件请求一直 pending，Go 后端日志无记录，curl 直连上传正常

**排查**：curl `-F file=@...` 直接调 `/api/files/upload` 成功返回，说明 nginx→authd 链路正常。问题疑似在 Docker 构建缓存导致前端旧代码未更新，或 nginx 某些配置与 multipart 上传不兼容

**临时方案**：`pnpm dev` 开发模式上传正常，待进一步排查 Docker 部署下的根因

### 目录树偶尔收缩后无法展开（已解决 ✅）

**现象**：点击顶层目录展开正常，点击收起来后展开图标消失，目录树只显示顶层节点

**根因**：`directory-tree.tsx` 的 `handleToggle` 折叠时只清空了 `children: []`，没有重置 `loaded: false`。再次点击时 `loaded` 仍为 true，`children` 为空，既不走折叠分支也不走懒加载分支

**修复**：折叠时同时设置 `loaded: false, children: []`

### 文件预览 404（已解决 ✅）

**现象**：点击预览图片/HTML 返回 404，请求 URL 为 `/files/download?path=...`（缺少 `/api` 前缀）

**根因**：预览链路中的 `useFileBlob`/`useFileText` hooks 和 `filesApi.getBlobUrl`/`getText` 直接使用 `fetch()` 绕过了 ApiClient 的 `/api` 前缀自动注入

**修复**：
1. `lib/api.ts` 新增 `requestRaw()` 方法（返回 Response，不做 JSON 解析）
2. `filesApi.getBlobUrl/getText` 通过 `requestRaw()` 统一调用
3. `useFileBlob/useFileText` hooks 通过 `filesApi` 统一调用，不再手写 fetch
4. `use-file-blob.ts` 删除了本地 `getToken()` 函数，token 注入由 ApiClient 统一处理

## 约束

- **Node 版本**：固定 22（见 `.nvmrc`），不要用 24（Docker 镜像不稳定）
- **包管理器**：必须用 `pnpm`，不用 npm/yarn
- **Docker 镜像**：`node:22-alpine`，不要升级到 24
- **npm 镜像**：`.npmrc` 设置为 `https://registry.npmmirror.com`，不要删除
- **基础 UI 组件**：用 `npx shadcn@latest add` 安装，不要手写
- **所有导出函数/组件/类型**：必须写 JSDoc 注释
- **组件文件**：kebab-case 命名
- **默认主题**：dark（不是 system）
- **API 前缀**：`API_BASE = "/api"` 统一全局前缀，service 函数只写业务路径（如 `"/files"` 而非 `"/api/files"`）
- **API 调用**：组件必须通过 `@/services` 调用后端，不得直接在页面中写 `api.get/post/...`
- **nginx**：`/api/*` → authd，`/` → Next.js，不要添加 `/files` / `/login` 等特殊路由（全部走 `/api/`）

## 知识库

| 位置 | 文件 | 内容 |
|------|------|------|
| 全局 | ../AGENTS.md | 全局约束与子仓库清单 |
| 全局 | ../wiki/index.md | 全局知识目录（唯一检索入口） |
| 本仓库 | docs/index.md | 本仓库本地知识目录 |
