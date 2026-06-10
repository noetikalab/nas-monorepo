package com.nasapp.modules

import android.app.PendingIntent
import android.content.Intent
import android.content.IntentFilter
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.Ndef
import android.os.Build
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap

/**
 * Android NFC 原生模块。
 *
 * 功能：
 *   - readNdef()：前景调度读取 NFC 标签上的 NDEF 文本记录，返回 device_id
 *   - getPhoneId()：读取 Android 设备硬件 ID（Settings.Secure.ANDROID_ID）
 *   - writeNdef()：写入 AAR + device_id 到 NFC 标签（后续 DevSettings 用）
 *
 * 唤起方式：
 *   - APP 在前台时：NfcScanScreen → readNdef() → 前景调度 → 碰标签 → onNewIntent
 *   - 冷启动：当前 ROM 将 NDEF_DISCOVERED intent 降级为 MAIN + 丢弃数据，
 *     后续通过 enableReaderMode 绕过 intent 分发解决
 */
class NfcModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NfcModule"

    companion object {
        private const val TAG = "NfcModule"
    }

    private val nfcAdapter: NfcAdapter? =
        NfcAdapter.getDefaultAdapter(reactContext)

    /** 等待 readNdef() 结果的 pending Promise */
    var pendingReadPromise: Promise? = null

    /**
     * 读取 NFC 标签上的 NDEF 文本记录。
     *
     * JS 调用：NfcModule.readNdef() → Promise<{ device_id: string }>
     *
     * 调用后启用前景调度，等待用户碰标签。
     * 用户碰标签时 → MainActivity.onNewIntent() → onTagDiscovered() → 解析 NDEF → resolve Promise。
     */
    @ReactMethod
    fun readNdef(promise: Promise) {
        val adapter = nfcAdapter
        if (adapter == null) {
            Log.w(TAG, "设备不支持 NFC")
            promise.reject("NFC_ERR", "此设备不支持 NFC")
            return
        }
        if (!adapter.isEnabled) {
            Log.w(TAG, "NFC 未开启")
            promise.reject("NFC_ERR", "请先在系统设置中开启 NFC")
            return
        }

        // 启用前景调度：APP 在前台时碰标签 → onNewIntent() 接收
        pendingReadPromise = promise
        enableForegroundDispatch(adapter)
        Log.i(TAG, "前景调度已启用，等待 NFC 标签...")
    }

    /**
     * 读取 Android 设备硬件 ID。
     *
     * ANDROID_ID 是 64 位 hex 字符串，每台设备 + 每个 APP 签名唯一。
     * 不需要任何权限，API 2.2+ 可用。
     */
    @ReactMethod
    fun getPhoneId(promise: Promise) {
        try {
            val id = Settings.Secure.getString(
                reactApplicationContext.contentResolver,
                Settings.Secure.ANDROID_ID
            )
            Log.i(TAG, "phone_id: $id")
            promise.resolve(id)
        } catch (e: Exception) {
            Log.e(TAG, "获取 phone_id 失败: ${e.message}")
            promise.reject("NFC_ERR", "无法获取设备标识")
        }
    }

    /**
     * 写入 AAR + device_id 到 NFC 标签。
     *
     * JS 调用：NfcModule.writeNdef(deviceId) → Promise<boolean>
     */
    @ReactMethod
    fun writeNdef(deviceId: String, promise: Promise) {
        val adapter = nfcAdapter
        if (adapter == null) {
            promise.reject("NFC_ERR", "此设备不支持 NFC")
            return
        }
        if (!adapter.isEnabled) {
            promise.reject("NFC_ERR", "请先在系统设置中开启 NFC")
            return
        }
        Log.i(TAG, "writeNdef 待实现，deviceId=$deviceId")
        promise.reject("NFC_ERR", "写入功能开发中")
    }

    /**
     * 由 MainActivity.onTagDiscovered() 调用（前景调度）。
     * 解析 NDEF 消息 → 提取文本记录 → resolve readNdef() 的 Promise。
     *
     * NFC 冷启动自动唤起：当前 ROM 将 NDEF_DISCOVERED intent 降级为 MAIN + 丢弃数据，
     * 此方法在冷启动场景不会被调到。后续通过 enableReaderMode 解决。
     */
    fun onTagDiscovered(intent: Intent) {
        val promise = pendingReadPromise
        if (promise == null) {
            Log.d(TAG, "收到 NFC intent 但没有 pending Promise，忽略")
            return
        }
        pendingReadPromise = null

        val tag: Tag? = if (Build.VERSION.SDK_INT >= 33) {
            intent.getParcelableExtra(NfcAdapter.EXTRA_TAG, Tag::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(NfcAdapter.EXTRA_TAG)
        }
        if (tag == null) {
            Log.w(TAG, "NFC intent 中没有 Tag 对象")
            promise.reject("NFC_ERR", "未检测到 NFC 标签")
            return
        }

        try {
            val ndef = Ndef.get(tag)
            if (ndef == null) {
                Log.w(TAG, "标签不是 NDEF 格式")
                promise.reject("NFC_ERR", "标签不支持 NDEF，请使用 NDEF 格式的标签")
                return
            }
            ndef.connect()
            val ndefMessage = ndef.ndefMessage
            ndef.close()

            for (record in ndefMessage.records) {
                val payload = record.payload
                if (record.tnf == android.nfc.NdefRecord.TNF_WELL_KNOWN &&
                    record.type.contentEquals(android.nfc.NdefRecord.RTD_TEXT)) {
                    val langLen = payload[0].toInt() and 0x3F
                    val text = String(payload, langLen + 1, payload.size - langLen - 1,
                        Charsets.UTF_8).trim()
                    Log.i(TAG, "读到 device_id: $text")
                    val map = WritableNativeMap().apply {
                        putString("device_id", text)
                    }
                    promise.resolve(map)
                    return
                }
            }
            Log.w(TAG, "标签上没有文本记录")
            promise.reject("NFC_ERR", "标签上没有找到 device_id，请确认标签已正确写入")
        } catch (e: Exception) {
            Log.e(TAG, "读取 NDEF 失败: ${e.message}")
            promise.reject("NFC_ERR", "读取标签失败: ${e.message}")
        }
    }

    /**
     * 启用前景调度——APP 在前台时，NFC intent 直接发给 onNewIntent()，
     * 不弹出系统 NFC 选择器。
     */
    private fun enableForegroundDispatch(adapter: NfcAdapter) {
        val activity = reactApplicationContext.currentActivity ?: return
        val intent = Intent(activity, activity.javaClass).apply {
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val pendingIntent = PendingIntent.getActivity(
            activity, 0, intent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            else PendingIntent.FLAG_UPDATE_CURRENT
        )
        val filters = arrayOf(
            IntentFilter(NfcAdapter.ACTION_NDEF_DISCOVERED),
            IntentFilter(NfcAdapter.ACTION_TAG_DISCOVERED),
            IntentFilter(NfcAdapter.ACTION_TECH_DISCOVERED)
        )
        val techLists = arrayOf(
            arrayOf("android.nfc.tech.Ndef"),
            arrayOf("android.nfc.tech.NdefFormatable")
        )
        adapter.enableForegroundDispatch(activity, pendingIntent, filters, techLists)
    }
}
