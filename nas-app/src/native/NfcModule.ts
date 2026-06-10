import {NativeModules} from 'react-native';

const NfcModule = NativeModules.NfcModule;

/** NFC 标签读取结果 */
export interface NfcPayload {
  /** NAS 设备的唯一标识，从 NFC 标签文本记录中读取 */
  device_id: string;
}

/**
 * 读取 NFC 标签上的 NDEF 文本记录。
 *
 * 调用后启用前景调度，等待手机碰标签。
 * 两种唤起路径均支持：
 *   1. APP 在前台 → 前景调度读取
 *   2. APP 未打开 → AAR 自动唤起 → TAG_DISCOVERED intent
 *
 * @returns Promise<NfcPayload> 标签上的 device_id
 */
export function readNdef(): Promise<NfcPayload> {
  if (!NfcModule) {
    return Promise.reject(new Error('NFC 模块不可用'));
  }
  return NfcModule.readNdef();
}

/**
 * 获取 Android 设备硬件标识。
 *
 * 基于 Settings.Secure.ANDROID_ID，不需要任何权限。
 * 每台设备 + 每个 APP 签名唯一，APP 卸载重装也不变。
 *
 * @returns Promise<string> 64 位 hex 字符串
 */
export function getPhoneId(): Promise<string> {
  if (!NfcModule) {
    return Promise.reject(new Error('NFC 模块不可用'));
  }
  return NfcModule.getPhoneId();
}

/**
 * 写入 AAR + device_id 到 NFC 标签。
 *
 * @param deviceId NAS 设备标识
 * @returns Promise<boolean>
 */
export function writeNdef(deviceId: string): Promise<boolean> {
  if (!NfcModule) {
    return Promise.reject(new Error('NFC 模块不可用'));
  }
  return NfcModule.writeNdef(deviceId);
}
