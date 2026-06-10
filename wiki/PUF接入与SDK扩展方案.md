# 第九章 PUF 接入与 SDK 扩展方案

本章描述如何将 PUF（Physical Unclonable Function）硬件身份认证能力接入 NAS 系统，并通过 SDK 向第三方应用开放，形成完整的可信存储产品方案。

> **硬件部署说明**：PUF 芯片焊接在 NAS 设备主板上，随 NAS 一同出厂。所有 PUF 操作均在 NAS 内部完成，客户端设备（手机/电脑/Pad）不直接接触 PUF 芯片，而是通过 authd 提供的 API 间接使用 PUF 能力。

---

## 9.1 PUF 芯片定位与能力总览

### 9.1.1 芯片物理位置

```
┌────────────────────────────────────────────────────────┐
│                    NAS 设备内部                          │
│                                                        │
│  ┌──────────┐   本地调用    ┌──────────────┐            │
│  │ PUF 芯片  │ ←──────────→ │  puf-agent   │            │
│  │ (CCM3302) │   SD 接口    │  (容器)       │            │
│  └──────────┘              └──────┬───────┘            │
│                                   │ HTTP/gRPC          │
│                                   │ (nas-internal 网络) │
│                            ┌──────▼───────┐            │
│                            │    authd     │            │
│                            └──────┬───────┘            │
│                                   │                    │
│                   LDAP / Samba / NFS                   │
└───────────────────────────────────┼────────────────────┘
                                    │ 网络（HTTPS / SMB / NFS）
                            ┌───────┼───────┐
                            │       │       │
                         手机APP   电脑     Pad
                        (WebDAV)  (SMB)  (WebDAV)
```

**关键点**：
- PUF 芯片只和同一台 NAS 内部的 puf-agent 通信（SD 总线，物理连接）
- puf-agent 只对同一台 NAS 内部的 authd 暴露接口（nas-internal 网络，不对外）
- 外部客户端永远不直接接触 PUF 芯片，也不直接调 puf-agent
- 客户端通过 authd 的标准 API（登录/上传文件等）间接获得 PUF 的安全加持

### 9.1.2 PUF 芯片提供的能力

PUF 芯片（CCM3302）提供以下能力，全部通过 puf-agent 封装后供 authd 调用：

| 能力类别 | 芯片 API | 通俗理解 | 在 NAS 中的应用 |
|----------|---------|---------|----------------|
| **设备唯一 ID** | GetRegUID | 芯片"身份证号"，出厂烧死不可改 | 绑定 NAS 设备身份，防替换 |
| **硬件根密钥** | GetRootKey | 芯片物理特性生成的 32 字节密钥，断电消失 | 派生 NAS 所有密钥的种子，永不离开芯片 |
| **真随机数** | GetRandom | 硬件噪声源产生，比软件随机数安全 | JWT 签名密钥生成、挑战码生成 |
| **SM2 签名** | CLASign | 芯片用私钥对数据盖章（222 字节签名） | 文件存证签名、设备身份证明 |
| **SM2 验签** | CLAVerify | 验证签名是不是这颗芯片签的 | 验证存证收据真伪 |
| **SM3 哈希** | CLASM3Hash | 国密哈希，32 字节输出 | 文件指纹计算 |
| **挑战-响应** | GetCRP | 给芯片一个随机数，它返回唯一响应 | 设备认证——"证明你是原装 NAS" |
| **SM2/SM4 加解密** | SM2Encrypt/Decrypt SM4Encrypt/Decrypt | 国密加解密 | 敏感数据保护（阶段2） |
| **PID/Envelope 配置** | CLAEnvelop / CLAIdPid / CLAGwPid / CLASysPid | 芯片身份密钥烧录（出厂一次性） | NAS 运行时不调用，由生产工具完成 |

> ⚠️ **【待讨论-问题5】PID/Envelope 配置未展开说明**
>
> PUF API 文档 2.4 节定义了 4 个 PID/Envelope 配置函数（CLAEnvelop / CLAIdPid / CLAGwPid / CLASysPid），用于出厂时向芯片烧录设备身份密钥。本章之前未提及，读者可能疑惑"芯片的 SM2 私钥从哪来的"。
>
> **建议方案**：在上方能力表中增加一行（已补充）。另外建议在主文档中加一句说明：NAS 设备出厂时，生产工具调用这 4 个 API 完成芯片初始化。正常运行时 authd 不调用、puf-agent 也不暴露这些接口。

### 9.1.3 PUF 密钥派生流程

> ⚠️ **【待讨论-问题4】密钥派生流程原文档有标题无内容，本章完全缺失**
>
> 主文档 9.1.2 标题为"PUF 密钥派生流程"但正文为空。本章也未包含此内容。需要说明根密钥（GetRootKey 的 32 字节输出）如何派生出 JWT 签名密钥、设备身份私钥等。
>
> **建议方案**：补入以下内容（团队讨论确认派生方式后定稿）：
>
> ```
> 设备出厂时（一次性烧录）：
>   PUF 芯片 GetRootKey → 32 字节根密钥
>     ├── HKDF-HMAC-SM3 派生 → JWT 签名密钥（256bit）
>     ├── HKDF-HMAC-SM3 派生 → 设备身份密钥（SM2 签名私钥）
>     └── HKDF-HMAC-SM3 派生 → 存证签名密钥
>
> 根密钥永不离开芯片，派生也在芯片内部完成。
> HKDF 的 salt = 芯片 UID + NAS 序列号，确保不同设备派生不同密钥。
> 所有派生密钥同样不离开芯片——authd 只能请求"用某派生密钥做某操作"。
> ```

### 9.1.4 不在 MVP 范围的能力

- SM4 对称加解密（224 字节单次限制，大文件需分片，MVP 不做）
- SM2 非对称加解密（用于加密小数据如密钥，阶段2 实现）
- SN/版本/模式 ROM 读写（出厂时一次烧录，NAS 运行时不调用）

---

## 9.2 puf-agent 服务设计

### 9.2.1 定位

puf-agent 是 NAS 内部的第四个容器，负责：

> 把 PUF 芯片的 C 语言驱动 API（SD_TransferPacket 等底层调用），封装为 HTTP API，供 authd 通过内部网络调用。authd 不需要知道芯片型号、SD 总线协议、数据包分片细节。

```
authd（Go 服务）               puf-agent（新容器）
    │                              │
    │  POST /puf/sign              │  CCM3302_CLASign()
    │  POST /puf/verify            │  CCM3302_CLAVerify()
    │  GET  /puf/uid               │  CCM3302_GetRegUID()
    │  POST /puf/challenge         │  CCM3302_GetCRP()
    │  POST /puf/random            │  CCM3302_GetRandom()
    │  POST /puf/hash              │  CCM3302_CLASM3Hash()
    │                              │
    └──────── nas-internal ────────┘
             不暴露到宿主机外
```

### 9.2.2 对外接口定义

以下接口仅为 authd 调用，不对外网开放。

| 方法 | 路径 | 入参 | 出参 | 内部调用 |
|------|------|------|------|---------|
| GET | `/puf/uid` | 无 | `{"uid":"abcd1234..."}` | GetRegUID |
| POST | `/puf/random` | `{"len":32}` | `{"random":"base64..."}` | GetRandom |
| POST | `/puf/sign` | `{"data":"base64..."}` | `{"signature":"base64..."}` | CLASign |
| POST | `/puf/verify` | `{"hash":"base64...","signature":"base64..."}` | `{"valid":true}` | CLAVerify |
| POST | `/puf/hash` | `{"data":"base64..."}` | `{"hash":"base64..."}` | CLASM3Hash |
| POST | `/puf/challenge` | `{"challenge":"base64..."}` | `{"response":"base64..."}` | GetCRP |
| GET | `/puf/health` | 无 | `{"status":"ok"}` | CCM3302_Test（健康检查） |

### 9.2.3 puf-agent 内部逻辑

以 `/puf/sign` 为例，展示 puf-agent 如何封装底层驱动：

```
POST /puf/sign 收到请求:
  1. 解析 JSON → 提取待签名数据 (base64 → 原始字节)
  2. 调用 CCM3302_CLASign(data, len, output_buf)
     ├── CLASign 内部先调 SD_TransferPacket(CMD_SDPUF_CLASign, data, len)
     ├── SD_TransferPacket 内部调 CCM3302_CreatPacket 封包
     ├── 通过 sd_write_disk 写入 SD 总线
     ├── 通过 sd_read_disk 读取响应
     └── SD_ProcessResponse 解包校验
  3. 签名结果 base64 编码 → 返回 JSON 响应
```

**authd 只看到第 1 步发请求和第 3 步收响应，第 2 步全部黑盒在 puf-agent 内部。**

---

## 9.3 PUF 与认证流程集成

### 9.3.1 总体思路

PUF 芯片解决的不是"用户是谁"（那是 LDAP 密码验证的事），而是解决两类问题：

**问题一：NAS 设备身份证明** — "用户连接的这台 NAS 是不是原装正品？还是有人把硬盘拔走装到另一台机器上冒充的？"

**问题二：文件存证** — "这份文件确实是在特定时间存到过这台特定 NAS 的，不可抵赖。"

### 9.3.2 三种认证模式

| 模式 | 验证内容 | 适用场景 | 安全等级 |
|------|---------|---------|:--------:|
| **标准模式** | 用户名 + 密码 → LDAP Bind | 日常文件浏览 | ★★★ |
| **增强模式** | 标准模式 + PUF 设备证明 | 敏感文件访问、管理操作 | ★★★★ |
| **存证模式** | 标准模式 + PUF 签名 + 时间戳 | 司法存证、合同归档 | ★★★★★ |

---

### 9.3.3 标准模式（现有流程，不涉及 PUF）

```
手机 APP                         authd                        LDAP
   │                               │                            │
   │── POST /login ───────────────→│                            │
   │   {username, password}        │── LDAP Bind ──────────────→│
   │                               │← 验证通过 ─────────────────│
   │                               │                            │
   │← JWT token ──────────────────│                            │
   │   {sub, iat, exp}             │                            │
```

标准模式不调用 PUF，完全兼容现有流程。

---

### 9.3.4 增强模式（PUF 设备证明）

用户登录时，除了验证密码，还让 NAS "自证身份"。

```
手机 APP                  authd                    puf-agent          LDAP
   │                        │                          │                 │
   │── POST /login ────────→│                          │                 │
   │   {username, password,  │                          │                 │
   │    require_device_proof:│                          │                 │
   │    true}                │                          │                 │
   │                        │── LDAP Bind ──────────────────────────────→│
   │                        │← 验证通过 ─────────────────────────────────│
   │                        │                          │                 │
   │                        │── 生成随机 challenge ─────→│                 │
   │                        │← 芯片签名(challenge) ────│                 │
   │                        │                          │                 │
   │                        │── 验签(challenge, 签名) ──→│                 │
   │                        │← valid: true ───────────│                 │
   │                        │                          │                 │
   │← JWT token ───────────│                          │                 │
   │   {sub, iat, exp,      │                          │                 │
   │    device_proof: true} │                          │                 │
```

**流程解析**：

1. 用户正常输密码 → LDAP Bind 验证（和标准模式一样）
2. 密码通过后，authd 生成一串随机数（challenge），丢给 puf-agent
3. puf-agent 调 PUF 芯片的 CLASign 对这串随机数签名
4. authd 再把 (challenge, 签名) 交给 puf-agent 验签
5. 验签通过 → 证明 authd 正跑在原装 NAS 上（因为只有这颗 PUF 芯片能签出对应的名）→ 在 JWT 中标记 `device_proof: true`

> ⚠️ **【待讨论-问题1】主文档 JWT 结构缺少 `device_proof` 字段**
>
> 主文档 3.2 节 / Table 20 定义的 JWT Payload 只有 `{sub, iat, exp}` 三个字段。
> 增强模式新增了 `device_proof: true`，需要在主文档中补充说明。
>
> **建议方案**：在主文档 Table 20 下方加一行：
> `增强模式下 JWT 增加可选字段 device_proof: true，表示本次登录通过了 PUF 设备证明，详见第九章。`

> ⚠️ **【待讨论-问题2】主文档 `/login` 接口缺少 `require_device_proof` 参数说明**
>
> 主文档 Table 22 定义的 POST /login 只有"LDAP Bind 验证，返回 JWT"。
> 增强模式需客户端传入 `require_device_proof: true` 触发 PUF 设备证明。
>
> **建议方案**：在主文档 Table 22 的 `/login` 说明改为：
> `LDAP Bind 验证，返回 JWT。可选参数 require_device_proof: true 触发 PUF 设备证明，成功后签发含 device_proof 标记的 JWT。`

**安全性**：

- 如果攻击者把 LDAP 数据拷走、NAS 硬盘拔走装到另一台机器上——那台机器没有 PUF 芯片，第 3 步和第 5 步会失败
- 增强模式的 JWT 里多了 `device_proof: true`，敏感操作（如修改权限、删除用户）可以要求这个标记必须为 true
- challenge 每次都不同（真随机数生成），防重放攻击

> ⚠️ **【待讨论-问题6】增强模式流程可简化——"自签自验"可改为本地验签**
>
> 当前流程是：authd 调 puf-agent 签名 → authd 再调 puf-agent 验签。签名和验签都在同一颗芯片上完成，流程看起来像"自签自验"。实际上 SM2 验签算法是公开的，不需要芯片参与。
>
> **建议方案**：
> ```
> 优化后流程：
>   authd 生成 challenge → puf-agent SM2 签名
>   → authd 用本地存储的芯片公钥验签（不调 puf-agent）
>   → 通过 → JWT 加 device_proof
> ```
> MVP 阶段可保持当前流程（简单可靠，减少 authd 实现 SM2 验签的复杂度）。阶段2 改为本地验签，省去一次容器间 RPC 调用。

---

### 9.3.5 存证模式（文件 PUF 签名 + 时间戳）

用户上传文件时，NAS 对文件做 PUF 签名存证。

```
手机 APP                  authd                    puf-agent
   │                        │                          │
   │── POST /upload ───────→│                          │
   │   {file,               │                          │
   │    require_cert: true} │                          │
   │                        │── 文件落盘                 │
   │                        │                          │
   │                        │── SM3 哈希(文件内容) ──────→│
   │                        │← 32 字节哈希 ────────────│
   │                        │                          │
   │                        │── 签名(哈希 + 时间戳) ────→│
   │                        │← 222 字节签名 ───────────│
   │                        │                          │
   │                        │── 生成存证收据:            │
   │                        │   {file_hash, timestamp,  │
   │                        │    device_uid, signature} │
   │                        │                          │
   │← 上传成功 + 收据 ──────│                          │
   │   {url, receipt}       │                          │
```

**存证收据包含**：

```
{
  "file_hash": "SM3 哈希值（32 字节，hex 编码）",
  "timestamp": "2026-05-10T15:30:00Z",
  "device_uid": "PUF 芯片唯一 ID",
  "signature": "PUF 芯片 SM2 签名（222 字节，base64）"
}
```

**验证存证**（任何第三方可独立验证）：

```
1. 拿到收据中的 file_hash → 和文件重新算的 SM3 哈希比对
2. 拿到收据中的 signature → 用 PUF 芯片公钥验签
3. 两个都对 → 证明：这份文件确实在 timestamp 时刻存到过这台 NAS
```

**司法存证场景**：

- 合同/证据文件上传后生成收据
- 收据可提交至区块链或公证机构，作为"某文件在某时存在于某设备"的密码学证明
- 即使 NAS 后来被销毁，只要收据（签名 + 哈希）还在，就可验证文件未被篡改

---

## 9.4 NAS SDK 设计

### 9.4.1 SDK 定位

NAS SDK 封装 authd REST API，向第三方应用提供统一的文件存储与存证接口。SDK 运行在客户端（手机/服务器），通过 HTTPS 与 NAS 通信。

**关键**：SDK 不直接调 puf-agent，也不直接接触 PUF 芯片。所有 PUF 相关能力通过 authd 的 API 间接获得。

> ⚠️ **【待讨论-问题3】主文档原 SDK 接口表（Table 32）残留 PUFClient，概念有误，需替换**
>
> 主文档 Table 32 原包含 `PUFClient.BindDevice(token)` 和 `PUFClient.GetDeviceCert()`。
> 这两个接口暗示"客户端需要绑定 PUF 设备"——这是错的。PUF 芯片焊接在 NAS 主板上，客户端无法也无需绑定。
>
> **建议方案**：用本章 9.4.2 的接口表替换主文档 Table 32，核心变更：
> - 删除 `PUFClient` 全部接口
> - 新增 `DeviceClient.GetDeviceInfo()` — 客户端获取 NAS 设备信息（含 PUF UID）
> - 新增 `AuthClient.LoginWithDeviceProof(username, password)` — 增强模式登录

### 9.4.2 SDK 核心接口

| 模块 | 接口 | 说明 |
|------|------|------|
| **AuthClient** | `Login(username, password)` | 标准登录，返回 JWT |
| **AuthClient** | `LoginWithDeviceProof(username, password)` | 增强登录，返回带 `device_proof` 的 JWT |
| **AuthClient** | `ValidateToken(token)` | 验证 JWT 有效性 |
| **FileClient** | `Upload(path, data, token)` | 上传文件 |
| **FileClient** | `Download(path, token)` | 下载文件 |
| **FileClient** | `SetPermission(path, user, perm, token)` | 设置 ACL 权限 |
| **CertClient** | `UploadWithProof(path, data, token)` | 上传并生成存证收据 |
| **CertClient** | `VerifyProof(receipt, file)` | 独立验证存证有效性（可离线） |
| **DeviceClient** | `GetDeviceInfo()` | 获取 NAS 设备信息（含 PUF UID） |

### 9.4.3 Go SDK 示例

```go
client := nassdk.New(nassdk.Config{
    Endpoint: "https://nas.example.com",
    // 注意：无需配置 PUFEnabled。
    // PUF 是 NAS 服务端能力，由 nas 容器的 PUF_ENABLED 环境变量控制。
    // 客户端 SDK 只需选择调用 Login() 还是 LoginWithDeviceProof()。
})

// 标准登录（不需要 PUF 设备证明）
token, _ := client.Auth.Login("alice", "password123")

// 增强登录（要求 PUF 设备证明）
tokenWithProof, _ := client.Auth.LoginWithDeviceProof("alice", "password123")
// tokenWithProof.DeviceProof == true → 敏感操作可用此 token

// 存证上传
receipt, _ := client.Cert.UploadWithProof(
    "/contracts/agreement.pdf", fileData, tokenWithProof)
// receipt.Signature: PUF 芯片 SM2 签名
// receipt.DeviceUID: 芯片唯一 ID
// receipt 可提交至区块链或公证机构

// 离线验证存证（不依赖 NAS 在线）
valid, _ := client.Cert.VerifyProof(receipt, originalFile)
// valid == true → 文件未被篡改，签名来自原装 NAS
```

> ⚠️ **【待讨论-问题7】SDK 示例中去掉了原文档的 `PUFEnabled: true` 配置项**
>
> 原文档 SDK 示例中有 `PUFEnabled: true`。去掉是合理的——PUF 芯片在 NAS 里，客户端无法"启用"它。但需要在文档中显式说明原因，避免读者误以为遗漏。
>
> **建议方案**：SDK 构造函数中已加注释说明（见上方）。同时确保主文档 Table 33（Go SDK 示例）同步更新。

---

## 9.5 部署架构更新

### 9.5.1 容器编排（四容器）

在原有三容器基础上，新增 puf-agent 容器：

```
services:
  openldap:          # 身份数据源（不变）
  ldap-init:         # 一次性初始化（不变）
  nas:               # authd + Samba + NFS（增加 PUF 相关环境变量）
  puf-agent:         # 【新增】PUF 硬件驱动封装服务
```

### 9.5.2 docker-compose 扩展配置

```yaml
services:
  puf-agent:
    image: puf-agent:latest
    devices:
      - /dev/puf0:/dev/puf0          # PUF 芯片设备映射
    environment:
      - PUF_DEVICE=/dev/puf0
      - LISTEN_ADDR=:9090
    networks:
      - nas-internal                  # 仅内部网络，不暴露宿主机端口
    restart: unless-stopped
    # 注意：无 ports 映射！puf-agent 不对外暴露

  nas:
    image: nas:latest
    ports:
      - "8080:8080"                  # authd HTTP API（对外）
      - "445:445"                    # SMB（对外）
      - "2049:2049"                  # NFS（对外）
    environment:
      - PUF_AGENT_URL=http://puf-agent:9090    # 【新增】authd 通过内部网络调 puf-agent
      - PUF_ENABLED=true                       # 【新增】启用 PUF 功能
      - LDAP_URL=ldap://openldap:389
      # ... 原有环境变量
    networks:
      - nas-internal
    depends_on:
      - openldap
      - puf-agent                    # 【新增】依赖 puf-agent 先启动
    privileged: true
    restart: unless-stopped

  openldap:
    # ... 保持不变
  ldap-init:
    # ... 保持不变

networks:
  nas-internal:
    driver: bridge
```

### 9.5.3 网络隔离说明

```
宿主机端口映射：

  外部网络（客户端可访问）
  ├── :8080 → nas:8080    (authd HTTP API)
  ├── :445  → nas:445     (SMB)
  └── :2049 → nas:2049    (NFS)

  nas-internal 网络（仅容器间通信，不映射到宿主机）
  ├── puf-agent:9090      (只有 nas 容器访问)
  ├── openldap:389         (nas 容器访问)
  └── nas                  (authd 访问 puf-agent 和 LDAP)
```

客户端永远无法直接访问 puf-agent，即使攻破了外网也无法触及 PUF 芯片。

---

## 9.6 产品方案总结

### 9.6.1 产品能力矩阵

| 能力层 | 组件 | 对外能力 |
|--------|------|---------|
| **硬件层** | PUF 芯片（CCM3302） | 设备唯一身份、硬件密钥派生、不可克隆 |
| **系统层** | OpenLDAP + POSIX ACL | 用户目录、文件权限、统一身份源 |
| **服务层** | authd + WebDAV + Samba + NFS | REST API、多协议文件访问 |
| **存证层** | puf-agent + authd | 文件 PUF 签名存证、收据生成与验证 |
| **SDK 层** | NAS SDK（Go/Python/JS） | 第三方应用集成接口 |

### 9.6.2 核心优势

- **单一身份源**：OpenLDAP 是唯一用户数据库，消除多源同步
- **硬件防伪**：PUF 芯片绑定 NAS 物理身份，硬盘被拔走无法在新机器上重建
- **不可抵赖存证**：文件上传即生成 PUF 签名收据，事后再验证，不可伪造
- **多层安全**：标准 / 增强 / 存证三种模式，按需升级安全等级
- **SDK 开放**：第三方应用通过 SDK 接入，无需理解 PUF 或 LDAP 细节
- **轻量部署**：四容器 docker-compose 一键启动

### 9.6.3 产品层次总览

| 层次 | 核心组件 | 面向谁 |
|------|---------|--------|
| **硬件层** | PUF 芯片 + 驱动 | NAS 硬件厂商 |
| **系统层** | OpenLDAP + POSIX ACL | 系统运维 |
| **服务层** | authd + WebDAV + Samba + NFS | 终端用户 |
| **存证层** | puf-agent + authd 存证接口 | 企业合规 / 司法场景 |
| **SDK 层** | NAS SDK | 第三方开发者 |
| **云端层**（可选） | PKI / 区块链 | 跨设备验证、公证存证 |

---

## 9.7 PUF 能力调用关系总览

```
客户端（手机 APP / 电脑 / Pad）
   │
   │  HTTPS（唯一通道）
   ▼
authd（NAS 服务端）
   │
   ├── LDAP Bind ──────────→ OpenLDAP（用户身份验证）
   │
   ├── 标准模式：密码通过 → 签发 JWT
   │
   ├── 增强模式：密码通过 + 调 puf-agent 签名/验签 → 签发 device_proof JWT
   │
   └── 存证模式：文件落盘 + 调 puf-agent SM3 哈希 + SM2 签名 → 生成收据
        │
        │  nas-internal 网络（内部）
        ▼
   puf-agent ── SD 总线 ──→ PUF 芯片
```

**一句话**：PUF 芯片安静地躺在 NAS 主板上，不直接和外界说话。所有 PUF 能力通过 authd 间接提供给客户端，客户端永远不知道也无需知道芯片的存在。

---

## 附录：待讨论问题汇总

> 以下 7 个问题已在正文对应位置标注。此处汇总方便团队讨论后统一修改。
> 每个问题标注了优先级：**P0** = 必须修改（影响主文档耦合）、**P1** = 应补充（描述缺失）、**P2** = 建议优化（非阻塞）。

| # | 优先级 | 问题 | 所在章节 | 需修改的文件 | 简述 |
|---|:------:|------|---------|-------------|------|
| **1** | **P0** | 主文档 JWT 结构缺少 `device_proof` 字段 | 9.3.4 | 主文档 3.2/Table 20 | 增强模式新增了 device_proof 标记，主文档 JWT 定义需补充 |
| **2** | **P0** | 主文档 `/login` 接口缺少 `require_device_proof` 参数 | 9.3.4 | 主文档 Table 22 | 增强模式需要客户端传入此参数 |
| **3** | **P0** | 主文档 SDK 接口表残留 `PUFClient` | 9.4.1 | 主文档 Table 32 | 原 `PUFClient.BindDevice` 和 `GetDeviceCert` 概念有误，需替换为本章 9.4.2 的接口表 |
| **4** | **P1** | PUF 密钥派生流程缺失 | 9.1.3 | 本章 | 原文档有标题无内容，本章补了初始版本，需团队确认 HKDF 派生方式 |
| **5** | **P1** | PID/Envelope 出厂烧录未提及 | 9.1.2 | 本章 | 芯片私钥来源需说明——出厂时由生产工具调用，正常运行时 authd 不调 |
| **6** | **P2** | 增强模式"自签自验"可优化为本地验签 | 9.3.4 | 本章 | MVP 可保持现状（简单可靠），阶段2 改为 authd 本地 SM2 验签，省一次 RPC |
| **7** | **P2** | SDK 示例去掉 `PUFEnabled` 需显式说明 | 9.4.3 | 主文档 Table 33 | 去掉是对的，但需在注释中说明原因，并同步主文档 SDK 示例 |

### 修复指南

**P0（3 个）— 改主文档：**

1. **JWT 结构**：在主文档 Table 20 JSON 下方加 `增强模式可选字段：device_proof: true（详见第九章）`
2. **/login 接口**：主文档 Table 22 `/login` 行改为 `LDAP Bind 验证，返回 JWT。可选 require_device_proof: true`
3. **SDK 接口表**：用本章 9.4.2 接口表替换主文档 Table 32。删除 `PUFClient` 模块，新增 `DeviceClient` 和 `AuthClient.LoginWithDeviceProof`

**P1（2 个）— 改本章：**

4. **密钥派生**：9.1.3 节已给出初始内容（HKDF-HMAC-SM3 派生方案），团队讨论后确认或调整
5. **PID 烧录**：9.1.2 能力表已补充一行。如需更详细描述，可在 9.1.3 补一句出厂流程说明

**P2（2 个）— 改本章（阶段2）：**

6. **验签优化**：9.3.4 已标注。阶段2 在 authd 内实现 SM2 本地验签，改 puf-agent 调用为本地计算
7. **PUFEnabled 注释**：9.4.3 SDK 示例已加注释。同步更新主文档 Table 33

---

文档结束。

## 相关文章
- [[NAS项目概述]] — 本项目全貌与本方案的定位
- [[NAS_Agent设计文档]] — NAS Agent 的审计日志可关联 PUF 存证
- [[../nas-core/docs/01-auth-and-permission-design]] — PUF 增强认证依赖的 NAS 认证体系
- [[../nas-core/docs/03-permission-acl-analysis]] — 安全设计与权限系统的关系
