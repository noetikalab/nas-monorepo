import {discover, type DiscoveredDevice} from '../native/MdnsModule';
import {connect as p2pConnect} from '../native/WifiP2pModule';
import {storage} from '../storage/local';

/** 连接阶段类型，供 UI 层显示进度 */
export type ConnPhase = 'mdns' | 'cache' | 'p2p' | 'connected';

/** 进度回调参数 */
export interface ConnProgress {
  phase: ConnPhase;       // 当前阶段
  subtitle?: string;      // 辅助文字（如设备名、IP）
  /** mDNS 发现多台设备时返回设备列表，UI 层据此决定是否弹选择页 */
  multipleDevices?: DiscoveredDevice[];
}

/**
 * 连接策略：按优先级依次尝试 mDNS → 缓存 IP ping → WiFi P2P。
 *
 * 三层降级设计：
 *   1. mDNS 局域网发现（1s）     — 有路由器时的最佳路径
 *   2. 缓存 IP ping 验证（2s）    — 上次用过，快速复用
 *   3. WiFi P2P 直连（3-10s）     — 无路由器时直连
 *
 * @param onProgress  可选进度回调，每进入一个新阶段时调用
 *   - 多设备场景：回调 `{ phase: 'mdns', multipleDevices: [...] }`，函数提前返回 null，
 *     由 UI 层跳转 DiscoveryScreen 让用户选择，选完后再次调用本函数继续
 * @returns NAS baseUrl，多设备场景返回 null
 * @throws 三层策略均失败时抛出错误
 */
export async function connectToNas(
  onProgress?: (p: ConnProgress) => void,
): Promise<string | null> {
  // 优先级 1：mDNS 局域网发现
  onProgress?.({phase: 'mdns', subtitle: '正在搜索局域网设备...'});
  try {
    const devices = await discover();
    if (devices.length > 1) {
      // 多台设备：通知 UI 层展示设备选择页面
      onProgress?.({phase: 'mdns', multipleDevices: devices});
      return null;
    }
    if (devices.length === 1) {
      const device = devices[0];
      onProgress?.({phase: 'mdns', subtitle: `发现 ${device.name}，校验中...`});
      const url = `http://${device.ip}:${device.port}`;
      // 先保存 URL，避免验证失败后缓存层用旧地址
      await storage.saveServerUrl(url);
      // USB 共享网络延迟高，6s 超时 + 失败后重试一次
      if (await tryPing(url, 6000)) {
        onProgress?.({phase: 'connected', subtitle: url});
        return url;
      }
      // 重试一次（网络抖动场景）
      if (await tryPing(url, 6000)) {
        onProgress?.({phase: 'connected', subtitle: url});
        return url;
      }
      // 两次都失败，放行到缓存层（URL 已保存，缓存层会直接命中）
    }
  } catch {
    // mDNS 失败不报错，静默降级
  }

  // 优先级 2：缓存 IP 快速 ping 验证（mDNS 层未发现设备时执行）
  const cached = await storage.getServerUrl();
  if (cached) {
    onProgress?.({phase: 'cache', subtitle: '验证缓存连接...'});
    if (await tryPing(cached, 4000)) {
      onProgress?.({phase: 'connected', subtitle: cached});
      return cached;
    }
  }

  // 优先级 3：WiFi P2P 直连（无路由器场景）
  onProgress?.({phase: 'p2p', subtitle: '正在建立 WiFi P2P 直连...'});
  // 微延迟让 UI 渲染 P2P 状态后再发起连接，避免 P2P 瞬时失败时 UI 跳过此阶段
  await new Promise<void>(r => { setTimeout(r, 50); });
  try {
    const {ip, port} = await p2pConnect();
    const url = `http://${ip}:${port}`;
    // 验证 NAS API 实际可达后再返回，避免连上不可用设备
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const ping = await fetch(`${url}/api/ping`, {signal: ctrl.signal});
    clearTimeout(t);
    if (!ping.ok) throw new Error('P2P 已连接但 NAS 服务不可达');
    await storage.saveServerUrl(url);
    onProgress?.({phase: 'connected', subtitle: url});
    return url;
  } catch (e) {
    // 透传原生模块的具体错误，不掩盖原因
    throw e;
  }
}

/** 对指定 URL 做 /api/ping 可达性探测，timeoutMs 毫秒超时，返回布尔值 */
async function tryPing(url: string, timeoutMs: number): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${url}/api/ping`, {signal: ctrl.signal});
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

/** @deprecated 使用 connectToNas() 替代 */
export async function discoverNas(): Promise<DiscoveredDevice[]> {
  return discover();
}
