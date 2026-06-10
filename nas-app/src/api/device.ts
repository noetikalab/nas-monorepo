import type {DeviceInfo} from '../types';
import {request} from './client';

/** 获取 NAS 设备信息（公开接口，无需 JWT） */
export function getDeviceInfo(baseUrl: string): Promise<DeviceInfo> {
  return fetch(`${baseUrl}/api/device-info`).then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });
}
