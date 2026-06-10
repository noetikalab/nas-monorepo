package com.nasapp.modules

import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executor
import java.util.concurrent.TimeUnit

class MdnsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "MdnsModule"

    private val nsdManager: NsdManager? by lazy {
        reactContext.getSystemService(android.content.Context.NSD_SERVICE) as? NsdManager
    }

    @ReactMethod
    fun discover(promise: Promise) {
        val nsd = nsdManager
        if (nsd == null) {
            Log.e(TAG, "NsdManager not available")
            promise.reject("MDSN_ERR", "NsdManager not available on this device")
            return
        }

        val results = ConcurrentLinkedQueue<WritableNativeMap>()
        val latch = CountDownLatch(1)

        fun addResult(serviceInfo: NsdServiceInfo) {
            val ip = serviceInfo.host?.hostAddress ?: ""
            Log.i(TAG, "addResult: name=${serviceInfo.serviceName} ip=$ip port=${serviceInfo.port}")
            if (ip.isNotEmpty()) {
                val map = WritableNativeMap()
                map.putString("name", serviceInfo.serviceName)
                map.putString("ip", ip)
                map.putInt("port", serviceInfo.port)
                results.add(map)
            }
        }

        val discoveryListener = object : NsdManager.DiscoveryListener {
            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                Log.e(TAG, "onStartDiscoveryFailed: type=$serviceType error=$errorCode")
                latch.countDown()
            }

            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {
                Log.e(TAG, "onStopDiscoveryFailed: type=$serviceType error=$errorCode")
            }

            override fun onDiscoveryStarted(serviceType: String) {
                Log.i(TAG, "onDiscoveryStarted: type=$serviceType")
            }

            override fun onDiscoveryStopped(serviceType: String) {
                Log.i(TAG, "onDiscoveryStopped: type=$serviceType")
                latch.countDown()
            }

            override fun onServiceLost(service: NsdServiceInfo) {
                Log.i(TAG, "onServiceLost: name=${service.serviceName}")
            }

            override fun onServiceFound(service: NsdServiceInfo) {
                Log.i(TAG, "onServiceFound: type=${service.serviceType} name=${service.serviceName}")
                Log.i(TAG, "  host=${service.host} port=${service.port} network=${service.network}")
                Log.i(TAG, "  hostAddresses=${service.hostAddresses} attributes=${service.attributes}")
                if (service.serviceType.removeSuffix(".") != SERVICE_TYPE) {
                    Log.d(TAG, "  skipping serviceType=${service.serviceType}")
                    return
                }

                if (Build.VERSION.SDK_INT >= 34) {
                    val mainExecutor = reactApplicationContext.mainExecutor
                    Log.i(TAG, "  calling resolveService with mainExecutor")
                    nsd.resolveService(service, mainExecutor, object : NsdManager.ResolveListener {
                        override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                            Log.e(TAG, "onResolveFailed: name=${serviceInfo.serviceName} error=$errorCode")
                        }

                        override fun onServiceResolved(serviceInfo: NsdServiceInfo) {
                            Log.i(TAG, "onServiceResolved: host=${serviceInfo.host} port=${serviceInfo.port}")
                            addResult(serviceInfo)
                        }
                    })
                } else {
                    @Suppress("DEPRECATION")
                    nsd.resolveService(service, object : NsdManager.ResolveListener {
                        override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                            Log.e(TAG, "onResolveFailed: name=${serviceInfo.serviceName} error=$errorCode")
                        }

                        override fun onServiceResolved(serviceInfo: NsdServiceInfo) {
                            Log.i(TAG, "onServiceResolved: host=${serviceInfo.host} port=${serviceInfo.port}")
                            addResult(serviceInfo)
                        }
                    })
                }
            }
        }

        Log.i(TAG, "Starting discovery for $SERVICE_TYPE")
        nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discoveryListener)

        Thread {
            try {
                latch.await(TIMEOUT_MS, TimeUnit.MILLISECONDS)
            } finally {
                try { nsd.stopServiceDiscovery(discoveryListener) } catch (_: Exception) {}
                val array: WritableArray = WritableNativeArray()
                for (item in results) {
                    array.pushMap(item)
                }
                Log.i(TAG, "Discovery finished: ${results.size} devices found")
                promise.resolve(array)
            }
        }.start()
    }

    companion object {
        private const val TAG = "MdnsModule"
        private const val SERVICE_TYPE = "_nas._tcp"
        private const val TIMEOUT_MS = 5000L
    }
}
