package com.nasapp.modules

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.NetworkInfo
import android.net.wifi.WifiManager
import android.net.wifi.p2p.WifiP2pConfig
import android.net.wifi.p2p.WifiP2pDevice
import android.net.wifi.p2p.WifiP2pDeviceList
import android.net.wifi.p2p.WifiP2pGroup
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

/**
 * Android WiFi P2P (WiFi Direct) 原生模块。
 *
 * 功能：发现并连接 NAS 的 WiFi P2P Group Owner (GO)，返回 GO 的 IP 地址。
 * 使用场景：手机和 NAS 之间没有路由器时，通过 WiFi Direct 建立直连通道。
 *
 * 核心流程：
 *   1. 检查权限（定位权限 / NEARBY_WIFI_DEVICES）
 *   2. 清理残留 P2P Group（防止二次连接被旧 Group 阻塞）
 *   3. discoverPeers → 扫描附近 P2P 设备
 *   4. 找到设备后 connect → 建立 P2P 连接
 *   5. requestConnectionInfo → 获取 GO IP
 *   6. 返回 { ip, port } 给 JS 层
 *
 * Android 版本兼容：
 *   - Android 13+ : NEARBY_WIFI_DEVICES 权限（不需要位置权限）
 *   - Android 6-12 : ACCESS_FINE_LOCATION 权限（P2P 发现需要）
 *   - 部分手机启动 P2P 会断开当前 WiFi，APP 层应提示用户
 */
class WifiP2pModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WifiP2pModule"

    /** WifiP2pManager 系统服务，可能为 null（设备不支持 P2P） */
    private val manager: WifiP2pManager? by lazy {
        reactContext.getSystemService(Context.WIFI_P2P_SERVICE) as? WifiP2pManager
    }

    companion object {
        private const val TAG = "WifiP2pModule"
        /** P2P 连接超时时间（秒），通常 3-10s 即可完成 */
        private const val TIMEOUT_SECONDS = 30L
        /** WiFi Direct GO 标准固定 IP，当 requestConnectionInfo 返回 null 时使用 */
        private const val GO_FALLBACK_IP = "192.168.49.1"
        /** NAS authd 服务端口 */
        private const val AUTH_PORT = 8080
    }

    /**
     * 发起 WiFi P2P 连接流程。
     *
     * JS 调用：WifiP2pModule.connect() → Promise<{ ip: string, port: number }>
     *
     * @param promise JS Promise，用于异步返回结果
     */
    @ReactMethod
    fun connect(promise: Promise) {
        val mgr = manager
        if (mgr == null) {
            Log.e(TAG, "设备不支持 WiFi P2P，WifiP2pManager 不可用")
            promise.reject("P2P_ERR", "此设备不支持 WiFi P2P")
            return
        }

        // 运行时权限检查：Android 6-12 需定位权限，Android 13+ 需 NEARBY_WIFI_DEVICES
        if (!hasLocationPermission()) {
            val permName = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
                "NEARBY_WIFI_DEVICES" else "ACCESS_FINE_LOCATION"
            Log.w(TAG, "缺少 $permName 权限，拒绝执行 P2P 发现")
            promise.reject("P2P_ERR", "缺少 $permName 权限，请在系统设置中授予后重试")
            return
        }

        // WiFi 状态检查：WiFi P2P 要求 WiFi 开关已打开（不需要连接网络）
        val wifiManager = reactApplicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
        if (wifiManager != null && !wifiManager.isWifiEnabled) {
            Log.w(TAG, "WiFi 未开启，拒绝执行 P2P 发现")
            promise.reject("P2P_ERR", "请先开启 WiFi（不需要连接网络），再尝试 P2P 直连")
            return
        }

        // AtomicBoolean 防止超时线程和连接成功回调同时 resolve/reject
        val resolved = AtomicBoolean(false)
        // 防止 PEERS_CHANGED 触发多次 requestPeers → 重复 connect
        var connectionAttempted = false
        // 防止 stopPeerDiscovery 产生的 DISCOVERY_STOPPED 被误判为 discoverPeers 超时
        var ourDiscoveryStarted = false

        // BroadcastReceiver 引用，供 cleanup() 统一注销
        var discoveryReceiver: BroadcastReceiver? = null
        var connectionReceiver: BroadcastReceiver? = null
        var channel: WifiP2pManager.Channel? = null

        /**
         * 清理函数：注销所有 Receiver。
         * 无论连接成功还是失败，都必须调用此函数确保资源释放。
         */
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

        /** Promise resolve 封装，确保只 resolve 一次 */
        fun resolveSuccess(ip: String, port: Int) {
            if (!resolved.compareAndSet(false, true)) return
            cleanup()
            val map = WritableNativeMap().apply {
                putString("ip", ip)
                putInt("port", port)
            }
            promise.resolve(map)
        }

        /** Promise reject 封装，确保只 reject 一次 */
        fun resolveError(code: String, message: String) {
            if (!resolved.compareAndSet(false, true)) return
            cleanup()
            promise.reject(code, message)
        }

        // ---- 初始化 P2P Channel ----
        try {
            channel = mgr.initialize(reactApplicationContext, Looper.getMainLooper(), null)
        } catch (e: SecurityException) {
            Log.e(TAG, "P2P initialize 失败，缺少 CHANGE_WIFI_STATE 权限: ${e.message}")
            resolveError("P2P_ERR", "缺少 CHANGE_WIFI_STATE 权限，无法使用 WiFi P2P")
            return
        }
        if (channel == null) {
            resolveError("P2P_ERR", "P2P Channel 初始化失败")
            return
        }

        // ---- Step 0: 清理残留 P2P Group ----
        // 如果之前连过但没有正常断开，残留的 Group 会阻碍新的连接
        mgr.requestGroupInfo(channel) { groupInfo: WifiP2pGroup? ->
            if (groupInfo != null) {
                Log.i(TAG, "发现残留 P2P 组: ${groupInfo.networkName}，正在移除...")
                mgr.removeGroup(channel, object : WifiP2pManager.ActionListener {
                    override fun onSuccess() { Log.i(TAG, "残留 Group 已移除") }
                    override fun onFailure(reason: Int) {
                        Log.w(TAG, "移除残留 Group 失败 (reason=$reason)，继续执行")
                    }
                })
            }
        }

        // ---- Step 1: 设备发现 Receiver ----
        // 监听 P2P 设备列表变化和发现状态变化
        discoveryReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                when (intent?.action) {
                    // 附近 P2P 设备列表发生变化 → 查询设备列表并尝试连接
                    WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION -> {
                        // 防止同一个 PEERS_CHANGED 事件触发多次回调
                        if (connectionAttempted) return
                        connectionAttempted = true
                        Log.i(TAG, "设备列表变化，查询 P2P 设备")
                        mgr.requestPeers(channel) { peers: WifiP2pDeviceList ->
                            Log.i(TAG, "发现 ${peers.deviceList.size} 个 P2P 设备")
                            for (device in peers.deviceList) {
                                Log.d(TAG, "  设备: ${device.deviceName} 状态=${device.status}")
                                // 只连接 AVAILABLE（status=0）且名称含 "nas" 的设备（忽略打印机等）
                                if (device.status == WifiP2pDevice.AVAILABLE &&
                                    device.deviceName.lowercase().contains("nas")) {
                                    Log.i(TAG, "  → 尝试连接 ${device.deviceName} (${device.deviceAddress})")
                                    connectToDevice(mgr, channel!!, device, ::resolveError)
                                    return@requestPeers
                                }
                            }
                            // 无符合条件的设备
                            Log.i(TAG, "未找到可连接的 NAS 设备（需设备名含 'nas'）")
                        }
                    }

                    // 发现状态变化 → 如果发现停止且未找到设备，报超时错误
                    WifiP2pManager.WIFI_P2P_DISCOVERY_CHANGED_ACTION -> {
                        val state = intent.getIntExtra(
                            WifiP2pManager.EXTRA_DISCOVERY_STATE, -1)
                        Log.i(TAG, "P2P 发现状态: $state")
                        // 收到 discoverPeers 发出的 DISCOVERY_STARTED 后，才允许处理 STOPPED
                        if (state == WifiP2pManager.WIFI_P2P_DISCOVERY_STARTED) {
                            ourDiscoveryStarted = true
                        }
                        if (state == WifiP2pManager.WIFI_P2P_DISCOVERY_STOPPED) {
                            // 忽略 stopPeerDiscovery 产生的 STOPPED（不会事先有 STARTED）
                            if (!ourDiscoveryStarted) return
                            if (resolved.get()) return
                            resolveError("P2P_ERR", "发现超时，未找到 NAS 设备")
                        }
                    }
                }
            }
        }

        // ---- Step 2: 连接结果 Receiver ----
        // 监听 P2P 连接状态变化
        connectionReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action != WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION) return

                val networkInfo = intent.getParcelableExtra<NetworkInfo>(
                    WifiP2pManager.EXTRA_NETWORK_INFO)
                if (networkInfo?.isConnected != true) {
                    Log.i(TAG, "P2P 尚未连接或已断开")
                    return
                }

                // 连接成功 → 获取 GO 的 IP 地址
                Log.i(TAG, "P2P 已连接，获取 GO IP 地址")
                mgr.requestConnectionInfo(channel) { info: WifiP2pInfo ->
                    // groupOwnerAddress 在 GO 侧非 null，Client 侧也应有值
                    val goIp = info.groupOwnerAddress?.hostAddress
                    if (goIp != null) {
                        Log.i(TAG, "GO IP 地址: $goIp")
                        resolveSuccess(goIp, AUTH_PORT)
                    } else {
                        // 部分设备 requestConnectionInfo 返回的 groupOwnerAddress 为 null，
                        // 此时回退到 WiFi Direct GO 标准固定 IP
                        Log.w(TAG, "groupOwnerAddress 为 null，回退到固定 IP $GO_FALLBACK_IP")
                        resolveSuccess(GO_FALLBACK_IP, AUTH_PORT)
                    }
                }
            }
        }

        // ---- Step 3: 注册 BroadcastReceiver ----
        val discoveryFilter = IntentFilter().apply {
            addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_DISCOVERY_CHANGED_ACTION)
        }
        reactApplicationContext.registerReceiver(discoveryReceiver, discoveryFilter)

        val connectionFilter = IntentFilter().apply {
            addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION)
        }
        reactApplicationContext.registerReceiver(connectionReceiver, connectionFilter)

        // ---- Step 4: 开始设备发现 ----
        // 发现结果在 Step 1 的 BroadcastReceiver 中处理
        Log.i(TAG, "开始 P2P 设备发现")
        startDiscovery(mgr, channel!!, ::resolveError)

        // ---- Step 5: 超时兜底 ----
        // 如果 TIMEOUT_SECONDS 秒内没有连接成功，主动 reject
        Thread {
            try {
                if (!resolved.get()) {
                    Thread.sleep(TimeUnit.SECONDS.toMillis(TIMEOUT_SECONDS))
                }
            } catch (_: InterruptedException) {
                // 线程被中断，忽略
            }
            if (!resolved.get()) {
                Log.e(TAG, "P2P 连接超时 (${TIMEOUT_SECONDS}s)")
                resolveError("P2P_TIMEOUT", "WiFi P2P 连接超时 (${TIMEOUT_SECONDS}s)")
            }
        }.start()
    }

    /**
     * 开始 P2P 设备发现，失败时自动重试一次（reason=0 通常是框架 BUSY）。
     */
    private fun startDiscovery(
        mgr: WifiP2pManager,
        channel: WifiP2pManager.Channel,
        onError: (String, String) -> Unit
    ) {
        // 先停止任何正在进行的发现，避免 BUSY 状态
        mgr.stopPeerDiscovery(channel, object : WifiP2pManager.ActionListener {
            override fun onSuccess() { Log.d(TAG, "stopPeerDiscovery 完成") }
            override fun onFailure(reason: Int) { Log.d(TAG, "stopPeerDiscovery 失败（可忽略）: $reason") }
        })

        mgr.discoverPeers(channel, object : WifiP2pManager.ActionListener {
            override fun onSuccess() {
                Log.i(TAG, "P2P 设备发现已启动")
            }
            override fun onFailure(reason: Int) {
                Log.e(TAG, "discoverPeers 调用失败: reason=$reason")
                // reason=0 (BUSY)：等 2 秒后重试，某些设备需要更长时间释放资源
                if (reason == WifiP2pManager.BUSY) {
                    Log.i(TAG, "框架繁忙，2s 后重试 discoverPeers")
                    Thread {
                        try { Thread.sleep(2000) } catch (_: InterruptedException) {}
                        mgr.stopPeerDiscovery(channel, null)
                        Thread.sleep(300)
                        mgr.discoverPeers(channel, object : WifiP2pManager.ActionListener {
                            override fun onSuccess() {
                                Log.i(TAG, "P2P 设备发现重试成功")
                            }
                            override fun onFailure(retryReason: Int) {
                                Log.e(TAG, "discoverPeers 重试失败: reason=$retryReason")
                                onError("P2P_ERR", "发起 P2P 发现失败 (code=$retryReason)，请尝试关闭再开启 WiFi 后重试")
                            }
                        })
                    }.start()
                } else {
                    onError("P2P_ERR", "发起 P2P 发现失败 (code=$reason)")
                }
            }
        })
    }

    /**
     * 连接到指定的 P2P 设备。
     *
     * @param mgr      WifiP2pManager 实例
     * @param channel  P2P Channel
     * @param device   目标 P2P 设备
     * @param onError  连接失败时的回调（会 reject JS Promise）
     */
    private fun connectToDevice(
        mgr: WifiP2pManager,
        channel: WifiP2pManager.Channel,
        device: WifiP2pDevice,
        onError: (String, String) -> Unit
    ) {
        val config = WifiP2pConfig().apply {
            deviceAddress = device.deviceAddress
        }
        Log.i(TAG, "发起连接请求 → ${device.deviceName} (${device.deviceAddress})")
        mgr.connect(channel, config, object : WifiP2pManager.ActionListener {
            override fun onSuccess() {
                Log.i(TAG, "connect() 请求已发出，等待连接结果回调...")
                // 连接请求已发出，等待 connectionReceiver 回调结果
            }
            override fun onFailure(reason: Int) {
                // 连接请求本身失败（非超时），直接通知 JS 层
                Log.e(TAG, "connect() 调用失败: reason=$reason")
                onError("P2P_ERR", "P2P 设备连接失败 (code=$reason)")
            }
        })
    }

    /**
     * 检查 P2P 所需权限。
     *
     * Android 13+ (API 33)：NEARBY_WIFI_DEVICES 是危险权限，必须运行时授权。
     *   未授权时 discoverPeers() 返回失败（不是直接抛异常），表现为 BUSY 或空结果。
     * Android 6-12：需要 ACCESS_FINE_LOCATION 运行时授权。
     * Android 6 以下：无需运行时权限。
     */
    private fun hasLocationPermission(): Boolean {
        // Android 13+ (API 33)：检查 NEARBY_WIFI_DEVICES 权限
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return reactApplicationContext.checkSelfPermission(
                android.Manifest.permission.NEARBY_WIFI_DEVICES
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        }
        // Android 6-12：检查 ACCESS_FINE_LOCATION
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return reactApplicationContext.checkSelfPermission(
                android.Manifest.permission.ACCESS_FINE_LOCATION
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        }
        // Android 6 以下不需要运行时权限
        return true
    }

    /**
     * 断开 P2P 连接并移除 Group。
     *
     * JS 调用：WifiP2pModule.disconnect()
     */
    @ReactMethod
    fun disconnect(promise: Promise) {
        val mgr = manager
        if (mgr == null) {
            promise.reject("P2P_ERR", "WifiP2pManager 不可用，无法断开连接")
            return
        }
        val channel = mgr.initialize(reactApplicationContext, Looper.getMainLooper(), null)
        if (channel == null) {
            promise.reject("P2P_ERR", "P2P Channel 初始化失败，无法断开连接")
            return
        }
        Log.i(TAG, "移除 P2P Group")
        mgr.removeGroup(channel, object : WifiP2pManager.ActionListener {
            override fun onSuccess() {
                Log.i(TAG, "P2P Group 已移除")
                promise.resolve(true)
            }
            override fun onFailure(reason: Int) {
                Log.w(TAG, "移除 P2P Group 失败: reason=$reason")
                promise.resolve(true) // 即使失败也不报错，尽力而为
            }
        })
    }
}
