# AGENTS.md

## 项目概述

基于 PUF 硬件身份的可信 NAS 存储系统，支持多协议文件访问与司法级存证。

三端：后端 Go authd + OpenLDAP + Samba + NFS、APP React Native、Web Next.js 管理后台。

当前阶段：APP 端功能完整（登录/文件管理/上传/共享/NFC 碰一碰），后端所有接口就绪，PUF 硬件到货待集成，NAS Agent（智能文件管理助手）Phase 2 进行中。

**知识库已更新**：阅读 wiki/NAS项目概述.md 快速了解全貌，wiki/index.md 是唯一检索入口。

## 子仓库

| 路径 | 模块 | 独立 AGENTS.md |
|------|------|:---:|
| `nas-app/` | Android APP（React Native） | ✅ |
| `nas-core/` | NAS 后端（Go authd + OpenLDAP + Samba + NFS） | ✅ |
| `nas-web/` | Web 管理后台（Next.js） | ✅ |
| `nas-landing/` | 落地页（Next.js + Three.js 3D 展示） | ✅ |
| `PUF厂商提供/` | PUF SD 驱动 API 文档和头文件 | — |
| `diagrams/` | 架构图草稿 | — |

## 关键决策

- **身份源**：LDAP，注册时同步写入 posixAccount + sambaSamAccount
- **认证**：HTTP/WebDAV 用 JWT，SMB 用 ldapsam，NFS 用 UID 映射
- **权限**：POSIX ACL 是唯一权限真相，三协议共用
- **存证签名**：在 NAS 服务端完成（PUF 签名 + 时间戳 + 哈希链）
- **PUF**：设备唯一硬件指纹，用于设备身份绑定，不在客户端做签名
- **安全**：MVP 阶段不做防重放和 HTTPS，正式版再加
- **device_id**：`system.GetDeviceID()` 统一生成（读 `/host/etc/machine-id` → MD5 → 前12位 hex），mDNS 服务名、device-info、NFC 标签共用同一值
- **NFC 绑定**：phone_id ↔ username 映射存在 LDAP `ou=nfc_bindings` 下，用 `organizationalRole` 对象类，不需要额外数据库表
- **容器命名**：所有 compose 服务用 `container_name` 固定短名（openldap/ldap-init/nas-core/nas-web），替代自动生成的冗长名字
- **离线部署**：镜像导出为 tar → U盘 → 目标机 `docker load`，文件名用 `-` 替代 `:`（exFAT 兼容），`cp` 后 `sync` 刷盘

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 API | Go authd + Gin + Swagger |
| 身份源 | OpenLDAP |
| 文件服务 | Samba（SMB）+ NFS + Nginx WebDAV |
| APP | React Native 0.85 + TypeScript + Kotlin JSB |
| Web | Next.js |
| 容器 | Docker Compose 四容器编排 |
| PUF | CCM3302 芯片 + puf-agent（Go → HTTP → C SDK） |

## 飞书文档清单

| 文档 | URL | 说明 |
|------|-----|------|
| PUF-NAS 技术架构设计文档 v2（LDAP方案） | https://my.feishu.cn/docx/EhQodDF20oHLMixoRaWcrejinIf | 主设计文档，含架构图、认证流程、PUF 接入方案 |
| 同事方案：第九章 PUF 接入与 SDK 扩展 | https://ycnmf2mld2q6.feishu.cn/wiki/EuAvwIL9yixy0VkBpoacvLeWnKc | 四容器架构、puf-agent HTTP API |
| AI-Native 研发知识库设计方案 | https://my.feishu.cn/docx/N3T1daDqSoHoM4xZ70ZcyvuOnph | 知识库完整设计方案（opencode-agent 输出） |

## 知识库

| 文件 | 内容 |
|------|------|
| wiki/index.md | 全局知识目录（唯一检索入口） |
| wiki/协议层.md | 知识库协议——模板、标签、时效规则 |
| wiki/NAS项目概述.md | 完整项目介绍，接手必读 |
| wiki/NAS_Agent设计文档.md | 智能文件管理 Agent 方案 |
| wiki/坑点汇总.md | 跨模块通用坑点 18 条 |
| wiki/决策记录.md | 全局架构决策 ADR 12 条 |
| wiki/PUF接入与SDK扩展方案.md | PUF 硬件身份认证接入 |
| wiki/APP开发记录与踩坑指南_opencode-agent.md | APP 端开发完整回溯 |

## 注意事项

- `手机与取证 NAS 安全连接方案 .docx` 是外部参考意见，与本项目方案不符，不参考
- Samba 域 SID 必须通过 `net setlocalsid` 设置，`ldap domain sid` 是无效参数
- Docker 容器必须 `network_mode: host`，否则 mDNS UDP 多播被 bridge 隔离
