# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
## 项目背景
面向家庭用户的通用 NAS 私有云存储系统 Android 客户端。核心功能：账号密码登录注册、mDNS 局域网发现、WebDAV 文件上传下载、WiFi P2P 直连（无路由器场景）。后续规划 NFC 碰一碰。品牌名：NAS。
**必须用真机调试**，模拟器不支持 NFC 和 WiFi P2P。
相关文档：
- [NAS 整体方案（飞书）](https://my.feishu.cn/docx/EhQodDF20oHLMixoRaWcrejinIf)
- [手机 APP 连接 NAS 方案（飞书）](https://my.feishu.cn/docx/ECfhdOcRUoa4XHxqCiOckoS7nOb)
- 后端代码：`../ldap-demo/`
- 整体方案文档：`../app-claude.md`
- UI 设计规范：`DESIGN.md`
- 文件管理开发方案：`docs/file-management-plan.md`
## 常用命令
```bash
pnpm dev             # 启动 Metro（仅 JS 变更时用）
pnpm dev:a            # Android 原生编译 → 安装 APK → 启动 Metro（原生代码变更后一键）
pnpm dev:i            # iOS 编译 → 启动 Metro
pnpm android          # 仅编译并安装到 Android 真机（不启动 Metro）
pnpm start            # 仅启动 Metro bundler
pnpm lint             # ESLint 检查
pnpm test             # Jest 单元测试
pnpm test -- --testPathPattern=<file>  # 运行单个测试文件
```
## 架构
**技术栈：** React Native 0.85.3 + TypeScript + React 19
**路径别名：** `@/` 指向项目根目录（由 `tsconfig.json` paths + `babel-plugin-module-resolver` 支持）
**目录职责：**
| 路径 | 职责 |
|------|------|
| `src/screens/` | 页面：LoginScreen、HomeScreen、DevSettingsScreen（长按 ping 按钮进入）、NfcScanScreen（NFC 碰一碰触发入口） |
| `src/navigation/` | React Navigation 路由配置，当前 5 个 screen（Discovery/Login/Home/DevSettings/NfcScan） |
| `src/api/` | HTTP 请求层。`client.ts` 共享请求函数（自动 JWT 注入、multipart 兼容、401 清登录态、统一 `/api/` 前缀）。auth.ts（认证）、files.ts（文件操作，已对接真实 API）、device.ts（设备校验，纯 fetch） |
| `src/native/` | JSB 原生模块 JS 封装。MdnsModule.ts（mDNS 发现）、WifiP2pModule.ts（P2P 直连 connect/disconnect）、NfcModule.ts（NFC 读标签 readNdef/getPhoneId/writeNdef） |
| `src/network/` | 连接策略：mDNS 发现 → 缓存 IP ping → WiFi P2P 直连（三层降级） |
| `src/storage/` | AsyncStorage 封装：server_url、JWT token、username、phone_id（ANDROID_ID + UUID 回退）持久化 |
| `src/store/` | Zustand 全局状态（尚未启用） |
| `src/theme/` | Design Token + 复用 StyleSheet。`tokens.ts` 定义色值/间距/圆角，`shared.ts` 定义共用样式（input/btn/card 等）。所有页面引用 `c` 和 `shared`，不硬编码色值 |
| `android/app/src/main/java/com/nasapp/modules/` | Kotlin JSB 原生模块：MdnsModule.kt（NsdManager）、WifiP2pModule.kt（WifiP2pManager）、NfcModule.kt（Ndef NDEF 标签读写 + 前景调度） |
### 连接策略（`src/network/connector.ts`）
`connectToNas(onProgress?)` 实现三层降级，通过可选回调 `onProgress({phase, subtitle, multipleDevices})` 向 UI 层实时报告进度：
mDNS 局域网发现 ──→ 1台自动连接（/api/ping 6s + 重试一次验证可达）
   │               验证失败：保存 URL 不放行到缓存层（避免旧地址干扰）
   │               多台 → 回调 multipleDevices，UI 跳 DiscoveryScreen 让用户选
   ↓ 0台
缓存 IP ping 验证（4s 超时）──→ 可达则返回 URL
   ↓ 不可达
WiFi P2P 直连 ──→ 连上后 /api/ping 验证 NAS 服务可达
   ↓ 失败
抛出错误（透传原始错误消息）
每层成功后自动 `storage.saveServerUrl()` 持久化。`LoginScreen` 调用 `connectToNas(onProgress)` 驱动 Server bar 状态机（idle → mdns → cache → p2p → connected/failed）。
mDNS 多设备时 `connectToNas` 返回 `null`，由 UI 层跳转 `DiscoveryScreen`（保留原有选设备 UI）。用户选完后 goBack，LoginScreen 通过 `useFocusEffect` 检测 serverUrl 变化。
### WiFi P2P 原生模块（`WifiP2pModule.kt`）
Kotlin 原生模块，使用 Android `WifiP2pManager` API 实现 WiFi Direct 直连。核心流程（`connect()` 方法）分 5 步：
1. **清理残留 Group**：`requestGroupInfo()` → `removeGroup()`，防止上次未正常断开的连接阻塞新连接
2. **设备发现**：`discoverPeers()`（先 `stopPeerDiscovery` 清 BUSY） + BroadcastReceiver 监听 `PEERS_CHANGED_ACTION`，过滤 `deviceName` 含 `"nas"` 且 `status == AVAILABLE` 的设备后自动连接
3. **建立连接**：`connect()` + BroadcastReceiver 监听 `CONNECTION_CHANGED_ACTION`
4. **获取 GO IP**：`requestConnectionInfo()` 从 `groupOwnerAddress` 获取 GO IP，null 时回退到 `192.168.49.1`（WiFi Direct GO 标准固定 IP）
5. **超时兜底**：独立线程 30s 超时后主动 reject，防止永久挂起
防竞争设计：`AtomicBoolean resolved` 确保超时线程和连接回调不会同时 resolve/reject；`connectionAttempted` 防止 `PEERS_CHANGED` 重复回调；`ourDiscoveryStarted` 防止 `stopPeerDiscovery` 的 `DISCOVERY_STOPPED` 被误判为超时。`cleanup()` 统一注销所有 BroadcastReceiver。
P2P 设备名规范：NAS 端 `wpa_supplicant.conf` 需设置 `device_name=NAS-<device_id>`，APP 端按 `deviceName.lowercase().contains("nas")` 过滤识别。
### NFC 碰一碰（`src/screens/NfcScanScreen.tsx`）
完整 NFC 碰一碰登录流程，支持前景调度读标签 + 首次绑定 + 自动登录：
1. 前景调度读取 NFC 标签 → 解析 NDEF 文本记录 → 获取 `device_id`
2. `connectToNas()` → 校验 `/api/device-info` 确保 device_id 匹配
3. `NfcModule.getPhoneId()` → 从 `ANDROID_ID` 读取设备硬件标识
4. `POST /api/nfc-login {device_id, phone_id}` → 已绑定直接登录，未绑定弹出密码框
5. 首次碰 → `POST /api/nfc-bind {device_id, phone_id, username, password}` → 绑定后自动登录
**phone_id 来源**：`Settings.Secure.ANDROID_ID`（64 位 hex，不需要权限，APP 重装不变）。NFC 模块不可用时回退 AsyncStorage UUID。
**标签格式**：NTAG216（Type 2），两条 NDEF 记录——AAR（com.nasapp，用于冷启动唤起 APP）+ 文本记录（device_id 如 `3c1070c88b7c`）。
**冷启动限制**：当前 ROM 将 AAR 唤起的 `NDEF_DISCOVERED` intent 降级为 `MAIN` + 丢弃数据，冷启动碰标签无法自动跳转 NfcScanScreen。用户需手动打开 APP 后碰标签。后续通过 `enableReaderMode` 绕过 intent 分发解决。
### 文件管理（`src/screens/HomeScreen.tsx`）
登录成功后进入的主页面，功能完整：
- **目录导航**：`prevPaths` 栈记录路径历史；点击目录 `▸` 进入子目录，header `‹` 按钮返回上级；Android 返回键被 `BackHandler` 拦截——子目录中回退，根目录时弹出确认弹窗
- **文件列表**：目录在前、文件在后，按名称排序；图标 `▸`/`□`（Precision 设计，无 emoji）；pull-to-refresh 重新加载
- **操作**：长按弹出菜单（重命名 → `POST /api/files/move`；删除 → `DELETE /api/files?path=`，目录递归删除）；点击文件弹出详情 Modal（名称、大小、日期、权限、完整路径）
- **新建文件夹**：header `+` → Modal 输入名称 → `POST /api/files/mkdir`
- **文件上传**：header `↑` → 系统文件选择器（`@react-native-documents/picker`）→ multipart `POST /api/files/upload` → 刷新列表
- **共享文件**：header 下方 Tab 栏（"/我的文件" / "/共享文件"），路径 `/data/shared`。普通用户只读——共享 Tab 下隐藏 `[+]` 和 `[↑]` 按钮，上传/创建失败时弹出"共享目录只读，请联系管理员"而非技术错误。两个 Tab 各自维护独立的导航栈，切换不被干扰
- **自动登录**：`LoginScreen.useFocusEffect` 中检查已存 token → `GET /api/validate-token` → 有效则 `navigation.replace('Home')` 跳过登录页
- **错误处理**：401 → 清 auth 跳 LoginScreen；其他错误 → 显示错误文字 + 重试按钮
> 依赖说明：文件选择器必须用 `@react-native-documents/picker`（12.0.1），不能用 `react-native-document-picker`。后者依赖的 `GuardedResultAsyncTask` 在 RN 0.74+ 已移除，编译直接失败。
## 后端接口（authd，默认 :8080，所有接口统一 `/api/` 前缀）
> 所有请求/响应结构体定义在 `ldap-demo/authd/handler/dto.go`。
### 公开接口（无需 JWT）
| 接口 | 说明 | 响应 |
|------|------|------|
| `GET /api/ping` | 连通性测试 | `{ok: true}` |
| `GET /api/device-info` | 设备信息校验，mDNS 发现后确认身份 | `{device_id, hostname, version: "1.0"}` |
| `POST /api/register` | 注册 | `{token, uid, role}` — role 可为 `"admin"`（首个用户）或 `"user"` |
| `POST /api/login` | LDAP Bind 验证，返回 JWT（24h） | `{token, role}` |
| `POST /api/nfc-login` | NFC 碰一碰登录（{device_id, phone_id}） | `{token, username, role}` 或 `{need_bind: true}` |
| `POST /api/nfc-bind` | NFC 首次绑定（{device_id, phone_id, username, password}） | `{token, username, role}` |
### 需 JWT（`Authorization: Bearer <token>`）
| 接口 | 说明 | 请求格式 | 响应格式 |
|------|------|---------|---------|
| `GET /api/validate-token` | 验证 JWT 有效 | — | `{valid: true, username}` |
| `GET /api/files?path=` | 列目录 | query `path`（空时 admin→/data, user→/data/{username}） | `{path, files: FileInfo[]}` |
| `GET /api/files/download?path=` | 下载文件 | query `path` | 二进制流 `application/octet-stream` |
| `POST /api/files/upload` | 上传文件 | multipart：`file` + `path`（目标目录） | `{ok: true, path}` |
| `POST /api/files/mkdir` | 建目录 | JSON `{path}` | `{ok: true, path}` |
| `POST /api/files/move` | 移动/重命名 | JSON `{from, to}` | `{ok: true}` |
| `DELETE /api/files?path=` | 删除（递归） | query `path` | `{ok: true}` |
### FileInfo 字段（`system/file.go:20`）
```ts
interface FileInfo {
  name: string;        // 文件或目录名
  size: number;        // 字节，目录为 0
  type: "file" | "directory";
  modified: string;    // ISO 时间
  permission: string;  // owner 权限位，如 "rwx"、"rw-"、"r--"
}
## 关键约束
- **phone_id**：来自 `Settings.Secure.ANDROID_ID`（硬件绑定，APP 重装不变，不需要权限）。NFC 模块不可用时回退 AsyncStorage UUID。切忌手动生成——uuidv4 不跟设备绑定，清缓存就变
- **RN 0.85 New Architecture 约束**：禁止直接访问 `reactNativeHost`（`FabricUIManager` 模式抛出 `RuntimeException`）。MainActivity 中不能调 `reactNativeHost.reactInstanceManager`，NFC 冷启动缓存必须用 `companion object` 静态变量
- WiFi P2P 连接成功后 NAS IP 固定为 `192.168.49.1:8080`
- **WiFi P2P 权限**：
  - Android 13+ (API 33)：`NEARBY_WIFI_DEVICES` 是**运行时危险权限**，必须在系统设置中手动授权（非 Manifest 声明即生效）。Manifest 中需同时加 `android:usesPermissionFlags="neverForLocation"`。未授权时 `discoverPeers()` 返回 `onFailure(reason=0)` 不抛异常，表现为持续 BUSY 无日志
  - Android 6-12：需要 `ACCESS_FINE_LOCATION` 运行时授权，Manifest 中应限制 `android:maxSdkVersion="32"`
  - 必需：`CHANGE_WIFI_STATE`（`WifiP2pManager.initialize()` 需要，缺则抛 `SecurityException`）、`CHANGE_NETWORK_STATE`
  - APP 端 `hasLocationPermission()` 按 API 级别自动选择检查哪个权限
- MVP 阶段不做防重放和 HTTPS，正式版再加
- **UI 色值禁止硬编码**：所有颜色从 `src/theme/tokens.ts` 的 `c` 对象引用，共用样式从 `src/theme/shared.ts` 的 `shared` 引用。这是 Precision 设计系统的零依赖 Token 方案，保持全局视觉一致性
- **新增 screen 遵循 Precision 设计**：黑白灰全线、无彩色强调、无 emoji 装饰、无渐变圆形。详见 `DESIGN.md`
- **API 前缀统一 `/api/`**：由 `src/api/client.ts` 统一拼接，不再在各 api 模块中手写前缀
- **自动登录**：token 存 AsyncStorage，APP 启动时 `validateToken` 验证有效性，有效则跳过登录页直接进 HomeScreen。Token 被清除时（手动退出 / 401）回落到登录页
- **Android 返回键**：HomeScreen 用 `BackHandler.addEventListener` 接管，子目录中回退上级，根目录时 Alert 确认退出
## 已知坑点
- **USB IP 动态变化**：USB 网络共享每次重新连接 IP 会变（如 `10.106.26.x`），硬编码 `BASE_URL` 需频繁改代码。解决方案：长按登录页右下角 ping 按钮进入 DevSettings 屏幕，在 App 内修改并持久化服务器地址，无需改代码重编译
- **async-storage 必须用 v2**：v3 依赖国内镜像没有的 Maven 包 `org.asyncstorage.shared_storage:storage-android`，构建直接失败
- **Gradle 镜像**：`gradle-wrapper.properties` 用腾讯云镜像，`build.gradle` 加阿里云 Maven 镜像，详见 `docs/setup.md`
- **tsconfig `baseUrl` 已移除**：新版 TS 不支持，路径别名用 `paths: {"@/*": ["./*"]}`，babel alias 对应 `"@": "./"`
- **安装被拒（INSTALL_FAILED_USER_RESTRICTED）**：检查手机开发者选项中 **USB 安装** 是否开启
- **mDNS 必须声明 3 个权限**：`CHANGE_WIFI_MULTICAST_STATE`（加入多播组）、`ACCESS_WIFI_STATE`、`ACCESS_NETWORK_STATE`。缺少任何一个都会导致 `discover()` 返回空数组
- **mDNS serviceType 末尾带 `.`**：Android NsdManager 返回的 `serviceType` 是 DNS FQDN 格式（末尾带 `.`，如 `_nas._tcp.`），比较时必须 `removeSuffix(".")` 否则匹配失败，`resolveService` 永远不会被调用，5s 超时后返回 0 设备。已修复于 `MdnsModule.kt:81`
- **shared.centered 导致子元素收缩**：`shared.centered` 包含 `alignItems: 'center'`，子元素会被压缩到内容宽度而非填满父容器。输入框、按钮等需要全宽的元素必须在其直系父级加 `alignSelf: 'stretch'` 打破收缩链（不只是元素自身，而是整条链上的每个父级）
- **P2P 残留 Group 阻塞重连**：上次连接如果未正常 `removeGroup()`，下次 `discoverPeers` 会因 Group 仍存在而无法发现新设备。`connect()` 第 0 步应调 `requestGroupInfo()` 检查并 `removeGroup()` 清理
- **P2P `connect()` 失败静默**：`WifiP2pManager.connect()` 的 `onFailure` 可能只是请求未发出，真正的连接结果在 `CONNECTION_CHANGED_ACTION` 广播中。`onFailure` 应直接 reject Promise（不等待超时）
- **P2P `NEARBY_WIFI_DEVICES` 未授权无日志**：Android 13+ 上此权限是运行时危险权限。未授权时 `discoverPeers()` 返回 `onFailure(reason=0)`（BUSY），不报 SecurityException。表现为持续 BUSY 无任何 WifiP2pModule 日志输出。解决：`hasLocationPermission()` 中对 API 33+ 检查 `checkSelfPermission(NEARBY_WIFI_DEVICES)`，未授权直接 reject 给出明确提示
- **P2P `initialize()` 缺权限异常先于 Log**：`WifiP2pManager.initialize()` 需要 `CHANGE_WIFI_STATE`，缺则抛 `SecurityException`，发生时机在 `connect()` 方法任何 `Log.e/i` 之前，日志完全看不到 WifiP2pModule 输出。解决：`initialize()` 包 try-catch，捕获后打 Log 并 reject
- **P2P `stopPeerDiscovery` 误触发超时**：`startDiscovery()` 前调用 `stopPeerDiscovery()` 清理 BUSY 状态，但会触发 `DISCOVERY_STOPPED` 广播，被 Receiver 误判为 discoverPeers 超时。解决：增加 `ourDiscoveryStarted` 标志，只有收到 `DISCOVERY_STARTED` 后才处理 `DISCOVERY_STOPPED`
- **P2P `PEERS_CHANGED` 回调重复**：Android 一次设备列表变化可能触发多次 `requestPeers` 回调，导致重复 `connect()`。解决：`connectionAttempted` 标志防重
- **P2P 扫到非 NAS 设备**：`discoverPeers` 返回所有 Wi-Fi Direct 设备（打印机等）。解决：按 `deviceName.lowercase().contains("nas")` 过滤，NAS 端在 `wpa_supplicant.conf` 中设 `device_name=NAS-<device_id>`
- **P2P 开发机限制**：Ubuntu Desktop + NetworkManager 接管 WiFi 后无法创建 P2P GO，需 Ubuntu Server（无 NetworkManager）。日常开发以 mDNS 为主，P2P 等 NAS 硬件到位后验证
- **USB 网络共享 mDNS 通但 HTTP 不通**：电脑通过 USB 共享网络给手机时，mDNS UDP 多播可跨越 USB 到达手机（能发现 NAS），但 TCP 路由隔离——手机路由表不知 `10.20.x.x` 网段怎么走，HTTP 请求发不出。解决：手机直接连 WiFi 与 NAS 同局域网
- **`filesApi.list()` 发 `path=/` 返回 403**：普通用户路径校验 `ValidatePath` 要求 path 在 `/data/{username}/` 前缀下，发 `/` 不满足。正确做法：空目录时不传 `?path=` 参数，后端自动映射到用户根目录
- **`react-native-document-picker` 编译失败**：9.x 全系列依赖 RN bridge 的 `GuardedResultAsyncTask`，此类在 RN 0.74+ 已移除。解决：替换为 `@react-native-documents/picker`（12.0.1），API 兼容，`pick()` 签名几乎一致
- **NFC 冷启动碰标签 intent 数据丢失**：部分 ROM 将 `NDEF_DISCOVERED` intent 降级为 `MAIN` 并丢弃 extras（无 Tag 对象）。当前方案：AAR 只负责打开 APP，用户进 NfcScanScreen 后前景调度读标签。后续通过 `enableReaderMode` 绕过 intent 分发
- **RN 0.85 New Architecture 禁止 reactNativeHost**：`onCreate` 中访问 `reactNativeHost.reactInstanceManager` 直接抛 `RuntimeException: You should not use ReactNativeHost directly in the New Architecture`。解决：NFC 冷启动缓存用 `companion object` 静态变量，不经过 RN bridge。前景调度 `onNewIntent` 中加 try-catch
## 入口文件
index.js     ← Android 启动入口，注册 App 组件，不需要动
App.tsx      ← 根组件，接入 NavigationContainer
