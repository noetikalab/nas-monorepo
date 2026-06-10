import {request} from './client';
import type {FileItem, ListFilesResponse, OkPathResponse, OkResponse} from '../types';

export const filesApi = {
  /** 列出目录。dirPath 为空时后端自动映射到用户根目录 */
  list: (dirPath?: string) =>
    request<ListFilesResponse>(
      `/files${dirPath ? `?path=${encodeURIComponent(dirPath)}` : ''}`,
    ),

  /** 新建目录 */
  mkdir: (path: string) =>
    request<OkPathResponse>('/files/mkdir', {
      method: 'POST',
      body: JSON.stringify({path}),
    }),

  /** 移动 / 重命名 */
  move: (from: string, to: string) =>
    request<OkResponse>('/files/move', {
      method: 'POST',
      body: JSON.stringify({from, to}),
    }),

  /** 删除文件或目录（递归） */
  remove: (path: string) =>
    request<OkResponse>(`/files?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    }),

  /**
   * 上传文件。
   *
   * @param dirPath  目标目录
   * @param file     文件对象，来自 react-native-document-picker
   */
  upload: async (
    dirPath: string,
    file: {uri: string; name: string; type: string},
  ): Promise<OkPathResponse> => {
    const form = new FormData();
    form.append('path', dirPath);
    form.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
    return request<OkPathResponse>('/files/upload', {
      method: 'POST',
      body: form,
    });
  },

  /** 获取文件下载 URL（GET /api/files/download?path=...），浏览器 / WebView 可直接访问 */
  getDownloadUrl: async (filePath: string): Promise<string> => {
    const {storage} = await import('../storage/local');
    const baseUrl = await storage.getServerUrl();
    const token = await storage.getToken();
    return `${baseUrl}/api/files/download?path=${encodeURIComponent(filePath)}&token=${encodeURIComponent(token || '')}`;
  },
};
