# 开发指南

## 环境要求

- Node.js 22（见 `.nvmrc`，使用 `nvm use` 自动切换）
- pnpm ≥ 9
- Go 后端 authd 运行中（端口 8080）

## npm 镜像配置

国内环境通过 `.npmrc` 配置淘宝镜像：

```
registry=https://registry.npmmirror.com
```

Docker 构建时 COPY 此文件到镜像内。

## 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器（默认 http://localhost:3000）
pnpm dev
```

开发模式下需要 authd 在 `localhost:8080` 运行。

### 开发环境 API 代理

生产环境由 nginx 反代 API 到 authd:8080，开发环境需要用 Next.js 代理。

Next.js 16 将 `middleware.ts` 重命名为 `proxy.ts`（函数名从 `middleware` 改为 `proxy`），推荐用 `proxy.ts` + `NextResponse.rewrite()` 实现，而非手动 `fetch()`。

**当前状态**：`middleware.ts` 使用 `fetch()` 转发方式仍有问题，待切换到 `proxy.ts` 方案。此问题详情见 CLAUDE.md 已知问题。

## 添加 shadcn 组件

```bash
npx shadcn@latest add <component-name>
```

注意：当前环境需使用 `npx` 而非 `pnpm exec shadcn`。

## 依赖说明

| 依赖 | 用途 | 注意事项 |
|------|------|----------|
| recharts 3.8 | Dashboard 图表（环形图/面积图） | Tooltip formatter 参数类型为 `ValueType \| undefined`，需用 `Number()` 转换 |
| dayjs 1.11 | 时间格式化/时长计算 | 需引入 duration 插件 |
| sonner 2.0 | Toast 通知 | 全局 Toaster 放在 RootLayout |

## 项目约定

### 文件命名

- 组件：`kebab-case.tsx`（如 `stat-cards.tsx`）
- 类型：`types.ts`
- 工具函数：`utils.ts`

### 组件规范

- 所有导出组件/函数必须写 JSDoc 注释
- 页面组件使用 `"use client"` 指令（App Router 客户端组件）
- UI 基础组件来自 shadcn/ui，不手写基础组件
- 业务组件放在 `components/<module>/` 目录下

### 状态管理

- 不引入第三方状态库（Redux/Zustand）
- 全局状态用 React Context（Theme/Nav）
- 页面数据用组件 state + useEffect fetch
- 表单状态用 useState

### 样式

- 使用 Tailwind CSS 工具类
- CSS 变量定义在 `globals.css`
- 通过 `@theme inline` 注册为 Tailwind 工具类
- 禁止 inline style，使用 `cn()` 合并类名

## 构建 & 部署

```bash
# 类型检查
npx tsc --noEmit

# 生产构建
pnpm build

# Docker 构建
docker build -t nas-web .

# 全栈启动（配合 ldap-demo）
cd ../ldap-demo
sudo docker compose up --build -d
```

## 目录说明

| 目录 | 职责 |
|------|------|
| `src/app/` | Next.js 页面路由 |
| `src/components/ui/` | shadcn/ui 基础组件（由 CLI 生成） |
| `src/components/layout/` | 布局组件（Sidebar/Topbar/Shell） |
| `src/components/<module>/` | 业务模块组件 |
| `src/lib/` | 工具库（不含 React，纯函数） |
| `src/hooks/` | 自定义 React hooks |
| `src/providers/` | React Context Providers |

## 相关文章
- [[api-map]] — 开发时需参考的 API 文档
- [[architecture]] — 模块架构参考
