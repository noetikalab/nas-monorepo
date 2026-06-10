# 文件列表页

## 概述

HomeScreen 是登录后的主页面，展示 NAS 上的文件列表。当前使用 mock 数据，后端文件操作接口就绪后替换。

## 状态机

```
loading → error → (retry) → loading
loading → files[]
loading → empty (files.length === 0)
files[] → refresh → files[]
```

- `loading`: 首次加载，居中 spinner
- `error`: 请求失败，显示错误信息 + Retry 按钮
- `empty`: 请求成功但文件列表为空，显示"暂无文件"
- `files[]`: 正常列表，支持下拉刷新（`refreshing` 状态）

## API 层

`src/api/files.ts` — 文件操作接口封装，结构与 `auth.ts` 一致：

- 使用 `fetch` + `AbortController` 超时（8s 默认）
- `BASE_URL` 从 AsyncStorage 动态读取，支持 DevSettings 屏幕修改
- `filesApi.list()` 当前返回 mock 数据（`setTimeout` 模拟 600ms 延迟）

### 后端接口就绪后对接

1. 确认接口路径和响应格式
2. 更新 `src/types/index.ts` 中的 `FileItem` 接口（如需调整字段）
3. 将 `filesApi.list()` 中的 mock 替换为：
   ```ts
   list: () => request<FileItem[]>('/files'),
   ```
4. 删除 `MOCK_FILES` 常量

## 文件项展示

每行三个元素：图标（📁/📄）、文件名、大小 + 修改日期。

- 目录：`📁` + 名称 + `--` + 日期
- 文件：`📄` + 名称 + 格式化大小 + 日期

工具函数 `formatSize` / `formatDate` 在 HomeScreen 文件内定义。

## 相关文章
- [[file-management-plan]] — 本 UI 的设计方案
