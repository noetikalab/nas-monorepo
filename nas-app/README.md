<div align="center">

![React Native](https://img.shields.io/badge/React_Native-0.85.3-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)
![Android](https://img.shields.io/badge/Android-6%2B-34A853?logo=android)
![License](https://img.shields.io/badge/License-MIT-blue)

</div>

# NasApp

> 基于 PUF 硬件身份的可信 NAS 存储系统 Android 客户端。支持 mDNS 局域网发现、WiFi P2P 无路由器直连、文件管理与共享。

---

## ✨ 功能特性

| 模块 | 功能 | 状态 |
|------|------|:--:|
| 🔐 认证 | 账号密码登录/注册、JWT 自动续期、token 持久化自动登录 | ✅ |
| 🔍 连接 | mDNS 局域网自动发现 → 缓存 IP 快速验证 → WiFi P2P 直连（三层降级） | ✅ |
| 📡 WiFi P2P | Android WifiP2pManager 原生模块，无路由器场景直连 NAS | ✅ 代码就绪* |
| 📁 文件管理 | 目录导航、上传/下载、重命名、删除、新建文件夹、文件详情预览 | ✅ |
| 📤 上传 | 系统文件选择器 → multipart 上传，支持任意文件类型 | ✅ |
| 👥 共享文件 | `/data/shared` 共享目录，普通用户只读，Tab 栏一键切换 | ✅ |
| 🎯 设计 | Precision 设计系统——黑白灰极简风格，Design Token 驱动，色值零硬编码 | ✅ |
| 📱 体验 | Android 返回键拦截、退出确认、401 自动跳登录 | ✅ |

> \* WiFi P2P 模块代码已完成并编译通过，等待 NAS 硬件到位后端到端联调。

---

## 🏗 架构

```
┌───────────────────────────────────────────────────────────┐
│                    NasApp (React Native)                    │
│                                                            │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│   │  LoginScreen │  │  HomeScreen  │  │ DiscoveryScreen  │ │ │
│   │  登录/注册    │  │  文件管理    │  │  mDNS 设备选择    │ │ │
│   │  自动登录    │  │  共享文件    │  └──────────────────┘ │ │
│   └──────┬───────┘  └──────┬───────┘                       │ │
│          │                 │                               │ │
│   ┌──────┴─────────────────┴───────┐                      │ │
│   │         connector.ts            │                      │ │
│   │   mDNS → 缓存 IP → WiFi P2P    │                      │ │
│   └──────┬──────────────┬──────────┘                      │ │
│          │              │                                  │ │
│   ┌──────┴──────┐ ┌─────┴──────────┐                      │ │
│   │  MdnsModule │ │ WifiP2pModule  │  ← Kotlin 原生模块    │ │
│   └─────────────┘ └────────────────┘                      │ │
│                                                            │
│   ┌──────────────────────────────┐                        │ │
│   │         client.ts             │                        │ │
│   │   JWT 注入 · 统一 /api/ 前缀  │                        │ │
│   │   multipart · 401 自动处理   │                        │ │
│   └──────────────┬───────────────┘                        │ │
│                  │                                         │ │
└──────────────────┼─────────────────────────────────────────┘
                   │  HTTP REST (fetch)
                   ▼
┌──────────────────────────────────────────────────────────┐
│               NAS — authd (Go + Gin)                       │
│                                                            │
│   /api/ping    /api/login    /api/register                 │
│   /api/files   /api/files/upload    /api/files/mkdir       │
│   /api/files/move    /api/files/download                   │
│   /api/device-info    /api/validate-token                  │
│                                                            │
│   mDNS 广播: _nas._tcp  ·  WiFi P2P GO: 192.168.49.1      │
└──────────────────────────────────────────────────────────┘
```

---

## 🚀 快速开始

### 环境要求

| 工具 | 版本 |
|------|------|
| Node.js | ≥ 22.11.0 |
| pnpm | ≥ 11 |
| JDK | 17 |
| Android SDK | API 34 |

> **必须使用 Android 真机调试**，模拟器不支持 WiFi P2P。

### 安装与运行

```bash
# 安装依赖
pnpm install

# 原生代码变更后：编译并安装到手机
pnpm android

# 日常开发：启动 Metro 开发服务器
pnpm dev
```

手机需开启 **开发者模式 + USB 调试 + USB 安装**，连接后 `adb devices` 确认识别。`pnpm dev` 自动执行 `adb reverse`，解决 USB 连接 Metro 的问题。

---

## 📁 项目结构

```
src/
├── api/              # HTTP 请求层
│   ├── client.ts        共享客户端 (JWT 注入 · 401 处理)
│   ├── auth.ts          认证 (登录/注册/验证 token)
│   ├── files.ts         文件操作 (列表/上传/下载/增删改)
│   └── device.ts        设备校验
│
├── screens/          # 页面
│   ├── LoginScreen.tsx       登录/注册 + 自动登录
│   ├── HomeScreen.tsx         文件管理 + 共享文件
│   ├── DiscoveryScreen.tsx    mDNS 设备发现与选择
│   ├── DevSettingsScreen.tsx  手动输入服务器地址
│   └── NfcScanScreen.tsx      NFC 碰一碰触发入口
│
├── navigation/       # 路由配置
├── native/           # JSB 原生模块封装
│   ├── MdnsModule.ts       mDNS 局域网发现
│   └── WifiP2pModule.ts    WiFi P2P 直连
│
├── network/          # 连接策略
│   └── connector.ts  mDNS → 缓存 IP → P2P 三层降级
│
├── storage/          # 本地持久化 (AsyncStorage)
├── theme/            # Precision 设计系统
│   ├── tokens.ts         色值 · 间距 · 圆角
│   └── shared.ts         共用 StyleSheet
│
└── types/            # TypeScript 类型定义

android/app/src/main/java/com/nasapp/modules/
├── MdnsModule.kt         mDNS 原生模块 (NsdManager)
├── MdnsPackage.kt
├── WifiP2pModule.kt      WiFi P2P 原生模块 (WifiP2pManager)
└── WifiP2pPackage.kt
```

---

## 🛠 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 框架 | React Native 0.85.3 + TypeScript 5.8 | 路径别名 `@/` |
| 路由 | @react-navigation/native-stack | 5 个 screen |
| HTTP | fetch（`client.ts` 统一封装） | JWT 注入 · multipart 支持 |
| 持久化 | @react-native-async-storage/async-storage v2 | **必须 v2**，v3 国内构建失败 |
| 设计 | Precision Design Tokens | 黑白灰全线 · 色值零硬编码 |
| 原生 | Kotlin (mDNS + WiFi P2P) | ReactPackage 手动注册 |
| 上传 | @react-native-documents/picker 12.0.1 | 替代已废弃的 document-picker |
| 构建 | Gradle 9.3.1 + JDK 17 | 腾讯云镜像加速 |

---

## 📖 文档

| 文档 | 内容 |
|------|------|
| [CLAUDE.md](CLAUDE.md) | AI 接手指引——架构、命令、约束、踩坑 |
| [DESIGN.md](DESIGN.md) | Precision 设计规范——色值、间距、字体 |
| [docs/file-management-plan.md](docs/file-management-plan.md) | 文件管理开发方案——Gap 分析、改造计划 |
| [docs/setup.md](docs/setup.md) | 工程搭建说明——Gradle 镜像、ADB 配置 |
| [wiki/APP开发记录与踩坑指南_opencode-agent.md](../wiki/APP开发记录与踩坑指南_opencode-agent.md) | WiFi P2P + 文件管理踩坑实录（12 条） |
| [NAS 整体方案（飞书）](https://my.feishu.cn/docx/EhQodDF20oHLMixoRaWcrejinIf) | 完整架构图 · PUF 接入 · SDK 设计 |
| [WiFi P2P + NFC 开发方案（飞书）](https://my.feishu.cn/docx/ECfhdOcRUoa4XHxqCiOckoS7nOb) | APP ↔ NAS 连接方案 |

---

## 🤝 后端

后端代码见 [`../ldap-demo/`](../ldap-demo/)，Go authd 服务默认运行在 `:8080`。

| 服务 | 端口 | 用途 |
|------|:----:|------|
| authd (Go) | 8080 | REST API + Swagger UI |
| Nginx WebDAV | 8081 | PC 文件管理器挂载 |
| Samba (SMB) | 445 | Windows 文件共享 |
| NFS | 2049 | Linux 挂载 |

---

## 📝 License

MIT
