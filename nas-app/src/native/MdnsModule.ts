import {NativeModules} from 'react-native';

export interface DiscoveredDevice {
  name: string; // "NAS-b827eb3a1c2d"
  ip: string;
  port: number;
}

const MdnsModule = NativeModules.MdnsModule;

export function discover(): Promise<DiscoveredDevice[]> {
  if (!MdnsModule) {
    return Promise.reject(new Error('MdnsModule not available on this platform'));
  }
  return MdnsModule.discover();
}
