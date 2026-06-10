# NAS Core — 可信个人存储

> 基于 PUF 硬件身份的可信 NAS 系统。
> 多协议、多设备、零信任。
> **Your data. Your hardware. Your proof.**

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.25-00ADD8?logo=go" />
  <img src="https://img.shields.io/badge/React_Native-0.85-61DAFB?logo=react" />
  <img src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker" />
  <img src="https://img.shields.io/badge/License-Proprietary-red" />
</p>

---

## 关于本仓库

本项目是 NAS Core 的**整体源码仓库（monorepo）**，日常开发在各自的独立仓库进行，本仓库是迁移合并后的统一版本（2026-06-10），适合新人拉取入门、工作交接和完整文档检索。

| 子模块 | 独立仓库 | 说明 |
|------|---------|------|
| `nas-core/` | [github.com/noetikalab/nas-core](https://github.com/noetikalab/nas-core) | Go authd + OpenLDAP + Samba + NFS + Docker |
| `nas-web/` | [github.com/noetikalab/nas-web](https://github.com/noetikalab/nas-web) | Web 管理后台 |
| `nas-app/` | [github.com/noetikalab/nas-app](https://github.com/noetikalab/nas-app) | Android 客户端 |
| `nas-landing/` | [github.com/noetikalab/nas-landing](https://github.com/noetikalab/nas-landing) | 产品落地页 |
| `wiki/` | 无独立仓库 | 项目知识库（18 条坑点 / 12 条架构决策） |

> ⚠️ 迁移说明：`nas-core` 原目录名为 `ldap-demo`，`nas-app` 原目录名为 `NasApp`。迁移后统一命名为 `nas-*`。文档中的交叉引用（`[[wiki/xxx]]`）在此 monorepo 内完好，独立仓库中可能断裂。

---

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                      NAS Core                            │
│                                                         │
│   ┌──────────┐  ┌──────────┐  ┌──────────────────┐     │
│   │ nas-app  │  │ nas-web  │  │   nas-landing     │     │
│   │ Android  │  │ 后台管理  │  │   产品落地页      │     │
│   │ React    │  │ Next.js  │  │   R3F 3D 场景    │     │
│   │ Native   │  │ shadcn   │  │                  │     │
│   └────┬─────┘  └────┬─────┘  └──────────────────┘     │
│        │              │                                 │
│   ┌────┴──────────────┴────┐                            │
│   │       authd :8080      │                            │
│   │   Go API + JWT 鉴权    │                            │
│   │   mDNS + P2P + NFC    │                            │
│   │   存证哈希链 + ACL     │                            │
│   └────────┬───────────────┘                            │
│            │                                            │
│   ┌────────┼────────┬──────────┐                        │
│   │  SMB   │  NFS   │ WebDAV   │                        │
│   │ :445   │ :2049  │ :8081    │                        │
│   └────────┴────────┴──────────┘                        │
│                                                         │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│   │ OpenLDAP │  │  SQLite  │  │ 存证链   │             │
│   │ 身份源   │  │ .nas.db  │  │ Proof    │             │
│   └──────────┘  └──────────┘  └──────────┘             │
│                                                         │
│   Docker Compose 四容器编排 · 离线部署 < 2GB            │
└─────────────────────────────────────────────────────────┘
```

---

## 功能亮点

| 功能 | 描述 |
|------|------|
| 🔐 **三协议统一认证** | HTTP(JWT) + SMB(ldapsam) + NFS(UID 映射)，共享 LDAP 身份源 |
| 🔑 **POSIX ACL 权限** | 一套权限三协议共用，不漂移、不割裂 |
| 📡 **智能连接策略** | mDNS 自动发现 → 缓存 IP → WiFi P2P 三层降级，无路由器也能连 |
| 📱 **NFC 碰一碰** | 手机碰标签获取 device_id → 智能连接 → 首次验密后续免密登录 |
| 🔗 **哈希存证链** | 每次文件操作记录 22 字段 + SHA-256 指纹 + prev_hash 链式存储 |
| 📦 **ProofBundle 导出** | 完整存证包导出，任何人持公钥可独立验证全部历史 |
| 🐳 **Docker 一键部署** | 四容器编排，支持离线部署包（docker save/load + dpkg 安装） |
| 🎨 **3D 产品展示** | nas-landing 基于 React Three Fiber 的交互式 3D 场景 |
| 💻 **管理后台** | nas-web 基于 Next.js + shadcn/ui + recharts 的功能面板 |
| 📲 **移动客户端** | nas-app 基于 React Native + Kotlin 原生模块 |
| 🤖 **Agent 智能应用** | RAG 语义检索 + MCP Server + Skills 技能库（规划中） |

---

## 快速开始

### 环境准备

| 模块 | 需要安装 | 说明 |
|------|---------|------|
| `nas-core/` | **Docker + Docker Compose**（Node / Go 不需要，全部容器化） | 后端核心服务 |
| `nas-web/` | Node 22 + pnpm | Web 管理后台 |
| `nas-landing/` | Node 22 + pnpm | 产品落地页 |
| `nas-app/` | Node 22 + pnpm + JDK 17 + Android SDK | 需要真机调试 |

```bash
# ======== 1. 启动 NAS 后端 ========
cd nas-core

# 首次：拉基础镜像并构建
docker compose build

# 启动（不加 -d，直接看启动日志，确认各服务正常）
docker compose up

# 容器就绪后，另开终端注册第一个管理员
curl -X POST http://localhost:8080/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123456"}'

# 查看设备信息
curl http://localhost:8080/api/device-info

# 访问 Swagger API 文档
# 浏览器打开 http://localhost:8080/swagger/index.html

# ======== 2. 启动 Web 管理后台（可选）========
cd ../nas-web
pnpm install
pnpm dev
# 浏览器打开 http://localhost:3000

# ======== 3. 启动落地页（可选）========
cd ../nas-landing
pnpm install
pnpm dev
# 浏览器打开 http://localhost:3001

# ======== 4. Android APP ========
# 见 nas-app/ 目录下的 README
```

> 确认各服务启动正常后，下次可用 `docker compose up -d` 后台运行。
> 启动过程遇到问题？见 [坑点汇总](wiki/坑点汇总.md) 和 [项目概述](wiki/NAS项目概述.md)。

### 离线部署（无网络环境）

目标机无法联网？将镜像和配置打包即可：

```bash
# 1. 开发机（有网）导出镜像
docker save -o /tmp/nas-images.tar \
  osixia/openldap:1.5.0 \
  nas-core:latest \
  nas-web:latest

# 2. U 盘传输到目标机（cp 后先执行 sync 刷盘，再拔 U 盘，避免缓存丢失）

# 3. 目标机加载并启动
docker load -i /tmp/nas-images.tar
docker compose up   # 不加 -d，观察日志确认服务正常
```

> 镜像名不含冒号（`-` 替代 `:`），兼容 exFAT 文件系统。
> Docker Engine 自身也可离线安装（`dpkg -i *.deb`），详见离线部署文档。

---

## 项目结构

```
nas-all-source/
├── nas-core/                  # NAS 服务端
│   ├── authd/                 #   Go HTTP API（Gin）
│   │   ├── handler/           #   请求处理器（8 个 handler 文件）
│   │   ├── ldap/              #   LDAP 客户端
│   │   ├── system/            #   文件系统 + 设备 ID
│   │   ├── mdns/              #   mDNS 局域网广播
│   │   └── pkg/jwt/           #   JWT 签发/解析
│   ├── deploy/                #   Dockerfile + Nginx + Samba 配置
│   ├── ldap/                  #   LDAP 初始化文件
│   └── docker-compose.yml     #   四容器编排
│
├── nas-web/                   # Web 管理后台
│   └── src/                   # Next.js 应用
│       ├── app/               #   页面（6 个路由）
│       ├── components/        #   组件（文件管理/仪表盘/UI）
│       ├── services/          #   API 服务层（7 个模块）
│       └── hooks/             #   自定义 Hooks
│
├── nas-app/                   # Android 客户端
│   └── src/                   # React Native 应用
│       ├── screens/           #   页面（5 个 Screen）
│       ├── native/            #   Kotlin 原生模块
│       ├── network/           #   连接策略
│       └── api/               #   HTTP 请求层
│
├── nas-landing/               # 产品落地页
│   └── src/                   # Next.js + R3F 3D
│
├── wiki/                      # 项目知识库
│   ├── NAS项目概述.md          # 完整架构介绍
│   ├── 坑点汇总.md             # 18 条避坑指南
│   ├── 决策记录.md             # 12 条架构决策
│   ├── NAS_Agent设计文档.md    # 智能文件管理方案
│   ├── PUF接入与SDK扩展方案.md # PUF 硬件集成方案
│   ├── WiFi_P2P_NFC_APP_开发方案.md  # 连接层方案
│   ├── APP开发记录与踩坑指南.md       # APP 踩坑记录
│   └── 协议层.md               # 知识库规范
│
└── docs/                      # 设计文档
```

---

## 技术栈

| 层 | 技术 |
|------|------|
| 后端 API | Go + Gin + Swagger |
| 身份源 | OpenLDAP（samba schema） |
| 文件服务 | Samba(SMB :445) + NFS(:2049) + Nginx(WebDAV :8081) |
| 存储 | SQLite（纯 Go，零 CGO 依赖） |
| 容器编排 | Docker Compose（openldap + ldap-init + nas） |
| Android APP | React Native 0.85 + TypeScript + Kotlin JSB |
| Web 管理后台 | Next.js 16 + Tailwind 4 + shadcn/ui + recharts |
| 产品落地页 | Next.js + React Three Fiber + GSAP |
| 存证哈希链 | SHA-256（待切换 SM3） |
| PUF 硬件 | CCM3302 芯片（SM2 签名 + SM3 哈希，待对接） |

---

## API 概览

| 分组 | 端点 | 说明 |
|------|------|------|
| 公开 | `GET /api/ping` | 连通性测试 |
| | `GET /api/device-info` | 设备身份校验 |
| | `POST /api/register` | 用户注册 |
| | `POST /api/login` | 用户登录 |
| | `POST /api/nfc-login` | NFC 碰一碰登录 |
| | `POST /api/nfc-bind` | NFC 首次绑定 |
| 文件 | `GET /api/files?path=` | 列目录 |
| | `GET /api/files/download?path=` | 下载文件 |
| | `POST /api/files/upload` | 上传文件 |
| | `POST /api/files/mkdir` | 创建目录 |
| | `DELETE /api/files?path=` | 删除文件 |
| | `POST /api/files/move` | 移动/重命名 |
| 管理 | `GET /api/dashboard/stats` | 系统资源统计 |
| | `GET /api/users` | 用户列表 |
| | `GET /api/logs` | 审计日志 |
| | `GET /api/proof/bundle` | 导出存证包 |

完整 API 文档参见 Swagger UI：`http://<nas-ip>:8080/swagger/index.html`

---

## 文档

| 文档 | 说明 |
|------|------|
| [项目概述](wiki/NAS项目概述.md) | 完整项目介绍，接手必读 |
| [坑点汇总](wiki/坑点汇总.md) | 18 条跨模块避坑指南 |
| [决策记录](wiki/决策记录.md) | 12 条架构决策（ADR） |
| [Agent 设计](wiki/NAS_Agent设计文档.md) | 智能文件管理 Agent 方案 |
| [PUF 集成方案](wiki/PUF接入与SDK扩展方案.md) | PUF 硬件身份认证接入 |
| [连接层方案](wiki/WiFi_P2P_NFC_APP_开发方案.md) | mDNS + P2P + NFC 全链路 |
| [APP 踩坑](wiki/APP开发记录与踩坑指南_opencode-agent.md) | APP 端开发完整回溯 |
| [离线部署操作指南](https://my.feishu.cn/docx/XkRKdWFZXoQsujxtBWUcR9rrnUc) | 无网络一键部署 |
| [演示剧本](https://my.feishu.cn/docx/T6NMdY7KAoDVedxVRW8cRrbAntg) | 半小时 demo 串讲 |

---

## License

Proprietary — All Rights Reserved.
