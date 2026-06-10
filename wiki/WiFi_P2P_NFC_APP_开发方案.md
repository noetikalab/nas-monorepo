> 时效：fresh / 上次验证：2026-06-01
> 标签：p2p, nfc, 方案, 同事
> 源材料：[同事方案]
> 创建：2026-06-01 / 更新：2026-06-01

# WiFi P2P + NFC + APP 综合开发方案

> 创建日期：2026-06-01  
> 负责：NAS 服务端（ldap-demo），APP 客户端（NasApp）  
> 目标：实现手机与 NAS 的 WiFi Direct 直连，结合 NFC 碰一碰触发连接流程

---

## 一、架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                        整体数据流                                   │
├────────────┬──────────────────────┬──────────────────────────────┤
│   NFC 层   │      连接层           │       应用层                   │
│  (物理触发)  │  (网络通道建立)        │   (业务 API 调用)               │
├────────────┼──────────────────────┼──────────────────────────────┤
│            │                      │                              │
│ 手机碰标签   │ mDNS 局域网发现       │ POST /api/login              │
│   ↓        │   ↓ 失败              │ GET  /api/files              │
│ 读取 NDEF   │ 缓存 IP ping 验证     │ POST /api/files/upload       │
│   ↓        │   ↓ 失败              │ POST /api/nfc-login（后续）     │
│ device_id  │ WiFi P2P 直连         │                              │
│ nfc_token  │   ↓ 成功              │                              │
│            │ baseUrl = IP:8080     │                              │
│            │                      │                              │
│ NAS 侧     │ NAS 侧                │ NAS 侧（已完成）                │
│ ──────     │ ──────                 │ ────────────                │
│ (待开发)    │ start.sh 新增代码      │ authd gin 路由               │
│ puf-agent  │ wpa_cli p2p_group_add │ JWT 中间件                   │
│ 提供 did   │ ip addr add .49.1     │ 文件 6 端点                  │
│            │ dnsmasq DHCP          │ 管理 7 端点                  │
│            │ mDNS 双接口广播         │                              │
└────────────┴──────────────────────┴──────────────────────────────┘
```

### 连接优先级策略

```
mDNS 局域网发现（1s 超时）
  ↓ 失败
缓存 IP（ping 验证，2s 超时）
  ↓ 不可达
WiFi P2P 直连（3-10s）
  ↓ 失败
提示用户 "无法连接"
```

### WiFi P2P 与 mDNS 的关系

| | WiFi P2P | mDNS |
|------|---------|------|
| **解决的问题** | 没有路由器时两台设备怎么通信 | 连上网后怎么找到对方 |
| **协议层** | L2 链路层（WiFi 直连通道） | L3+ 应用层（基于 IP 的服务发现） |
| **依赖** | 不需要路由器 | 需要双方已在同一 IP 网络内 |

**WiFi P2P 是物理通道，mDNS 是导航地图。P2P 连通后 NAS IP 固定为 192.168.49.1，手机不需要 mDNS 就能直接访问。P2P 连接成功后，mDNS 在 P2P 接口上广播也可作为额外容错层。**

---

## 二、NAS 侧实现

### 2.1 前提条件

- WiFi 芯片：Realtek RTL8822CE（开发机当前）→ 原生支持 P2P-GO / P2P-Client
- Intel AX210（后续 NAS 硬件）→ 同样支持 WiFi Direct
- `wpa_cli` v2.11 已安装
- 容器 `network_mode: host` + `privileged: true`（已有配置，无需改动）

### 2.2 deploy/Dockerfile

`apt-get install` 列表新增 `iw` 和 `dnsmasq`：

```dockerfile
RUN apt-get update && apt-get install -y \
    wpasupplicant \
    samba \
    nfs-kernel-server \
    nginx \
    libnginx-mod-http-dav-ext \
    libnss-ldap libpam-ldap \
    acl \
    curl \
    iw \
    dnsmasq \
    && rm -rf /var/lib/apt/lists/*
```

### 2.3 deploy/start.sh

在现有 Samba/NFS/Nginx 启动代码之后、`exec /usr/local/bin/authd` 之前插入：

```bash
# ====================================================================
# WiFi Direct P2P — NAS 作为 Group Owner
# 手机通过 WiFi Direct 直连 NAS，无需路由器
# GO IP: 192.168.49.1，DHCP 池: 192.168.49.100~200
# ====================================================================
if iw dev | grep -q wlp; then
    wpa_cli -i wlp3s0 p2p_group_add persistent 2>/dev/null || true
    sleep 3
    P2P_IFACE=$(iw dev | grep -o 'p2p-wlp3s0[^ ]*' | head -1)
    if [ -n "$P2P_IFACE" ]; then
        ip addr add 192.168.49.1/24 dev "$P2P_IFACE" 2>/dev/null || true
        ip link set "$P2P_IFACE" up
        dnsmasq --interface="$P2P_IFACE" \
            --dhcp-range=192.168.49.100,192.168.49.200,255.255.255.0,12h \
            --no-daemon --log-facility=- 2>/dev/null &
        echo "[WiFi P2P] Ready: $P2P_IFACE → 192.168.49.1"
    else
        echo "[WiFi P2P] WARN: P2P interface not created"
    fi
else
    echo "[WiFi P2P] No WiFi hardware, skipped"
fi
```

### 2.4 authd/mdns/server.go — mDNS 双接口广播

核心改动：

1. `pickIP()` → `pickIPs()`：返回所有物理接口和 `p2p-*` 接口的 IPv4 地址
2. `var server *zeroconf.Server` → `var servers []*zeroconf.Server`
3. `Start()` 为每个 IP 注册独立 service instance
4. `Shutdown()` 遍历所有 server 逐个关闭

```go
func pickIPs() []net.IP {
    var ips []net.IP
    ifaces, _ := net.Interfaces()
    for _, iface := range ifaces {
        if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
            continue
        }
        if !isPhysicalOrP2P(iface.Name) {
            continue
        }
        addrs, _ := iface.Addrs()
        for _, addr := range addrs {
            if ipnet, ok := addr.(*net.IPNet); ok {
                if ip := ipnet.IP.To4(); ip != nil && !ip.IsLoopback() {
                    if ip[0] == 172 && (ip[1] >= 17 && ip[1] <= 31) {
                        continue // Docker bridge
                    }
                    ips = append(ips, ip)
                }
            }
        }
    }
    return ips
}

func isPhysicalOrP2P(name string) bool {
    return strings.HasPrefix(name, "wlp") ||
           strings.HasPrefix(name, "wlan") ||
           strings.HasPrefix(name, "eth") ||
           strings.HasPrefix(name, "enp") ||
           strings.HasPrefix(name, "p2p-")
}
```

### 2.5 docker-compose.yml

无需改动。已有 `network_mode: host` + `privileged: true`。

---

## 三、APP 侧实现

### 3.1 AndroidManifest.xml

在 `<manifest>` 内、现有 `<uses-permission>` 之后追加 2 行：

```xml
<!-- WiFi P2P：Android 13+ 专用权限 -->
<uses-permission android:name="android.permission.NEARBY_WIFI_DEVICES" />
<!-- WiFi P2P：Android 6-12 定位权限（发现 P2P 设备需要） -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

已有权限保持不变：`INTERNET`, `CHANGE_WIFI_MULTICAST_STATE`, `ACCESS_WIFI_STATE`, `ACCESS_NETWORK_STATE`。

### 3.2 WifiP2pModule.kt

**文件**：`android/app/src/main/java/com/nasapp/modules/WifiP2pModule.kt`

```kotlin
package com.nasapp.modules

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.NetworkInfo
import android.net.wifi.p2p.WifiP2pConfig
import android.net.wifi.p2p.WifiP2pDevice
import android.net.wifi.p2p.WifiP2pDeviceList
import android.net.wifi.p2p.WifiP2pInfo
import android.net.wifi.p2p.WifiP2pManager
import android.os.Build
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

class WifiP2pModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WifiP2pModule"

    private val manager: WifiP2pManager? by lazy {
        reactContext.getSystemService(Context.WIFI_P2P_SERVICE) as? WifiP2pManager
    }

    companion object {
        private const val TAG = "WifiP2pModule"
        private const val TIMEOUT_SECONDS = 30L
        private const val GO_FALLBACK_IP = "192.168.49.1"
        private const val AUTH_PORT = 8080
    }

    @ReactMethod
    fun connect(promise: Promise) {
        // ---- 前检查：系统服务可用性 ----
        val mgr = manager
        if (mgr == null) {
            Log.e(TAG, "WifiP2pManager not available")
            promise.reject("P2P_ERR", "此设备不支持 WiFi P2P")
            return
        }

        // ---- 前检查：运行时定位权限 ----
        if (!hasLocationPermission()) {
            Log.w(TAG, "Location permission not granted")
            promise.reject("P2P_ERR", "需要定位权限才能发现 P2P 设备")
            return
        }

        // ---- 防重复 resolve/reject ----
        val resolved = AtomicBoolean(false)

        // ---- 变量声明（回调中需要访问） ----
        var discoveryReceiver: BroadcastReceiver? = null
        var connectionReceiver: BroadcastReceiver? = null
        var channel: WifiP2pManager.Channel? = null

        // ---- 清理函数：确保单次执行、成对注销 Receiver ----
        fun cleanup() {
            discoveryReceiver?.let {
                try { reactApplicationContext.unregisterReceiver(it) }
                catch (_: Exception) {}
            }
            connectionReceiver?.let {
                try { reactApplicationContext.unregisterReceiver(it) }
                catch (_: Exception) {}
            }
        }

        // ---- 安全 promise 封装 ----
        fun resolveSuccess(ip: String, port: Int) {
            if (!resolved.compareAndSet(false, true)) return
            cleanup()
            val map = WritableNativeMap().apply {
                putString("ip", ip)
                putInt("port", port)
            }
            promise.resolve(map)
        }

        fun resolveError(code: String, message: String) {
            if (!resolved.compareAndSet(false, true)) return
            cleanup()
            promise.reject(code, message)
        }

        // ---- 初始化 P2P Channel ----
        channel = mgr.initialize(reactApplicationContext, Looper.getMainLooper(), null)
        if (channel == null) {
            resolveError("P2P_ERR", "P2P Channel 初始化失败")
            return
        }

        // ---- Step 1: 发现 Receiver ----
        discoveryReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                when (intent?.action) {
                    WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION -> {
                        Log.i(TAG, "Peers changed, querying list")
                        mgr.requestPeers(channel) { peers: WifiP2pDeviceList ->
                            Log.i(TAG, "Found ${peers.deviceList.size} peer(s)")
                            for (device in peers.deviceList) {
                                if (device.status == WifiP2pDevice.AVAILABLE) {
                                    Log.i(TAG, "  → ${device.deviceName} (${device.deviceAddress})")
                                    connectToDevice(mgr, channel!!, device)
                                    return@requestPeers
                                }
                            }
                        }
                    }
                    WifiP2pManager.WIFI_P2P_DISCOVERY_CHANGED_ACTION -> {
                        val state = intent.getIntExtra(
                            WifiP2pManager.EXTRA_DISCOVERY_STATE, -1)
                        Log.i(TAG, "Discovery state: $state")
                        if (state == WifiP2pManager.WIFI_P2P_DISCOVERY_STOPPED) {
                            if (resolved.get()) return
                            resolveError("P2P_ERR", "发现超时，未找到 NAS 设备")
                        }
                    }
                }
            }
        }

        // ---- Step 2: 连接结果 Receiver ----
        connectionReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action != WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION) return

                val networkInfo = intent.getParcelableExtra<NetworkInfo>(
                    WifiP2pManager.EXTRA_NETWORK_INFO)
                if (networkInfo?.isConnected != true) return

                Log.i(TAG, "P2P connected, requesting group info")
                mgr.requestConnectionInfo(channel) { info: WifiP2pInfo ->
                    val goIp = info.groupOwnerAddress?.hostAddress ?: GO_FALLBACK_IP
                    Log.i(TAG, "GO IP: $goIp")
                    resolveSuccess(goIp, AUTH_PORT)
                }
            }
        }

        // ---- Step 3: 注册 Receivers ----
        val discoveryFilter = IntentFilter().apply {
            addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_DISCOVERY_CHANGED_ACTION)
        }
        reactApplicationContext.registerReceiver(discoveryReceiver, discoveryFilter)

        val connectionFilter = IntentFilter().apply {
            addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION)
        }
        reactApplicationContext.registerReceiver(connectionReceiver, connectionFilter)

        // ---- Step 4: 开始发现 ----
        Log.i(TAG, "Starting discovery")
        mgr.discoverPeers(channel, object : WifiP2pManager.ActionListener {
            override fun onSuccess() { Log.i(TAG, "Discovery started") }
            override fun onFailure(reason: Int) {
                Log.e(TAG, "discoverPeers failed: $reason")
                resolveError("P2P_ERR", "发起发现失败 (code=$reason)")
            }
        })

        // ---- Step 5: 超时兜底 ----
        Thread {
            try {
                if (!resolved.get()) {
                    Thread.sleep(TimeUnit.SECONDS.toMillis(TIMEOUT_SECONDS))
                }
            } catch (_: InterruptedException) {}
            if (!resolved.get()) {
                resolveError("P2P_TIMEOUT", "WiFi P2P 连接超时 (${TIMEOUT_SECONDS}s)")
            }
        }.start()
    }

    private fun connectToDevice(
        mgr: WifiP2pManager,
        channel: WifiP2pManager.Channel,
        device: WifiP2pDevice
    ) {
        val config = WifiP2pConfig().apply {
            deviceAddress = device.deviceAddress
        }
        Log.i(TAG, "Connecting to ${device.deviceName} (${device.deviceAddress})")
        mgr.connect(channel, config, object : WifiP2pManager.ActionListener {
            override fun onSuccess() { Log.i(TAG, "connect() initiated") }
            override fun onFailure(reason: Int) {
                Log.e(TAG, "connect() failed: $reason")
            }
        })
    }

    private fun hasLocationPermission(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        return reactApplicationContext.checkSelfPermission(
            android.Manifest.permission.ACCESS_FINE_LOCATION
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
    }
}
```

**关键设计点**：

- `AtomicBoolean resolved`：防止超时线程和连接成功回调同时 resolve/reject
- `cleanup()`：确保 BroadcastReceiver 成对注销，无论成功还是失败
- 运行时权限检查：Android 6+ 无定位权限直接 reject，避免 wifi P2P 发现静默失败
- 30 秒超时：P2P 连接通常 3-10s，30s 足够覆盖异常情况

### 3.3 WifiP2pPackage.kt

**文件**：`android/app/src/main/java/com/nasapp/modules/WifiP2pPackage.kt`

```kotlin
package com.nasapp.modules

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class WifiP2pPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(WifiP2pModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
```

### 3.4 MainApplication.kt — 注册

在 `PackageList(this).packages.apply { }` 块内追加一行：

```kotlin
PackageList(this).packages.apply {
    add(MdnsPackage())
    add(WifiP2pPackage())   // ← 新增
}
```

### 3.5 src/native/WifiP2pModule.ts

**文件**：`src/native/WifiP2pModule.ts`

```typescript
import { NativeModules } from 'react-native';

export interface P2pConnectionResult {
  ip: string;
  port: number;
}

const WifiP2pModule = NativeModules.WifiP2pModule;

export function connect(): Promise<P2pConnectionResult> {
  if (!WifiP2pModule) {
    return Promise.reject(new Error('WifiP2pModule not available'));
  }
  return WifiP2pModule.connect();
}
```

### 3.6 src/network/connector.ts — 完整三层策略

**文件**：`src/network/connector.ts`（替换现有内容）

```typescript
import { discover } from '../native/MdnsModule';
import { connect as p2pConnect } from '../native/WifiP2pModule';
import { storage } from '../storage/local';

/**
 * 连接 NAS，按优先级依次尝试 mDNS → 缓存 IP → WiFi P2P。
 * @returns NAS baseUrl（如 http://192.168.49.1:8080）
 */
export async function connectToNas(): Promise<string> {
  // 优先级 1：mDNS 局域网发现
  try {
    const devices = await discover();
    if (devices.length > 0) {
      const url = `http://${devices[0].ip}:${devices[0].port}`;
      await storage.saveServerUrl(url);
      return url;
    }
  } catch { /* 继续降级 */ }

  // 优先级 2：缓存 IP（快速 ping 验证）
  const cached = await storage.getServerUrl();
  if (cached) {
    try {
      const res = await fetch(`${cached}/api/ping`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return cached;
    } catch { /* 继续降级 */ }
  }

  // 优先级 3：WiFi P2P 直连
  try {
    const { ip, port } = await p2pConnect();
    const url = `http://${ip}:${port}`;
    await storage.saveServerUrl(url);
    return url;
  } catch (e) {
    throw new Error('无法连接到 NAS，请检查设备是否开机');
  }
}
```

### 3.7 src/screens/NfcScanScreen.tsx — 骨架

**文件**：`src/screens/NfcScanScreen.tsx`（新增）

```tsx
import React, { useEffect } from 'react';
import { View, Text, Alert, ActivityIndicator } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { connectToNas } from '../network/connector';
import { getDeviceInfo } from '../api/device';
import { storage } from '../storage/local';
import type { RootStackParamList } from '../navigation';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'NfcScan'>;
};

export function NfcScanScreen({ navigation }: Props) {
  useEffect(() => {
    handleConnect();
  }, []);

  async function handleConnect() {
    try {
      // 1. 建立连接（mDNS → 缓存 → P2P）
      const baseUrl = await connectToNas();

      // 2. 校验设备身份
      const info = await getDeviceInfo(baseUrl);
      // TODO: 与 NFC 标签中的 device_id 比对

      // 3. MVP：跳登录页（用户手动输密码）
      await storage.saveServerUrl(baseUrl);
      navigation.replace('Login');
    } catch (e: any) {
      Alert.alert('连接失败', e.message || '请检查 NAS 是否开机');
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#2D2D2D" />
      <Text style={{ marginTop: 20, fontSize: 16 }}>正在连接 NAS...</Text>
    </View>
  );
}
```

### 3.8 navigation/index.tsx — 注册 NfcScan 路由

在 `RootStackParamList` 和 `Stack.Navigator` 中添加 `NfcScan` screen：

```tsx
export type RootStackParamList = {
  Discovery: undefined;
  Login: undefined;
  Home: undefined;
  DevSettings: undefined;
  NfcScan: undefined;        // ← 新增
};

// 在 Stack.Navigator 内加入：
<Stack.Screen name="NfcScan" component={NfcScanScreen} />
```

---

## 四、NFC 集成路线

| 阶段 | NFC 做什么 | WiFi P2P 做什么 |
|------|-----------|----------------|
| **MVP（本次）** | 读取 device_id，触发 P2P 连接流程 | 独立 discoverPeers + connect，连上后跳 LoginScreen |
| **增强版** | device_id 筛选 P2P 发现结果，精确连接 | discoverPeers → 用 device_id 过滤 → connect |
| **完整版** | 全部三合一：触发 → 发现 → 连接 → 免密登录 | 全程自动，< 2 秒进主页 |

### WiFi P2P 与 NFC 的关系

**WiFi P2P 是通道，NFC 是遥控器。通道先通，遥控器后加。** 没有 NFC 时 WiFi P2P 也能独立工作：APP 首页点"搜索设备"按钮 → P2P 发现 → 连接 → 登录。NFC 的作用是把"点按钮、等扫描、选设备、输密码"压缩成一个动作。

---

## 五、端到端时序（MVP）

```
用户碰触 NAS NFC 标签
         │
    ┌────▼────┐
    │ 读 NDEF  │  ← NfcModule（待开发，约 0.2 秒）
    │ device_id│
    │ nfc_token│
    └────┬────┘
         │
    ┌────▼─────────────────────────────────┐
    │ connector.connectToNas()             │
    │                                      │
    │  ① mDNS 发现 (1s) ─── 成功 → 返回    │
    │      ↓ 失败                           │
    │  ② 缓存 IP ping (2s) ── 成功 → 返回   │
    │      ↓ 失败                           │
    │  ③ WiFi P2P 直连 (3-10s)             │
    │     ┌─ discoverPeers (2-5s)          │
    │     ├─ 找到 NAS → connect (1-3s)     │
    │     ├─ 拿到 GO IP 192.168.49.1       │
    │     └─ 返回 baseUrl                  │
    └────┬─────────────────────────────────┘
         │
    ┌────▼────┐
    │ 校验设备  │  ← GET /api/device-info
    │ device_id│     确认连到了正确的 NAS
    └────┬────┘
         │
    ┌────▼────┐
    │ 跳转登录  │  ← LoginScreen
    │ 手动输密码│     （已有功能，无需开发）
    └────┬────┘
         │
    ┌────▼────┐
    │   进主页  │  ← HomeScreen
    └─────────┘

总耗时（P2P 场景）：约 5-12 秒（首次），2-5 秒（已缓存）
总耗时（局域网场景）：约 1-3 秒
```

---

## 六、NAS 与 APP 对接点总结

| 对接点 | NAS 提供 | APP 使用 |
|--------|---------|---------|
| P2P 连接通道 | `wpa_cli p2p_group_add` → GO IP `192.168.49.1` | `WifiP2pModule.connect()` → `{ ip, port }` |
| P2P 固定 IP | `ip addr add 192.168.49.1/24` | 从 `groupOwnerAddress` 动态获取，回退硬编码 |
| DHCP | `dnsmasq --dhcp-range=.100-.200` | 自动获取 IP，无需额外处理 |
| mDNS 广播 | 双接口广播（物理 + P2P） | `MdnsModule.discover()` 不变 |
| API | 所有 `/api/*` 端口 8080 不变 | 用拿到的 baseUrl 直接调用 |

---

## 七、测试验证

### 阶段 1 — NAS 侧 P2P 验证（不需要手机）

```bash
wpa_cli -i wlp3s0 p2p_group_add
ip addr show p2p-wlp3s0-0        # 确认 192.168.49.1
curl http://192.168.49.1:8080/api/ping  # 确认 authd 可达
```

### 阶段 2 — APP 侧 P2P 验证（需要手机 + NAS）

```bash
pnpm android                      # 编译安装
# 手机断 WiFi → APP 触发 P2P 连接
adb logcat -s WifiP2pModule       # 监控日志
# 连接成功 → 登录 → 文件操作
```

### 阶段 3 — 端到端 NFC + P2P

1. NFC 标签写入测试数据
2. NAS 启动 P2P GO
3. 手机碰 NFC → 自动连接 → 进登录页
4. 验证完整流程日志

---

## 八、已知风险和踩坑预警

| 风险 | 影响 | 应对 |
|------|------|------|
| **手机 WiFi 状态冲突** | 部分手机启动 P2P 后会断开原 WiFi 连接 | APP 提示"将断开当前 WiFi 连接" |
| **wpa_cli 权限** | 裸机开发需要 root，容器内无需 | Dockerfile 确保容器 root 运行 |
| **P2P 发现不到设备** | NAS GO 广播范围有限，某些 WiFi 芯片兼容性问题 | 已在 Realtek RTL8822CE 上确认 P2P 能力 |
| **Android 12+ 权限** | `NEARBY_WIFI_DEVICES` 替代旧权限，少一个就不可用 | 权限已在 Manifest 中声明 |
| **P2P 连接超时** | 通常 3-10 秒，个别手机 30 秒+ | 超时 30 秒后 reject + 提示用户 |
| **GO IP 不固定** | 理论上 GO 不一定分配 192.168.49.1 | APP 从 `groupOwnerAddress` 动态获取 |
| **dnsmasq 不可用** | 极限镜像可能没有 | Dockerfile 已加入 apt 安装列表 |
| **BroadcastReceiver 泄漏** | 未注销则内存泄漏 | `cleanup()` 确保成对注销 |
| **定位权限缺失** | Android 6+ 无此权限 P2P 发现会静默失败 | 运行时检查 + 拒绝时给原因 |

---

## 九、文件变更清单

### NAS 侧（ldap-demo/）

| 文件 | 操作 | 说明 |
|------|------|------|
| `deploy/Dockerfile` | 修改 | apt install 新增 `iw` `dnsmasq` |
| `deploy/start.sh` | 修改 | 新增 P2P GO 初始化代码块 |
| `authd/mdns/server.go` | 修改 | `pickIP()` → `pickIPs()`，多接口广播 |
| `docker-compose.yml` | 不变 | 已有 `network_mode: host` + `privileged: true` |

### APP 侧（NasApp/）

| 文件 | 操作 | 说明 |
|------|------|------|
| `android/.../AndroidManifest.xml` | 修改 | 新增 `NEARBY_WIFI_DEVICES` `ACCESS_FINE_LOCATION` 权限 |
| `android/.../modules/WifiP2pModule.kt` | 新增 | P2P 连接原生模块 |
| `android/.../modules/WifiP2pPackage.kt` | 新增 | JSB 注册 |
| `android/.../MainApplication.kt` | 修改 | 注册 `WifiP2pPackage` |
| `src/native/WifiP2pModule.ts` | 新增 | JS 封装 |
| `src/network/connector.ts` | 修改 | 增加 P2P 三层降级策略 |
| `src/screens/NfcScanScreen.tsx` | 新增 | NFC 触发入口页面 |
| `src/navigation/index.tsx` | 修改 | 注册 NfcScan 路由 |

---

## 十、预估工作量

| 模块 | 工作量 |
|------|--------|
| NAS：Dockerfile + start.sh + mDNS 改造 | 0.5 天 |
| APP：WifiP2pModule + Package + 权限 | 1 天 |
| APP：connector.ts + NfcScanScreen + navigation | 0.5 天 |
| 集成测试 + 调试 | 1 天 |
| **合计** | **3 天** |

## 相关文章
- [[APP开发记录与踩坑指南_opencode-agent]] — 本方案的实施回溯，含 12 条踩坑实录
- [[../nas-app/docs/mdns-integration]] — 连接策略的共同依赖（mDNS 层）
