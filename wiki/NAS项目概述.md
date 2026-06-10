# NAS 项目概述

> 时效：fresh / 上次验证：2026-06-10
> 标签：项目概述, 架构, 后端, app, web, 部署, nfc
> 源材料：AGENTS.md（根目录），nas-core/AGENTS.md，nas-app/AGENTS.md
> 创建：2026-06-05 / 更新：2026-06-10

## 一、背景与目标

基于 PUF（Physical Unclonable Function）硬件身份的可信 NAS 存储系统。支持多协议文件访问（SMB / NFS / WebDAV）与司法级存证。

核心目标：
- **身份可信**：PUF 芯片提供设备唯一硬件指纹，防止设备伪造
- **多协议统一认证**：HTTP/WebDAV（JWT）、SMB（ldapsam）、NFS（UID 映射）共用 LDAP 身份源
- **权限统一**：POSIX ACL 是唯一权限真相，三协议共用
- **司法存证**：每个文件操作生成哈希链 + PUF 签名，可独立验证

当前阶段：APP 端功能完整，后端所有接口就绪，PUF 硬件到货待集成，NAS Agent（智能文件管理助手）Phase 2 进行中。

## 二、系统架构

### 容器架构（Docker Compose）

```
┌─────────────────────────────────────────────────────────┐
│ Docker Compose (network_mode: host)                      │
│                                                         │
│ ┌──────────────────┐   LDAP:389    ┌──────────────────┐ │
│ │ openldap:1.5.0   │◄─────────────│  nas (authd)      │ │
│ │ (身份源)          │              │  Go :8080          │ │
│ └──────────────────┘              │  Samba :445        │ │
│                                   │  NFS :2049         │ │
│ ┌──────────────────┐              │  WebDAV :8081      │ │
│ │ ldap-init        │              │  WiFi P2P GO       │ │
│ │ (一次性初始化)     │              └────────┬─────────┘ │
│ └──────────────────┘                         │           │
│                                   ┌──────────┴─────────┐ │
│                                   │ nas-agent (Python)  │ │
│                                   │ AI Agent + RAG      │ │
│                                   │ (Phase 2+)          │ │
│                                   └────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**关键设计**：所有容器使用 `network_mode: host`，因为 mDNS UDP 多播被 Docker bridge 网络隔离，无法实现局域网设备发现。

### 三协议文件服务

| 协议 | 端口 | 认证方式 | 用途 |
|------|------|---------|------|
| HTTP API | 8080 | JWT（Bearer Token） | APP/Web 调用 |
| WebDAV | 8081 | auth_request → authd validate-token | 第三方客户端 |
| SMB | 445 | ldapsam（Samba 直接查 LDAP） | Windows/macOS 挂载 |
| NFS | 2049 | UID 映射（通过 LDAP 同步） | Linux 挂载 |

### 数据流

```
用户认证：LDAP（唯一身份源）
         ├─ HTTP/JWT: authd 签发 Token
         ├─ SMB: Samba 调 ldapsam 验证
         └─ NFS: UID/GID 从 LDAP 同步到系统

文件操作：authd REST API（非 WebDAV）
         ├─ list/download → validatePath（读权限）
         ├─ upload/mkdir/delete/move → validateWritePath（写权限）
         └─ 写操作同时写入 certified_operations + proof_records 存证

权限系统：POSIX ACL（唯一权限真相）
         ├─ setfacl/getfacl 管理
         ├─ 用户只能操作 /data/{username}/ 和 /data/shared/
         └─ admin 可操作全部 /data/
```

## 三、仓库结构

| 路径 | 模块 | 技术栈 | 独立文档 |
|------|------|--------|:--------:|
| `nas-core/` | NAS 后端 | Go authd + Gin + Swagger + OpenLDAP | ✅ AGENTS.md |
| `nas-app/` | Android APP | React Native 0.85 + TypeScript + Kotlin JSB | ✅ AGENTS.md |
| `nas-web/` | Web 管理后台 | Next.js | ✅ AGENTS.md |
| `nas-landing/` | 落地页（3D 产品展示） | Next.js + Three.js | ✅ AGENTS.md |
| `wiki/` | 全局知识库 | Markdown + 协议层 | index.md 检索入口 |
| `diagrams/` | 架构图草稿 | — | — |
| `PUF厂商提供/` | PUF 芯片 SDK 和 API 文档 | C SDK | — |

## 四、技术栈

| 层 | 技术 |
|----|------|
| 后端 API | Go + Gin + Swagger（自动生成文档） |
| 身份源 | OpenLDAP（osixia/openldap:1.5.0） |
| 数据库 | SQLite（modernc, WAL 模式） |
| 文件服务 | Samba（SMB）+ NFS + Nginx WebDAV |
| 存证 | SHA-256 哈希链 + PUF 签名（CCM3302 芯片） |
| APP | React Native 0.85 + TypeScript + Kotlin JSB |
| Web | Next.js |
| 容器 | Docker Compose 四容器编排 |
| Agent | Python（nas-agent）+ FTS5 + bge-m3 向量 + 按需 VLM |
| NFC | NTAG216 芯片 + Android NDEF 前台分发 |

## 五、关键设计决策

### 5.1 LDAP 作为唯一身份源

所有认证方式（JWT / ldapsam / UID 映射）共用同一个 LDAP 存储。用户注册时同步创建：
- `posixAccount`（系统用户，提供 UID/GID/homeDirectory）
- `sambaSamAccount`（Samba 用户，提供 NT hash）
- Linux `useradd`（本地系统用户，供 NFS UID 映射）

### 5.2 POSIX ACL 作为唯一权限真相

不维护独立的权限数据库。文件权限通过 Linux 的 `setfacl` / `getfacl` 管理，SMB、NFS、WebDAV 三协议都读同一组 ACL。

关键坑点：setfacl 不能直接传用户名（LDAP 用户不在 /etc/passwd），必须先查 UID，再用数字 UID 格式 `user:1002:rwx`。

### 5.3 PUF 硬件指纹

CCM3302 芯片焊接在 NAS 主板上，用于：
- **设备身份**：`system.GetDeviceID()` 读取宿主机 `/host/etc/machine-id` → MD5 → 前12位 hex，作为 mDNS 服务名、device-info 接口、NFC 标签的统一设备标识。Docker 需挂载 `/etc/machine-id:/host/etc/machine-id:ro`
- **存证签名**：文件操作哈希链 + PUF 签名，验证方导出 ProofBundle 独立验证
- **当前状态**：芯片到货，puf-agent（Go → HTTP → C SDK）待集成

### 5.4 NFC 碰一碰登录

APP 触碰 NTAG216 标签 → AAR 冷启动 APP → 前台调度读取 NDEF 中 device_id → mDNS 发现 NAS → 三层连接（mDNS → 缓存 IP → WiFi P2P）→ NFC 登录。

**后端接口**：
- `POST /api/nfc-login` — 碰一碰登录（无需 JWT）：接收 `{device_id, phone_id}`，查 LDAP `ou=nfc_bindings` 中 phone_id 绑定 → 返回 JWT
- `POST /api/nfc-bind` — 首次绑定（无需 JWT）：接收 `{device_id, phone_id, username, password}`，验密后写入 LDAP 绑定

**device_id 统一生成**：通过 `system.GetDeviceID()` 读取宿主机 `/host/etc/machine-id` → MD5 → 前12位 hex，mDNS 服务名、`/api/device-info`、NFC 标签写入共用同一值。Docker 需挂载 `/etc/machine-id:/host/etc/machine-id:ro`。

**绑定存储**：phone_id ↔ username 映射存在 LDAP `ou=nfc_bindings,dc=nas,dc=local` 下，用 `organizationalRole` 对象类（`cn={phone_id}`, `roleOccupant={user_dn}`），不需要额外数据库表。

已知限制：部分国产 ROM 将 AAR intent 降级为 MAIN + 丢弃 extras。最终方案是 `enableReaderMode`，当前待实现。

### 5.5 文件 API 独立于 WebDAV

文件操作不走 WebDAV XML 协议，而是在 authd 内实现 REST + JSON 接口（自定义响应字段），供 APP 直接调用。WebDAV（端口 8081）仅作为第三方客户端兼容入口。

### 5.6 container_name 规范化

所有 Docker Compose 服务使用 `container_name` 显式指定固定短名，替代 compose 自动生成的冗长名字（如 `ldap-demo-openldap-1`）：

| 服务 | container_name |
|------|---------------|
| OpenLDAP | `openldap` |
| LDAP 初始化 | `ldap-init` |
| NAS 核心 | `nas-core` |
| Web 管理后台 | `nas-web` |

优势：跨环境容器名一致，脚本和文档可直接写死容器名（如 `docker exec openldap ldapsearch ...`），不依赖项目目录名。约束：同一 Docker daemon 下不能运行多套实例。

## 六、开发环境

### 快速启动

```bash
# 启动容器（使用固定容器名）
sudo docker compose up --build -d

# 查看 authd 日志
sudo docker compose logs nas-core -f

# 查询 LDAP 用户（使用统一容器名 openldap）
sudo docker exec openldap ldapsearch -x -H ldap://localhost \
  -D "cn=admin,dc=nas,dc=local" -w admin123 -b "ou=users,dc=nas,dc=local"

# 访问 Swagger UI
# http://<host-ip>:8080/swagger/index.html
```

### 真机测试要求

- APP 需要在 Android 真机上运行（NFC / WiFi P2P 模拟器不支持）
- 桌面版 Ubuntu（NetworkManager）P2P 不可用，测试走 mDNS
- USB 网络共享时 mDNS 可发现 NAS 但 HTTP TCP 路由不可达，需要手机直连同一 WiFi

### 端口分配

| 端口 | 服务 |
|------|------|
| 389 | OpenLDAP |
| 8080 | authd HTTP API |
| 8081 | Nginx WebDAV |
| 445 | Samba |
| 2049 | NFS |

## 七、知识库导航

```
AGENTS.md（根目录，全局路由）
  └─ wiki/index.md（全局知识库唯一检索入口）
       ├─ 协议层.md —— 知识库协议模板
       ├─ NAS项目概述.md —— 本文件
       ├─ NAS_Agent设计文档.md —— 智能文件管理 Agent 方案
       ├─ APP开发记录与踩坑指南_opencode-agent.md —— 12 条踩坑实录
       ├─ WiFi_P2P_NFC_APP_开发方案.md —— 同事联合方案
       ├─ AI-Coding方法论.md —— AI 编码协作方法论
       ├─ Agent开发技术总结.md —— Agent 开发经验技巧
       ├─ PUF接入与SDK扩展方案.md —— PUF 硬件接入方案
       ├─ 坑点汇总.md —— 跨模块通用坑点
       └─ 决策记录.md —— 架构决策 ADR
```

各子仓库内的 `AGENTS.md` 和 `docs/` 目录包含该仓库特有的本地知识。

## 八、部署指南

### 首次部署

```bash
# 1. 克隆代码
git clone <repo-url>

# 2. 配置环境变量（docker-compose.yml 中）
# JWT_SECRET、DOMAIN_SID 必须设置，其余可保持默认

# 3. 启动（使用 container_name 规范）
sudo docker compose up --build -d

# 4. 验证
curl http://localhost:8080/api/ping
# → {"ok": true}
```

### Docker 离线部署

适用于目标 NAS 无公网访问的场景（镜像导出 → U盘 → 离线加载）：

```bash
# === 在联网机器上 ===

# 1. 拉取所有依赖镜像
docker pull golang:1.25
docker pull osixia/openldap:1.5.0
docker pull nginx:alpine
docker pull node:24-alpine

# 2. 构建本地镜像（确保 compose 中设置了 image:）
docker compose build

# 3. 导出镜像为 tar（注意：文件名不能含冒号，exFAT U盘不兼容）
docker save -o nas-images-1.1.0.tar nas-core:latest nas-web:latest
docker save -o base-images.tar golang:1.25 osixia/openldap:1.5.0 nginx:alpine node:24-alpine

# 4. 拷贝到 U 盘并刷盘
cp nas-images-1.1.0.tar base-images.tar /media/usb/
sync

# === 在目标 NAS 上 ===

# 5. 加载镜像
docker load -i /media/usb/nas-images-1.1.0.tar
docker load -i /media/usb/base-images.tar

# 6. 启动（不加 `-d`，查看日志确认各服务正常后再后台运行）
sudo docker compose up
```

**注意事项**：
- 镜像 tar 文件名用 `-` 替代 `:`（exFAT/FAT32 不支持冒号）
- `cp` 到 U 盘后必须执行 `sync` 刷盘，否则拔线可能丢数据
- 如修改 compose 中 `image:` 标签，需先 `docker compose down` 再 `up`，否则复用旧容器
- 确认挂载了 `/etc/machine-id:/host/etc/machine-id:ro`（NFC device_id 校验依赖）

### 关键配置

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `JWT_SECRET` | JWT 签名密钥（必须修改） | nas-demo-secret-key-32bytes-long! |
| `DOMAIN_SID` | Samba 域 SID（必须设置） | S-1-5-21-... |
| `LDAP_ADMIN_PW` | LDAP 管理员密码 | admin123 |
| `SQLITE_PATH` | SQLite 数据库路径 | /data/.nas.db |

### 注意事项

- **Samba SID**：必须通过 `net setlocalsid` 设置，`ldap domain sid` 是无效参数
- **NFS**：容器需要 `privileged: true` 权限
- **PUF**：需要将宿主机的 `/etc/machine-id` 挂载到容器内 `/host/etc/machine-id:ro`
- **ldap-init entrypoint**：必须用列表形式覆盖，不能用 `command: >` 或 `command: |`

## 九、当前阶段与路线图

```
完成 ─────────────────────────────────────────────────────► 进行中 ──► 待启动
    APP 端                     PUF 待集成          音视频/图片
    完整                      (芯片已到货)         内容理解
  ├─ 登录/注册                ├─ puf-agent         ├─ CLIP 相似图片
  ├─ 文件管理                   HTTP API 对接         按需 VLM
  ├─ 上传/下载                ├─ C SDK 集成          Whisper 转写
  ├─ NFC 碰一碰              ├─ 硬件联调
  ├─ 共享/权限                                          NAS Agent
  └─ WiFi P2P             后端所有接口就绪           智能文件管理
                               ├─ 文件 CRUD          Phase 1: Hermes 原型 ✅
    Web 管理后台               ├─ 用户管理            Phase 2: 独立容器上线 🟡
    部分完成                   ├─ 审计日志            Phase 3: VLM + 多步任务
   ├─ Dashboard                ├─ 存证导出            Phase 4: 定时 Agent
   ├─ 用户管理                  └─ Swagger 文档
   ├─ 权限管理
   │                           nas-landing 3D
   └─                          展示页面 ✅
```

## 相关文章

- [[index]] — 知识库唯一检索入口
- [[协议层]] — 本文档使用的文章类型模板
- [[NAS_Agent设计文档]] — 智能文件管理 Agent 方案（下一阶段重点）
- [[APP开发记录与踩坑指南_opencode-agent]] — APP 端开发完整回溯
- [[PUF接入与SDK扩展方案]] — PUF 硬件接入详情
- [[坑点汇总]] — 全项目通用坑点（P2P/NFC/ACL/编译/Docker/部署）
- [[决策记录]] — 架构 ADR 来源（LDAP/PUF/mDNS/ACL/NFC/容器规范）
