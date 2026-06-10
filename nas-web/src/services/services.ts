/**
 * 服务状态 API（admin only）
 */

import { api } from "@/lib/api";
import type { ServicesResponse } from "@/lib/types";

export const servicesApi = {
  list: () =>
    api.get<ServicesResponse>("/services"),
};
