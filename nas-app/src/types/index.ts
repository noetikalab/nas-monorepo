/** 用户信息（本地持久化） */
export interface User {
  username: string;
  token: string;
  role: 'admin' | 'user';
}

/** 登录请求 */
export interface LoginRequest {
  username: string;
  password: string;
}

/** 登录 / 注册响应（后端 LoginResponse / RegisterResponse） */
export interface AuthResponse {
  token: string;
  role: 'admin' | 'user';
}

/** 注册响应额外包含 uid */
export interface RegisterResponse extends AuthResponse {
  uid: number;
}

/** 文件 / 目录信息（后端 system.FileInfo） */
export interface FileItem {
  name: string;           // 文件或目录名
  size: number;           // 字节，目录为 0
  type: 'file' | 'directory';
  modified: string;       // ISO 时间
  permission: string;     // owner 权限位，如 "rwx"、"rw-"、"r--"
}

/** 列目录响应 */
export interface ListFilesResponse {
  path: string;           // 当前目录的绝对路径
  files: FileItem[];
}

/** 通用成功响应 */
export interface OkResponse {
  ok: boolean;
}

/** 带路径的成功响应（upload / mkdir） */
export interface OkPathResponse {
  ok: boolean;
  path: string;
}

/** 设备信息 */
export interface DeviceInfo {
  device_id: string;
  hostname: string;
  version: string;
}

/** 新建目录请求 */
export interface MkdirRequest {
  path: string;
}

/** 移动文件请求 */
export interface MoveFileRequest {
  from: string;
  to: string;
}
