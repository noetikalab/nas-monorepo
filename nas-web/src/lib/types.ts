/**
 * 共享 TypeScript 类型定义 — 与 Go 后端 DTO 结构一一对应
 * 文件：ldap-demo/authd/handler/dto.go
 */

// ============================================================
// Auth（对应 handler/dto.go 中的认证相关类型）
// ============================================================

export interface LoginRequest {
  username: string;
  password: string;
}

/** 登录响应，含 JWT token 和用户角色 */
export interface LoginResponse {
  token: string;
  /** 用户角色："admin" 可访问管理功能，"user" 仅文件操作 */
  role: "admin" | "user";
}

export interface RegisterRequest {
  username: string;
  password: string;
}

export interface RegisterResponse {
  token: string;
  uid: number;
  /** 注册后的角色，首个用户自动为 "admin" */
  role: "admin" | "user";
}

// ============================================================
// Dashboard（对应 DashboardStatsResponse / RecentEntry）
// ============================================================

/** 系统资源概览，Dashboard 统计卡片数据源 */
export interface DashboardStats {
  storage_used: number;
  storage_total: number;
  cpu_percent: number;
  mem_used: number;
  mem_total: number;
  uptime: number;
  device_count: number;
}

/** 最近文件操作记录 */
export interface RecentEntry {
  name: string;
  path: string;
  action: "upload" | "delete" | "mkdir" | "move" | "download";
  user: string;
  time: string;
  size: number;
}

// ============================================================
// Users（对应 UserEntry / UserListResponse）
// ============================================================

/** 用户条目，含 LDAP employeeType 角色 */
export interface UserEntry {
  username: string;
  uid: number;
  gid: number;
  home: string;
  /** 用户角色："admin" 或 "user" */
  role: "admin" | "user";
}

/** 用户列表 API 响应（后端返回 { users: UserEntry[] }） */
export interface UserListResponse {
  users: UserEntry[];
}

/** admin 创建用户的请求体 */
export interface CreateUserRequest {
  username: string;
  password: string;
  /** 角色，默认 "user" */
  role?: "admin" | "user";
}

/** admin 创建用户成功响应 */
export interface CreateUserResponse {
  ok: boolean;
  username: string;
  uid: number;
}

/** 单条 ACL 权限条目 */
export interface PermissionEntry {
  username: string;
  /** 权限："r-x"（只读）或 "rwx"（读写） */
  permission: "r-x" | "rwx";
}

/** ACL 权限列表响应 */
export interface PermissionListResponse {
  path: string;
  permissions: PermissionEntry[];
}

// ============================================================
// Files（对应 system/file.go 中的 FileInfo）
// ============================================================

/** 文件/目录信息 */
export interface FileInfo {
  name: string;
  size: number;
  type: "file" | "directory";
  modified: string;
  permission: string;
}

/** 文件列表响应 */
export interface FileListResponse {
  path: string;
  files: FileInfo[];
}

// ============================================================
// Services（对应 ServicesResponse / ServiceStatus）
// ============================================================

/** 单个服务状态 */
export interface ServiceStatus {
  running: boolean;
  port: number;
}

/** 所有服务状态 */
export interface ServicesResponse {
  smb: ServiceStatus;
  nfs: ServiceStatus;
  webdav: ServiceStatus;
}

// ============================================================
// Certified Operations / Proof（对应后端 CertifiedOperation / ProofBundle）
// ============================================================

/** 存证操作记录（对应 certified_operations 表全字段） */
export interface CertifiedOperation {
  id: number;
  timestamp: number;
  type: "file" | "auth" | "system";
  user_name: string;
  user_uid: number;
  action: string;
  path: string;
  dest_path?: string;
  detail?: string;
  file_name: string;
  is_dir: boolean;
  file_size: number;
  mime_type: string;
  owner_uid: number;
  owner_name: string;
  group_name: string;
  file_perm: string;
  mod_time: number;
  file_hash?: string;
  hash_algo: string;
}

/** 审计日志分页列表响应 */
export interface CertifiedOperationListResponse {
  entries: CertifiedOperation[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/** 单个存证哈希链记录 */
export interface ProofRecordResponse {
  cert_id: number;
  chain_index: number;
  prev_hash?: string;
  data_hash: string;
  signature?: string;
  device_uid?: string;
  sig_timestamp: number;
  hash_algo: string;
}

/** 存证详情（操作 + 哈希链） */
export interface ProofDetailResponse {
  operation: CertifiedOperation;
  proof_record: ProofRecordResponse;
}

/** 导出存证包 */
export interface ProofBundle {
  device_uid: string;
  pub_key: string;
  records: ProofRecordResponse[];
  operations: CertifiedOperation[];
  export_time: number;
  total_count: number;
}

// ============================================================
// API 通用响应
// ============================================================

/** 操作成功响应（含路径） */
export interface OKPathResponse {
  ok: boolean;
  path: string;
}

// ============================================================
// Device（对应 DeviceInfoResponse）
// ============================================================

/** 设备身份信息 */
export interface DeviceInfo {
  device_id: string;
  hostname: string;
  version: string;
}

// ============================================================
// Generic
// ============================================================

export interface OKResponse {
  ok: boolean;
}

export interface ErrorResponse {
  error: string;
}
