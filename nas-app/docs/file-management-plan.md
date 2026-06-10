# APP 端文件管理开发方案

> 基于后端最新 API（main-claude.md 2026-05-27），分析当前 Gap 并制定开发计划。

## 一、后端 API 现状

所有接口已统一 `/api/` 前缀，全链路验证通过。

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/login` | 无 | 登录 → `{ token, role }` |
| POST | `/api/register` | 无 | 注册 |
| GET | `/api/validate-token` | JWT | 验证 token |
| GET | `/api/device-info` | 无 | 设备信息校验 |
| GET | `/api/files?path=` | JWT | 列出目录 |
| GET | `/api/files/download?path=` | JWT | 下载文件（二进制流） |
| POST | `/api/files/upload` | JWT | 上传文件（multipart：`path` + `file`） |
| POST | `/api/files/mkdir` | JWT | 新建目录 `{ path }` |
| POST | `/api/files/move` | JWT | 移动/重命名 `{ from, to }` |
| DELETE | `/api/files?path=` | JWT | 删除文件（递归） |

### 后端响应格式

**列目录：**
```json
{
  "path": "/data/alice",
  "files": [
    {
      "name": "photo.jpg",
      "size": 102400,
      "type": "file",
      "modified": "2026-05-26T10:24:00Z",
      "permission": "rw-"
    },
    {
      "name": "docs",
      "size": 0,
      "type": "directory",
      "modified": "2026-05-26T10:25:17Z",
      "permission": "rwx"
    }
  ]
}
```

**操作成功（upload/mkdir/move/delete）：**
```json
{ "ok": true, "path": "/data/alice/newfile.txt" }
```

---

## 二、APP 端当前 Gap

### 2.1 API 路径不匹配（P0）

| APP 文件 | 当前路径 | 后端实际路径 |
|----------|---------|------------|
| `auth.ts` | `/login` | `/api/login` |
| `auth.ts` | `/register` | `/api/register` |
| `auth.ts` | `/ping` | `/api/ping` |
| `device.ts` | `/device-info` | `/api/device-info` |
| `files.ts` | `/files` | `/api/files?path=` |

### 2.2 JWT Token 未注入（P0）

`auth.ts` 和 `files.ts` 的 `request()` 函数都没有携带 `Authorization: Bearer <token>` 头。当前 auth 接口不需要 token 所以能工作，但文件操作全部需要。

**改造方案**：创建共享 `src/api/client.ts`，统一在 `request()` 中：
- 从 `storage.getToken()` 获取 token
- 注入 `Authorization: Bearer <token>` 头
- multipart/form-data 时不设 `Content-Type`（让 RN 自动添加 boundary）
- 401 响应时抛出 `UNAUTHORIZED` 错误，由调用方决定跳登录

### 2.3 类型定义不匹配（P0）

**当前 FileItem（`src/types/index.ts`）：**
```ts
{ name, size, modifiedAt, isDir: boolean }
```

**后端实际返回（`system/file.go:20` FileInfo struct）：**
```ts
// 后端 Go struct → JSON：
// Name string `json:"name"`       // 文件名或目录名
// Size int64  `json:"size"`       // 字节，目录为 0
// Type string `json:"type"`       // "file" 或 "directory"
// Modified time.Time `json:"modified"`  // ISO 时间
// Permission string `json:"permission"` // owner 权限位，如 "rwx"、"rw-"
{
  name: "photo.jpg",
  size: 102400,
  type: "file",           // ← 不是 isDir: boolean
  modified: "2026-05-26T10:24:00Z",  // ← 不是 modifiedAt
  permission: "rw-"       // ← 完全缺失
}
```

**AuthResponse 也不完整** — 当前只有 `{token}`，后端 `LoginResponse` 有 `{token, role}`，`RegisterResponse` 有 `{token, uid, role}`。

### 2.4 files.ts 全 Mock（P0）

`filesApi.list()` 返回硬编码假数据，其他方法未实现。

### 2.5 HTTP 客户端分散重复（P1）

`auth.ts` 和 `files.ts` 各自实现 `request()`，逻辑重复。应提取为共享 `api/client.ts`。

### 2.6 device.ts 用 axios（P2）

其他模块用 `fetch`，device.ts 用 `axios`，依赖不统一。

---

## 三、改造方案

### Step 1：类型对齐

```ts
// src/types/index.ts
export interface FileItem {
  name: string;
  size: number;
  type: 'file' | 'directory';
  modified: string;
  permission: string;
}

export interface ListFilesResponse {
  path: string;
  files: FileItem[];
}

export interface AuthResponse {
  token: string;
  role: 'admin' | 'user';
}

export interface OkResponse {
  ok: boolean;
  path?: string;
}
```

### Step 2：共享 HTTP 客户端

```ts
// src/api/client.ts
import { storage } from '../storage/local';

export async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 8000,
): Promise<T> {
  const baseUrl = await storage.getServerUrl();
  const token = await storage.getToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  // multipart 时不设 Content-Type（让浏览器自动设 boundary）
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(`${baseUrl}${path}`, { headers, signal: controller.signal, ...options });
    if (!res.ok) {
      if (res.status === 401) throw new Error('UNAUTHORIZED');
      throw new Error(`HTTP ${res.status}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}
```

### Step 3：文件 API 实现

```ts
// src/api/files.ts
import { request } from './client';
import type { FileItem, ListFilesResponse, OkResponse } from '../types';

export const filesApi = {
  list: (dirPath = '/') =>
    request<ListFilesResponse>(`/api/files?path=${encodeURIComponent(dirPath)}`),

  download: async (filePath: string) => {
    // GET /api/files/download?path=... → 二进制流，返回 blob URL
    // 实现时特殊处理：不调 request()，直接 fetch + blob
  },

  upload: (dirPath: string, file: { uri: string; name: string; type: string }) => {
    const form = new FormData();
    form.append('path', dirPath);
    form.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
    return request<OkResponse>('/api/files/upload', { method: 'POST', body: form });
  },

  mkdir: (dirPath: string) =>
    request<OkResponse>('/api/files/mkdir', { method: 'POST', body: JSON.stringify({ path: dirPath }) }),

  move: (from: string, to: string) =>
    request<OkResponse>('/api/files/move', { method: 'POST', body: JSON.stringify({ from, to }) }),

  remove: (filePath: string) =>
    request<OkResponse>(`/api/files?path=${encodeURIComponent(filePath)}`, { method: 'DELETE' }),
};
```

### Step 4：路径修正确认

| 文件 | 修改 |
|------|------|
| `auth.ts` | `/login` → `/api/login`；复用 `client.ts` 的 request |
| `device.ts` | `/device-info` → `/api/device-info`；改用 fetch（去 axios） |
| `types/index.ts` | FileItem / AuthResponse 类型对齐后端 |
| `HomeScreen.tsx` | `item.isDir` → `item.type === 'directory'`；`item.modifiedAt` → `item.modified` |

### Step 5：HomeScreen 增强（后续）

- 目录导航：点击目录进入子目录、返回上层
- 上传按钮 + 文件选择器（react-native-document-picker）
- 长按菜单：重命名 / 删除 / 移动
- 下拉刷新已有

---

## 四、WiFi P2P 开发（已完成 ✅，2026-06-01）

### 4.1 后端现状

- NAS 端：**尚未实现**。`start.sh` 需添加 `wpa_cli -i wlan0 p2p_group_add` 预建 GO 组，Dockerfile 需安装 `wpasupplicant` + `iw` + `dnsmasq`。详见 `wiki/WiFi_P2P_NFC_APP_开发方案.md` 的 NAS 侧章节
- 连接后 NAS IP 固定 `192.168.49.1:8080`
- 硬件：Realtek RTL8822CE（开发机）/ Intel AX210（正式），均支持 WiFi Direct

### 4.2 APP 端完成内容

| 文件 | 操作 | 说明 |
|------|------|------|
| `AndroidManifest.xml` | 修改 | +`NEARBY_WIFI_DEVICES`（13+）、+`ACCESS_FINE_LOCATION`（6-12） |
| `WifiP2pModule.kt` | 新增 | 原生模块 230 行：权限检查 → 清理残留 Group → discoverPeers → connect → 获取 GO IP → 30s 超时 |
| `WifiP2pPackage.kt` | 新增 | ReactPackage 注册 |
| `MainApplication.kt` | 修改 | +`add(WifiP2pPackage())` |
| `src/native/WifiP2pModule.ts` | 新增 | JS 封装：`connect()` → `{ip, port}`、`disconnect()` |
| `src/network/connector.ts` | 重写 | 三层降级策略（mDNS → 缓存IP ping → P2P） |
| `src/screens/NfcScanScreen.tsx` | 新增 | NFC 触发入口页：连接 → 校验 → 跳登录 |
| `src/navigation/index.tsx` | 修改 | +`NfcScan: undefined` 路由 |

### 4.3 实现中修复的问题

实现过程中对同事方案做了 3 处增强：

1. **`connect()` 失败直接 reject**：同事方案 `connectToDevice()` 的 `onFailure` 仅打 log，用户等到 30s 超时。现在直接 `resolveError`，2-3s 内得到错误信息
2. **连接前清理残留 Group**：`connect()` 开头增加 `requestGroupInfo()` + `removeGroup()`，防止上次未正常断开阻塞新连接
3. **新增 `disconnect()` 方法**：JS 层可主动断连 + 移除 Group

### 4.4 待 NAS 端就绪后联调

P2P 模块代码已完成并编译通过，但端到端测试依赖 NAS 端先配置 `wpa_cli p2p_group_add`。

---

## 五、实施顺序

| 优先级 | 任务 | 状态 | 依赖 |
|--------|------|------|------|
| P0 | 类型 + HTTP 客户端 + API 路径对齐 | ✅ 已完成 (2026-06-02) | 无 |
| P0 | filesApi 对接真实接口（list + mkdir + move + delete） | ✅ 已完成 (2026-06-02) | Step P0 |
| P1 | 文件上传功能 | ✅ 已完成 (2026-06-02) | Step P0 |
| P1 | HomeScreen 目录导航 + 文件操作 UI | ✅ 已完成 (2026-06-02) | Step P0 |
| P2 | WiFi P2P 原生模块 | ✅ 已完成 (2026-06-01) | NAS 端 P2P 验证（待同事） |
| P1 | 共享文件 Tab | ✅ 已完成 (2026-06-02) | 后端共享目录就绪 |

### 实施说明

- **HTTP 客户端**：创建 `src/api/client.ts`，统一 `request<T>()` 封装 fetch，自动注入 JWT `Authorization` 头，multipart 时不设 `Content-Type`，401 自动清登录态
- **类型对齐**：`src/types/index.ts` 重写——`FileItem` 改用 `type/modified/permission`，`AuthResponse` 加入 `role`，新增 `ListFilesResponse`、`OkPathResponse` 等
- **文件 API**：`src/api/files.ts` 替换 Mock，对接后端全部接口（list / mkdir / move / remove / upload / getDownloadUrl）
- **依赖变更**：`react-native-document-picker` 与 RN 0.85 不兼容（依赖已移除的 `GuardedResultAsyncTask`），替换为 `@react-native-documents/picker` 12.0.1
- **HomeScreen 改造**：目录导航（`prevPaths` 栈 + BackHandler 拦截）、长按操作（重命名/删除）、文件预览 Modal、新建文件夹 Modal、文件上传、自动登录、退出确认弹窗
- **共享文件**：HomeScreen 新增 Tab 栏（"我的文件"/"共享文件"），路径 `/data/shared`。普通用户只读（隐藏新建/上传按钮），两个 Tab 独立导航栈。API 复用已有接口，无新增依赖

## 相关文章
- [[../../wiki/APP开发记录与踩坑指南_opencode-agent]] — 本方案的实施回溯
- [[../../wiki/API契约]] — 后端接口契约（待创建）
- [[file-list]] — 同一功能的 UI 设计说明
