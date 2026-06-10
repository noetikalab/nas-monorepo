# NAS Agent 设计文档

> 时效：fresh / 上次验证：2026-06-05
> 标签：nas-agent, 架构, rag, 权限
> 源材料：AGENTS.md（glob 根目录），飞书技术架构设计文档 v2
> 创建：2026-06-05 / 更新：2026-06-05

## 一、背景与目标

在现有 NAS（authd + OpenLDAP + Samba + NFS + WebDAV）基础上，构建一个**权限感知的智能文件管理助手**——NAS Agent。它不是独立的知识库系统，而是 NAS 已有服务的 AI 层。

核心能力：
- 文件检索：语义搜索 + 关键词搜索，覆盖用户所有文件
- 文件管理：移动/整理/分类/分享（写操作需用户确认）
- 内容理解：文本摘要、图片/扫描件按需分析
- 多用户：严格继承 POSIX ACL + LDAP 权限体系

## 二、整体架构

```
NAS 三容器（Docker Compose, network_mode: host）:
├─ openldap:389               → 身份源，不做改动
├─ authd (Go, :8080)          → 文件 CRUD + JWT 鉴权 + /internal/check-access（新增）
└─ nas-agent (Python, :8082)  → Agent Loop + Tool Registry + RAG Pipeline
     ├─ 直接读 /data/ 共享卷做索引
     ├─ 调 authd API 做权限校验和文件操作
     └─ 调 LLM API（DeepSeek → 后期 Ollama 本地）
```

通信：nas-agent 是独立容器，不侵入三协议文件服务。Agent 故障不影响 SMB/NFS/WebDAV。

## 三、Agent Loop

复用 Hermes Agent 模式：

```
用户输入
  ↓
① Prompt Builder
  ├─稳定层：角色定义 + 安全规则
  ├─上下文层：当前用户(username/role) + scoped_path
  └─易变层：当前时间 + 会话历史摘要
  ↓
② LLM 调用
  ↓
③ LLM 返回 tool_call 或文本
  ↓
④ Tool Dispatch
  ├─ Hook: before_every_tool → 调 authd check_access 校验权限
  │   允许→执行 / 拒绝→返回 denied 给 LLM，LLM 自行解释
  ├─ 执行 tool
  └─ 结果注入 prompt
  ↓
⑤ 回到 ②，直到 LLM 给出最终回答
```

规则：最大 10 轮迭代；写操作（delete/move/rename）展示变更清单后二次确认。

## 四、Tool Registry + Permission Hook

### 4.1 工具定义

| 分类 | 工具 | op | 描述 |
|------|------|----|------|
| 读 | `list_files` | read | 列出目录，支持通配符 |
| 读 | `search_files` | read | 混合检索（FTS5+向量），返回路径+摘要 |
| 读 | `read_file` | read | 读文件内容（文本/VLM 描述） |
| 读 | `get_file_info` | read | 文件元数据（大小/时间/权限/所有者） |
| 写 | `move_file` | write | 移动/重命名 |
| 写 | `create_folder` | write | 创建目录 |
| 写 | `delete_file` | write | 删除（强制二次确认） |
| 写 | `rename_file` | write | 重命名 |
| 分享 | `share_file` | admin | 授权其他用户访问 |
| 分享 | `list_shared` | read | 查看共享列表 |

### 4.2 Permission Hook（核心设计）

**设计原则**：Agent 不做任何鉴权决策，只是 authd 权限系统的门面。

```python
def permission_hook(tool_name, params, user_identity):
    """每个 tool 调用前自动触发，调 authd 校验权限"""
    meta = TOOL_OPERATION_MAP[tool_name]
    path = params.get(meta["path_param"])
    result = http_get("http://127.0.0.1:8080/internal/check-access",
                      params={"username": user_identity.username,
                              "path": path, "op": meta["op"]})
    if not result["allowed"]:
        return ToolResult.denied(reason="无权限")
    return ToolResult.allowed()
```

authd 新增极简 API 复用已有函数：

```
GET /internal/check-access?username=alice&path=/data/alice/doc.pdf&op=read
→ {allowed: true/false, error: "..."}

// validatePath 和 validateWritePath 是 authd 已有的核心函数
// 不需要写任何新逻辑
```

### 4.3 搜索结果可见性过滤

索引服务以特权身份扫描全部 `/data/` 建索引，返回前过滤：

```
用户 alice 搜索 "养生"
  ↓ 索引返回 20 个结果
  ↓ 逐个调 authd check_access(path, alice, read)
  ↓ 过滤掉 alice 无权访问的文件
  ↓ 返回可见结果 → Agent → LLM 回答
```

## 五、权限体系：完全继承 authd

| 层 | 机制 | 来源 |
|----|------|------|
| 用户身份 | JWT 解析 username/role | authd jwt.go |
| 路径范围 | validatePath: user → /data/{username}/ | authd handler/file.go |
| ACL 细粒度 | getfacl: 共享目录读写控制 | authd handler/permission.go |
| 校验入口 | /internal/check-access（新增） | 封装 validatePath + hasACLWrite |

用户身份通过 HTTP Header `Authorization: Bearer <jwt>` 传入，Agent 解析后注入 session。

不同用户有独立的 system prompt，文件范围自动随身份变化：

```
当前用户：alice（角色：user）
文件范围：/data/alice/ 和 /data/shared/
写操作：必须向用户展示变更清单并等待确认
```

## 六、RAG 策略：三层混合检索

### Layer 1：元数据检索（零 AI 成本）

| 索引内容 | 来源 | 查询示例 |
|---------|------|---------|
| 文件名 | inotify 监听变更 | "找合同.pdf" |
| 路径 | 同上 | "alice 目录下的" |
| 修改时间 | stat | "上周上传的" |
| 大小 | stat | "找大文件" |
| 文件类型 | MIME 检测 | "所有 PDF" |

全部存 SQLite，简单 LIKE/FTS5，零成本。

### Layer 2：文件内容混合检索（核心层）

```
用户查询 "养生与健康数据"
  │
  ├─ FTS5 精确匹配: "养生" 命中含 "养生" 的文件
  └─ bge-m3 语义匹配: "养生" 命中 "饮食日志"、"睡眠数据"
  │
  RRF 融合排序 → top-K → 权限过滤 → LLM
```

| 索引内容 | 索引方式 | 向量模型 | 存储 |
|---------|---------|---------|------|
| 文本文件 (.txt/.md/.go/.py) | 原文做向量 | bge-m3 | sqlite-vec |
| PDF（文字型） | PyMuPDF 抽文本后向量化 | bge-m3 | sqlite-vec |
| PDF（扫描件） | PaddleOCR 结果向量化 | bge-m3 | sqlite-vec |
| Office 文档 | python-docx/openpyxl 抽文本 | bge-m3 | sqlite-vec |
| 纯图片 | **不做预索引** | — | — |

不做 chunking：个人文件平均 < 2000 tokens，整文件一条向量。FTS5 和向量库同库，sqlite-vec 是 SQLite 扩展。inotify 监听 `/data/` 增量更新。

### Layer 3：按需 VLM（兜底层）

当 Layer 1+2 都不够时（图片/扫描件内容理解），调 VLM：

| 模型 | 位置 | 延迟 | 成本 |
|------|------|------|------|
| DeepSeek-VL2 | 云端 | 2-5s | ~¥0.01/次 |
| Qwen2.5-VL 7B | 本地 Ollama | 10-30s | 0 |

结果缓存：VLM 描述存入 SQLite，相同文件再次查询不重复调用。

## 七、多模态处理矩阵

| 文件类型 | 写入时（一次性成本） | 查询时 |
|---------|-------------------|--------|
| 文本 (.txt .md .go .py) | 原文 → FTS5 + bge-m3 → sqlite-vec | — |
| PDF（文字型） | 抽文本 → FTS5 + 向量 | — |
| PDF（扫描件） | PaddleOCR → FTS5 + 向量 | Layer 2 不够 → VLM |
| Office (.docx .xlsx) | 抽文本 → FTS5 + 向量 | — |
| 图片 (.jpg .png) | **不做任何事** | 路径过滤 → VLM 按需看 |
| 音视频 | 存证为主，不索引 | 显式要求时 Whisper 转写 |

## 八、Session 与多用户隔离

每个用户独立 session context：

```
POST /nas-agent/chat
  Headers: Authorization: Bearer <jwt>
  Body: { "message": "找一下养生相关的笔记" }
  Response: SSE 流式输出

POST /nas-agent/reset → 清空会话
POST /nas-agent/sessions → 历史对话列表
```

存储：短期（内存最近 10 轮）+ 长期（SQLite FTS5 检索历史对话）。

## 九、部署方案

```yaml
# docker-compose.yml 新增服务
services:
  nas-agent:
    build: ./nas-agent
    network_mode: host
    volumes:
      - nas-data:/data:ro            # 索引读
      - ./nas-agent/config.yaml:/etc/nas-agent/config.yaml
    environment:
      - AUTH_API_URL=http://127.0.0.1:8080
      - LLM_PROVIDER=deepseek
      - LLM_MODEL=deepseek-chat
      - LLM_API_KEY=${DEEPSEEK_API_KEY:-}
      - EMBEDDING_MODEL=bge-m3
      - VLM_PROVIDER=deepseek-vl2
    devices:
      - /dev/inotify
    depends_on:
      - nas
    restart: unless-stopped
```

数据目录：

```
/data/
├─ .nas-agent/
│  ├─ index.db         ← FTS5 + sqlite-vec 向量
│  ├─ sessions.db      ← 对话历史
│  └─ vlm_cache.db     ← VLM 描述缓存
├─ alice/
├─ bob/
└─ shared/
```

## 十、实施路线

| Phase | 时间 | 目标 | LLM |
|-------|------|------|-----|
| 1 | 本周 | NAS 容器内装 Hermes，手写 3 个 Skill 验证 Agent 流程 | DeepSeek API |
| 2 | 1-2 周 | nas-agent 独立容器上线，FTS5 + bge-m3 混合搜索，Tool + Hook 全量集成 | DeepSeek API |
| 3 | 1 月后 | 按需 VLM、多步 Agentic 任务、写操作确认流 | Ollama Qwen2.5 本地 |
| 4 | 长期 | 定时 Agent（每日摘要）、CLIP 相似图片、Graph RAG 溯源 | 本地 |

## 十一、与 Hermes 的异同

| 维度 | Hermes | NAS Agent |
|------|--------|-----------|
| 通用性 | 通用 coding agent | **专为 NAS 文件管理** |
| 工具 | 70+ 通用工具 | 10 个 NAS 专用工具 |
| 权限 | 本地文件系统 | POSIX ACL + LDAP（Hook → authd）|
| RAG | ripgrep FTS5 | FTS5 + bge-m3 混合检索 |
| 多模态 | 通用 vision | 按需 VLM（仅图片/扫描件）|
| 部署 | 桌面/云端 | NAS Docker 容器 |
| 网关 | Telegram/Discord 等 20 平台 | APP/Web API |

## 相关文章

- [[协议层]] — 本文章使用的文档协议（{{主题文档}} 类型）
- [[index]] — 知识库唯一检索入口
- [[AI-Coding方法论]] — 本设计方案的方法论基础
- [[NAS项目概述]] — NAS 全貌与本设计方案的上层架构
- [[APP开发记录与踩坑指南_opencode-agent]] — APP 端对接参考（文件管理、P2P、NFC）
- [[PUF接入与SDK扩展方案]] — PUF 硬件身份与后端集成方案，Agent 审计日志可关联 PUF 存证
- [[决策记录]] — NAS Agent 相关的 multi-match 检索 ADR 记录
