# mDNS 局域网发现 — APP 对接方案

## 概述

NAS 启动后通过 mDNS（Multicast DNS）在局域网内广播自己的存在。APP 监听发现 NAS，用户点击确认连接即可进入登录流程。

## 1. mDNS 发现

### NAS 广播内容

```
服务类型: _nas._tcp
服务名:   NAS-<device_id>  (例: NAS-b827eb3a1c2d)
端口:     8080
TXT 记录: host=<hostname>, version=1.0
```

### APP 侧 Android 实现

用系统 `NsdManager` 发现，封装为 JSB module：

```kotlin
// MdnsModule.kt — JSB 供 RN 调用
// 搜索 _nas._tcp 服务，返回发现的设备列表

val discoveryListener = object : NsdManager.DiscoveryListener {
    override fun onServiceFound(service: NsdServiceInfo) {
        if (service.serviceType == "_nas._tcp") {
            nsdManager.resolveService(service, resolveListener)
        }
    }
    // ... 超时后 resolve 完所有结果，返回给 RN
}
```

```ts
// RN 侧调用
import { NativeModules } from 'react-native';

const devices: DiscoveredDevice[] = await MdnsModule.discover();

// DiscoveredDevice 结构:
// { name: "NAS-b827eb3a1c2d", ip: "192.168.1.100", port: 8080 }
```

### 超时策略

- mDNS 发现超时 **3 秒**，超时后返回已发现的结果
- 没发现任何设备 → 提示用户"未发现 NAS，请确认连接同一网络"

## 2. 确认连接

用户点击某个 NAS 后，APP 应该调用 `/device-info` 校验：

```
GET http://{ip}:8080/device-info

Response 200:
{
  "device_id": "NAS-b827eb3a1c2d",
  "hostname":  "nas",
  "version":   "1.0"
}
```

这个接口**不需要 JWT**，公开访问。校验通过后存下 `baseUrl = "http://{ip}:8080"`，后续所有 API 请求都以它为前缀。

## 3. 完整流程

```
用户打开 APP
    │
    ├── 1. 自动扫描局域网
    │      MdnsModule.discover() → _nas._tcp → timeout 3s
    │
    ├── 2. 显示结果列表
    │      设备名 | IP | 确认按钮
    │
    │      ┌──────────────────────────────┐
    │      │ 🔍 发现 2 台 NAS              │
    │      │                              │
    │      │ NAS-b827eb3a1c2d             │
    │      │ 192.168.1.100:8080    [连接] │
    │      │                              │
    │      │ NAS-9a1f2c3d4e5f             │
    │      │ 192.168.1.101:8080    [连接] │
    │      └──────────────────────────────┘
    │
    ├── 3. 用户点击 [连接]
    │      GET /device-info → 确认设备在线
    │      存 baseUrl = "http://192.168.1.100:8080"
    │
    ├── 4. 跳转登录页面
    │      POST /login → JWT → 进主页
    │
    └── 后续
           所有文件操作、权限等 API 都走 baseUrl
```

## 4. NAS 选择页 UI 建议

- **下拉刷新**：手动触发重新发现
- **无网络提示**：未发现 NAS 时显示引导（连接同一 WiFi）
- **缓存历史**：上次连接过的 NAS 优先显示（AsyncStorage 存 IP）
- **ping 确认**：点击时先调 `/ping`，不可达给提示

## 5. 后续：WiFi P2P 回退

当前 mDNS 只覆盖同一 WiFi 下的场景。后续网络策略是：

```
mDNS 发现 (3s) → 成功 → 连接
             ↓ 失败
缓存 IP ping → 可达 → 连接
             ↓ 不可达
WiFi P2P 直连 → WifiP2pModule.connect()
```

目前先只做 mDNS 这层。P2P 回退等 NAS 端 WiFi 模块验证通过后再接。

## 6. 实现状态（2026-05-21）

| 状态 | 任务 | 文件 |
|------|------|------|
| ✅ 已实现 | mDNS JSB 原生模块（NsdManager + resolveService） | `MdnsModule.kt` + `MdnsPackage.kt` |
| ✅ 已实现 | TS 封装 + device-info 校验 | `src/native/MdnsModule.ts` + `src/api/device.ts` |
| ✅ 已实现 | Discovery 页面（mDNS 扫描 + /device-info 校验 + 空状态/错误态） | `src/screens/DiscoveryScreen.tsx` |
| ✅ 已实现 | 网络连接策略入口 | `src/network/connector.ts` |
| ✅ 已实现 | MainApplication 注册 | `MainApplication.kt` |
| ✅ 已修复 | mDNS resolve 回调不触发 | 见下方 §7 |
| 📋 待开发 | APP 对接文件操作真实接口（替换 mock） | `src/api/files.ts` |

## 7. 已解决：serviceType 末尾 `.` 导致 resolve 不触发

**根因**：Android `NsdManager` 返回的 `serviceType` 是 DNS FQDN 格式，末尾带 `.`（如 `_nas._tcp.`）。代码中 `SERVICE_TYPE = "_nas._tcp"`（无 `.`），`if (service.serviceType != SERVICE_TYPE) return` 匹配失败，`onServiceFound` 直接 return，`resolveService` 从未被调用，5s 超时后返回空结果。

**修复**（`MdnsModule.kt:81`）：
```kotlin
if (service.serviceType.removeSuffix(".") != SERVICE_TYPE) return
```

## 相关文章
- [[../../wiki/WiFi_P2P_NFC_APP_开发方案]] — mDNS 在连接策略中的位置
- [[../../wiki/APP开发记录与踩坑指南_opencode-agent]] — mDNS 开发踩坑记录
- [[setup]] — 开发环境网络配置
