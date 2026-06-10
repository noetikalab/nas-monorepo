import {NativeModules} from 'react-native';

/** WiFi P2P 连接成功后返回的 GO 信息 */
export interface P2pConnectionResult {
  /** Group Owner 的 IP 地址，通常为 192.168.49.1 */
  ip: string;
  /** NAS authd 服务端口，固定 8080 */
  port: number;
}

const WifiP2pModule = NativeModules.WifiP2pModule;

/**
 * 发起 WiFi P2P 连接，发现并连接到 NAS 的 Group Owner。
 *
 * Android 原生模块 WifiP2pModule.connect() 的 JS 封装。
 * 内部自动处理设备发现、连接、超时。30s 超时返回 P2P_TIMEOUT 错误。
 *
 * @returns Promise<P2pConnectionResult> 连接成功后返回 GO 的 { ip, port }
 * @throws 设备不支持 P2P、无定位权限、未发现设备、连接超时等
 */
export function connect(): Promise<P2pConnectionResult> {
  if (!WifiP2pModule) {
    return Promise.reject(new Error('WifiP2pModule 在此平台不可用'));
  }
  return WifiP2pModule.connect();
}

/**
 * 断开当前 P2P 连接。
 * 通常在退出 APP 或切换连接方式时调用。
 */
export function disconnect(): Promise<boolean> {
  if (!WifiP2pModule) {
    return Promise.reject(new Error('WifiP2pModule 在此平台不可用'));
  }
  return WifiP2pModule.disconnect();
}
