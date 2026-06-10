package com.nasapp

import android.content.Intent
import android.nfc.NfcAdapter
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.nasapp.modules.NfcModule

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "NasApp"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  /**
   * APP 在前台时碰 NFC 标签 → 前景调度 → onNewIntent
   *
   * NFC 冷启动自动唤起：当前 ROM 将 NDEF_DISCOVERED intent 降级为 MAIN + 丢弃数据。
   * 后续通过 enableReaderMode 绕过 intent 分发解决。
   */
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    if (NfcAdapter.ACTION_NDEF_DISCOVERED == intent.action ||
        NfcAdapter.ACTION_TAG_DISCOVERED == intent.action ||
        NfcAdapter.ACTION_TECH_DISCOVERED == intent.action) {
      try {
        reactNativeHost.reactInstanceManager.currentReactContext
          ?.getNativeModule(NfcModule::class.java)
          ?.onTagDiscovered(intent)
      } catch (_: Exception) {
        // New Architecture 下 reactNativeHost 可能不可用，忽略
      }
    }
  }
}
