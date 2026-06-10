/**
 * NAS Web — 统一 API 服务导出
 *
 * 所有后端接口调用集中在此，组件只需 import { xxxApi } from "@/services" 即可。
 *
 * 模块划分：
 *   auth      — 登录 / 注册 / 验证 token
 *   files     — 文件操作（列表/上传/下载/删除/重命名/建目录）
 *   dashboard — 系统概览
 *   users     — 用户管理（admin only）
 *   logs      — 审计日志（admin only）
 *   services  — 服务状态（admin only）
 *   device    — 设备信息（公开）
 */

export { authApi } from "./auth";
export { filesApi } from "./files";
export { dashboardApi } from "./dashboard";
export { usersApi } from "./users";
export { logsApi } from "./logs";
export { servicesApi } from "./services";
export { deviceApi } from "./device";
