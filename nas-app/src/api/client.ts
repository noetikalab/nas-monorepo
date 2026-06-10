import {storage} from '../storage/local';

/**
 * 共享 HTTP 请求函数。
 *
 * 自动注入 JWT Authorization 头（从 AsyncStorage 读取），统一拼接 /api/ 前缀。
 * multipart/form-data 时不设 Content-Type（由 RN 自动生成 boundary）。
 * 401 响应时自动清除本地认证信息（logout）。
 *
 * @param path      API 路径（不含 /api/ 前缀），如 '/files'
 * @param options   fetch RequestInit
 * @param timeoutMs 超时毫秒数，默认 8000
 */
export async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 8000,
): Promise<T> {
  const baseUrl = await storage.getServerUrl();
  const token = await storage.getToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  // multipart 时不设 Content-Type，让 RN 自动加 boundary
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(`${baseUrl}/api${path}`, {
      headers,
      signal: controller.signal,
      ...options,
    });

    if (res.status === 401) {
      await storage.clearAuth();
      throw new Error('认证已过期，请重新登录');
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}
