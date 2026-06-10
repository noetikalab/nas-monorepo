# 前后端 API 对照表

## 认证相关（无 /api 前缀，直接代理到 authd）

| 前端页面 | 方法 | 路径 | 说明 |
|----------|------|------|------|
| 登录页 | POST | `/login` | 用户登录，返回 JWT token |
| 登录页 | GET | `/device-info` | 设备标识（可选展示） |
| — | POST | `/register` | 注册新用户 |
| — | GET | `/ping` | 健康检查 |

## 管理接口（/api 前缀，需 JWT）

### Dashboard

| 前端组件 | 方法 | 路径 | 说明 |
|----------|------|------|------|
| StatCards | GET | `/api/dashboard/stats` | CPU/内存/存储/运行时长 |
| RecentFiles | GET | `/api/dashboard/recent?limit=N` | 最近文件操作 |

### 文件管理（Phase 2）

| 前端组件 | 方法 | 路径 | 说明 |
|----------|------|------|------|
| FileList | GET | `/api/files?path=` | 文件列表 |
| — | GET | `/api/files/download?path=` | 下载文件 |
| UploadDialog | POST | `/api/files/upload` | 上传（multipart） |
| MkdirDialog | POST | `/api/files/mkdir` | 创建目录 |
| — | DELETE | `/api/files?path=` | 删除文件/目录 |
| — | POST | `/api/files/move` | 移动/重命名 |

### 用户管理（Phase 2）

| 前端组件 | 方法 | 路径 | 说明 |
|----------|------|------|------|
| UserTable | GET | `/api/users` | 用户列表 |
| CreateUserDialog | POST | `/register` | 创建用户 |
| — | DELETE | `/api/users/:username` | 删除用户 |

### 服务状态（Phase 3）

| 前端组件 | 方法 | 路径 | 说明 |
|----------|------|------|------|
| ServiceCard | GET | `/api/services` | SMB/NFS/WebDAV 状态 |

### 审计日志（Phase 3）

| 前端组件 | 方法 | 路径 | 说明 |
|----------|------|------|------|
| LogTable | GET | `/api/logs?type=all&limit=50` | 操作日志 |

## 错误响应格式

所有 API 错误返回统一结构：

```json
{
  "error": "错误描述"
}
```

HTTP 状态码：
- 401 — 未登录或 token 过期（前端自动重定向）
- 400 — 请求参数错误
- 403 — 权限不足
- 500 — 服务端错误

## 相关文章
- [[../../wiki/API契约]] — 跨服务接口契约（待创建）
- [[development]] — 开发指南中的 API 使用说明
