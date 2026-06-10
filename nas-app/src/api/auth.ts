import type {AuthResponse, LoginRequest, RegisterResponse} from '../types';
import {request} from './client';

export const authApi = {
  /** 连通性测试 */
  ping: () => request<{ok: boolean}>('/ping', {method: 'GET'}),

  /** 登录，返回 JWT token + 角色 */
  login: (data: LoginRequest) =>
    request<AuthResponse>('/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 注册，返回 JWT token + UID + 角色 */
  register: (data: LoginRequest) =>
    request<RegisterResponse>('/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 验证 JWT 是否有效（自动注入 Authorization 头） */
  validateToken: () =>
    request<{valid: boolean; username: string}>('/validate-token'),

  /** NFC 碰一碰登录（首次碰或未绑定时调用） */
  nfcLogin: (deviceId: string, phoneId: string) =>
    request<{token: string; username: string; role: string} | {need_bind: true}>('/nfc-login', {
      method: 'POST',
      body: JSON.stringify({device_id: deviceId, phone_id: phoneId}),
    }),

  /** NFC 碰一碰首次绑定（绑定 phone_id 到用户） */
  nfcBind: (deviceId: string, phoneId: string, username: string, password: string) =>
    request<{token: string; username: string; role: string}>('/nfc-bind', {
      method: 'POST',
      body: JSON.stringify({device_id: deviceId, phone_id: phoneId, username, password}),
    }),
};
