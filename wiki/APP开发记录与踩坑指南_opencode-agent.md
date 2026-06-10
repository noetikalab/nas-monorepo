> 时效：fresh / 上次验证：2026-06-04
> 标签：app, p2p, 文件管理, nfc, 坑点, 记录
> 源材料：[飞书方案]、NasApp/
> 创建：2026-06-02 / 更新：2026-06-04

# APP 端开发记录与踩坑指南

> **执行者**：opencode-agent（APP 端）  
> 创建日期：2026-06-02  
> 覆盖范围：WiFi P2P 原生模块、连接策略、文件管理  
> 当前状态：WiFi P2P 代码就绪（等硬件联调），文件管理功能完整，mDNS 局域网联调可用

---

## 一、关键约束

### 1.1 技术栈

| 层 | 技术 | 约束 |
|----|------|------|
| 框架 | React Native 0.85.3 + TypeScript | 路径别名 `@/` → `tsconfig.json` paths + `babel-plugin-module-resolver` |
| Android 原生 | Kotlin（`WifiP2pModule.kt`、`MdnsModule.kt`） | ReactPackage 手动注册于 `MainApplication.kt` |
| HTTP | fetch（全栈统一） | `src/api/client.ts` 共享 `request<T>()`，统一 `/api/` 前缀、JWT 注入、401 处理 |
| 状态 | React `useState` + `useRef` | Zustand 目录已创建但未启用，当前复杂度不需要全局状态 |
| 持久化 | `@react-native-async-storage/async-storage` v2 | **必须 v2**，v3 依赖的 `org.asyncstorage.shared_storage:storage-android` Maven 包国内镜像不可用 |
| 设计 | Precision 设计系统 | 黑白灰全线，无彩色强调、无 emoji、无渐变。色值全部从 `src/theme/tokens.ts` 引用 |

### 1.2 权限清单

```
AndroidManifest.xml 完整权限：
  INTERNET                         — HTTP 请求
  CHANGE_WIFI_MULTICAST_STATE      — mDNS 多播
  ACCESS_WIFI_STATE                — WiFi 状态检测
  CHANGE_WIFI_STATE                — WiFi P2P manage.initialize() 需要
  CHANGE_NETWORK_STATE             — P2P 连接管理
  ACCESS_NETWORK_STATE             — 网络状态
  NEARBY_WIFI_DEVICES              — Android 13+ P2P 发现，usesPermissionFlags="neverForLocation"
  ACCESS_FINE_LOCATION             — Android 6-12 P2P 发现，maxSdkVersion="32"
```

**Android 13+ 关键约束**：`NEARBY_WIFI_DEVICES` 是运行时危险权限，必须在系统设置中手动授权。未授权时 `discoverPeers()` 返回 `onFailure(reason=0)` 不抛异常，表现为持续 BUSY 无日志。

### 1.3 登录态

- token 存 AsyncStorage，`authApi.validateToken()` 验证有效性
- APP 启动：`LoginScreen.useFocusEffect` → 读 token → `GET /api/validate-token` → 有效则 `navigation.replace('Home')` 直跳主页
- 手动退出 / 401：`storage.clearAuth()` 清 token → `navigation.replace('Login')`
- 未连接场景：token 存在但 NAS 不可达时不强行跳转，用户先连 NAS 再自动登录

### 1.4 返回键

`HomeScreen` 用 `BackHandler.addEventListener('hardwareBackPress')` 拦截 Android 返回键：

- 子目录中：回退上级目录（`prevPaths` 栈 pop）
- 根目录：Alert 确认"确定退出吗？"

### 1.5 API 路径规范

- 所有接口统一 `/api/` 前缀，由 `src/api/client.ts` 统一拼接
- `filesApi.list()` 空目录时不传 `?path=` 参数（让后端自动映射到用户根目录）
- `device.ts` 直接用 fetch（公开接口，无需 JWT），不经过 `client.ts`

### 1.6 P2P 设备名规范

- NAS 端：`wpa_supplicant.conf` 设 `device_name=NAS-<device_id>`
- APP 端：按 `deviceName.lowercase().contains("nas")` 过滤识别
- P2P 开发机限制：Ubuntu Desktop + NetworkManager 接管 WiFi 后无法创建 P2P GO，需 Ubuntu Server

---

## 二、WiFi P2P 踩坑记录

### 2.1 `initialize()` 缺权限异常先于任何 Log

**现象**：点击连接后 APP 显示失败，`adb logcat -s WifiP2pModule` 完全无输出，P2P 模块仿佛不存在。JS 层 `console.warn` 抓到 `SecurityException: WifiP2pService: Neither user 10423 nor current process has android.permission.CHANGE_WIFI_STATE`。

**根因**：`WifiP2pManager.initialize()` 需要 `CHANGE_WIFI_STATE` 权限。异常发生时机在 `connect()` 方法任何 `Log.e/i` 语句之前，Kotlin 日志完全看不到。

**方案**：AndroidManifest 声明 `CHANGE_WIFI_STATE`；`initialize()` 包 try-catch 输出中文日志。

```kotlin
try {
    channel = mgr.initialize(reactApplicationContext, Looper.getMainLooper(), null)
} catch (e: SecurityException) {
    Log.e(TAG, "P2P initialize 失败，缺少 CHANGE_WIFI_STATE 权限: ${e.message}")
    resolveError("P2P_ERR", "缺少 CHANGE_WIFI_STATE 权限")
    return
}
```

---

### 2.2 `NEARBY_WIFI_DEVICES` 未授权 → `discoverPeers` 持续 BUSY 无日志

**现象**：权限声明好了，但 `discoverPeers` 始终返回 `onFailure(reason=0)`。日志显示 "发起 P2P 发现失败 (code=0)"，没有任何 SecurityException。

**根因**：Android 13+ 上 `NEARBY_WIFI_DEVICES` 是运行时危险权限（非 Manifest 声明即生效）。未授权时不抛 SecurityException，而是 `discoverPeers()` 返回 `reason=0`（BUSY），无法从 API 层面区分"没权限"和"框架忙"。最初的 `hasLocationPermission()` 在 API 33+ 直接 `return true`，完全没检查此权限。

**方案**：

```kotlin
private fun hasLocationPermission(): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        return reactApplicationContext.checkSelfPermission(
            android.Manifest.permission.NEARBY_WIFI_DEVICES
        ) == PackageManager.PERMISSION_GRANTED
    }
    // ... ACCESS_FINE_LOCATION for API < 33
}
```

***调试技巧**：`adb shell dumpsys package com.nasapp | grep NEARBY` 可查看权限是否 granted。*

---

### 2.3 `stopPeerDiscovery` 误触发"发现超时"

**现象**：`discoverPeers` 成功返回，但 APP 立即显示"发现超时，未找到 NAS 设备"。日志显示 `stopPeerDiscovery 完成` → `DISCOVERY_STOPPED` 广播 → `resolveError` 调用。

**根因**：`startDiscovery()` 前调用 `stopPeerDiscovery()` 清理 BUSY 状态（好意图），但它产生的 `DISCOVERY_STOPPED` 广播被我们自己的 Receiver 收到，误判为 discoverPeers 超时。`resolveError` 调用后 `cleanup()` 注销了所有 Receiver，真正的 discoverPeers 成功时接收器已不存在。时序：

```
T+0ms   stopPeerDiscovery()
T+10ms  → DISCOVERY_STOPPED 广播 → Receiver 误判 → resolveError + cleanup()
T+50ms  discoverPeers 成功回调 → 但 Receiver 已注销，设备变化永远收不到
```

**方案**：增加 `ourDiscoveryStarted` 标志，只有收到 `DISCOVERY_STARTED` 后才处理 `DISCOVERY_STOPPED`。`stopPeerDiscovery` 不会产生 `DISCOVERY_STARTED`，其 `DISCOVERY_STOPPED` 被自动忽略。

---

### 2.4 `PEERS_CHANGED` 回调重复触发多次连接

**现象**：`requestPeers` 回调被触发 3 次，每次都遍历设备列表并调用 `connectToDevice`，日志中出现 3 条 "发起连接请求 → DIRECT-xx"。

**根因**：Android 一次设备列表变化可能触发多次 `PEERS_CHANGED` 广播，导致 `requestPeers` 回调重复执行。

**方案**：`connectionAttempted` 标志，第一次执行后直接 `return`。

---

### 2.5 P2P 扫到非 NAS 设备（打印机/DIRECT-xx）

**现象**：办公室环境扫到 3 台 HP Laser 打印机。

**根因**：`discoverPeers` 返回范围内所有 Wi-Fi Direct 设备，不加过滤直接取第一个 `AVAILABLE` 设备连接。

**方案**：`deviceName.lowercase().contains("nas")` 过滤，NAS 侧 `wpa_supplicant.conf` 设 `device_name=NAS-<device_id>` 配合匹配。

---

## 三、连接策略踩坑记录

### 3.1 USB 网络共享下 mDNS 通但 HTTP 不通

**现象**：手机通过 USB 共享电脑网络时，mDNS 能发现 NAS（UDP 多播可达），APP 显示"已连接"，但 `/api/ping` 超时、登录失败。NAS 后端根本没收到请求。

**根因**：UDP 多播可跨越 USB 线缆（电脑 WiFi 网卡发出多播 → USB → 手机），但 TCP 需要双向路由——手机路由表中没有 `10.20.x.x` 网段的出口，HTTP 请求发出即丢弃。

**方案**：手机直接连 WiFi 与 NAS 同局域网。`connector.ts` 中 mDNS 发现设备后做可达性验证（6s + 重试），不可达则不标"connected"。

---

### 3.2 mDNS 验证 ping 超时过短 → 误跌到 P2P

**现象**：mDNS 发现设备，3s ping 超时失败，继续跌到缓存层（旧地址）→ 缓存也失败 → 跌倒 P2P → WiFi 没开报错。明明设备在网络里，却走到了最不该到的 P2P。

**根因**：3s 对 USB 共享网络等场景不够；失败后不保存 mDNS URL，缓存层仍用旧默认地址。

**方案**：
1. mDNS 发现设备后**立即保存 URL**（防缓存层用旧地址）
2. ping 超时 3s → 6s，失败后重试一次
3. 缓存层超时 2s → 4s
4. 三层失败后透传原始错误给 LoginScreen → Alert 展示

---

## 四、文件管理踩坑记录

### 4.1 `GET /api/files?path=%2F` 返回 403

**现象**：登录成功，进入 HomeScreen 后数据加载失败，后端日志 `GET /api/files?path=%2F → 403`。

**根因**：后端 user 角色的 `ValidatePath` 要求请求路径以 `/data/{username}/` 为前缀。`path=/` 不满足。后端只在 path 参数完全为空时走默认路径映射。

**方案**：`filesApi.list()` 不传 `?path=` 参数，由后端自动映射：

```ts
list: (dirPath?: string) =>
  request(`/files${dirPath ? `?path=${encodeURIComponent(dirPath)}` : ''}`),
```

---

### 4.2 `react-native-document-picker` 编译失败（5 个 Java 错误）

**现象**：`pnpm android` 报 5 个 Java 编译错误，全部指向 `GuardedResultAsyncTask` 符号不存在。

**根因**：`react-native-document-picker` 9.x 全系列依赖 RN bridge 的 `GuardedResultAsyncTask` 类，此类在 React Native 0.74+ 已移除。

**方案**：替换为官方替代包 `@react-native-documents/picker` 12.0.1。`pick()` 签名几乎兼容，改动一行 import：

```ts
// 之前
import {pick} from 'react-native-document-picker';
// 之后
import {pick} from '@react-native-documents/picker';
```

---

### 4.3 Android 返回键在子目录中退出 APP

**现象**：在子目录按 Android 返回键，APP 直接回到桌面。重开 APP 回到登录页。

**根因**：目录导航用的 `prevPaths` 是组件内部 state，React Navigation 不知道子目录的存在。按返回键时 React Navigation 把 HomeScreen 整个 pop 掉，栈空，APP 退出。

**方案**：`BackHandler.addEventListener` 拦截，子目录中 `goBack()` 并 `return true`，根目录时弹确认弹窗：

```ts
useEffect(() => {
  const handler = () => {
    if (prevPathsRef.current.length > 0) {
      goBackRef.current();
      return true;
    }
    Alert.alert('退出', '确定要退出应用吗？', [...]);
    return true;
  };
  const sub = BackHandler.addEventListener('hardwareBackPress', handler);
  return () => sub.remove();
}, []);
```

---

### 4.4 关掉重开 APP 需要重新登录

**现象**：退出 APP 后立即重开，仍是登录页，但之前明明已经登录过。

**根因**：`App.tsx` → `Navigation` → `initialRouteName="Login"`，APP 启动永远到 LoginScreen，没有检查是否已有有效 token。

**方案**：`LoginScreen.useFocusEffect()` 中先读 token → `authApi.validateToken()` → 有效则 `navigation.replace('Home')` 跳过登录页。401 时保留在登录页让用户重新登录。

---

## 五、架构速查

### 5.1 连接策略

```
connectToNas(onProgress?) → 三层降级

mDNS 发现 → 0台 → 缓存 IP ping (4s) → 失败 → WiFi P2P (3-10s) → 失败 → 弹窗
         → 1台 → 保存 URL + ping 验证 (6s+重试) → 成功返回
         → 多台 → 回调 multipleDevices → UI 跳 DiscoveryScreen
```

### 5.2 HTTP 调用链

```
HomeScreen / LoginScreen
  → filesApi / authApi / getDeviceInfo
    → client.ts request<T>()  [自动 JWT + /api/ 前缀 + 超时 + 401 清登录态]
      → fetch()
        → NAS authd :8080
```

### 5.3 文件变更全貌

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/api/client.ts` | 新增 | 共享 HTTP 客户端 |
| `src/api/files.ts` | 重写 | Mock → 真实 API（list/mkdir/move/remove/upload） |
| `src/api/auth.ts` | 重构 | 复用 client.ts，新增 validateToken |
| `src/api/device.ts` | 重构 | axios → fetch |
| `src/types/index.ts` | 重写 | 类型对齐后端 DTO |
| `src/native/WifiP2pModule.ts` | 新增 | P2P JSB 封装 |
| `src/native/MdnsModule.ts` | 已有 | mDNS JSB 封装 |
| `src/network/connector.ts` | 重写 | 三层降级 + onProgress 回调 |
| `src/screens/LoginScreen.tsx` | 重写 | Server bar 连接状态机 + 自动登录 |
| `src/screens/HomeScreen.tsx` | 重写 | 目录导航 + 文件操作 + 上传 + 返回键拦截 |
| `src/screens/NfcScanScreen.tsx` | 新增 | NFC 触发入口 |
| `src/screens/DiscoveryScreen.tsx` | 已有 | mDNS 设备选择（多设备时触发） |
| `src/screens/DevSettingsScreen.tsx` | 已有 | 手动输入服务器地址 |
| `src/navigation/index.tsx` | 修改 | 注册 NfcScan 路由 |
| `src/storage/local.ts` | 已有 | AsyncStorage 封装 |
| `src/theme/tokens.ts` | 已有 | Precision Design Tokens |
| `src/theme/shared.ts` | 已有 | 共用 StyleSheet |
| `android/.../WifiP2pModule.kt` | 新增 | P2P 原生模块（230 行） |
| `android/.../WifiP2pPackage.kt` | 新增 | ReactPackage 注册 |
| `android/.../MdnsModule.kt` | 已有 | mDNS 原生模块 |
| `android/.../MainApplication.kt` | 修改 | 注册 WifiP2pPackage |
| `android/.../AndroidManifest.xml` | 修改 | 新增 6 个权限 |
| `docs/file-management-plan.md` | 更新 | 标记实施完成 |
| `CLAUDE.md` | 更新 | P2P + 文件管理 + 坑点文档 |

## 相关文章
- [[WiFi_P2P_NFC_APP_开发方案]] — 同事的 NAS+APP 联合方案，本记录是其实施回溯
- [[AI-Coding方法论]] — 开发过程中总结的 AI 协作方法论
- [[NAS项目概述]] — 本项目全貌与本记录的出处
- [[NAS_Agent设计文档]] — NAS Agent 参考了本记录的 APP 端架构
- [[坑点汇总]] — 本记录中的坑点已提取到该文
- [[../nas-app/docs/file-management-plan]] — APP 文件管理原始方案
- [[../nas-app/docs/mdns-integration]] — mDNS 集成的踩坑与排查
