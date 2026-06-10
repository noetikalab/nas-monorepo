/**
 * 设备信息 API（公开，无需认证）
 */

import { api } from "@/lib/api";
import type { DeviceInfo } from "@/lib/types";

export const deviceApi = {
  info: () =>
    api.get<DeviceInfo>("/device-info"),
};
