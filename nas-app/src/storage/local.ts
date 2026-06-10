import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  TOKEN: 'jwt_token',
  USERNAME: 'username',
  SERVER_URL: 'server_url',
};

const DEFAULT_SERVER_URL = 'http://10.106.26.92:8080';

export const storage = {
  saveAuth: (token: string, username: string) =>
    AsyncStorage.multiSet([[KEYS.TOKEN, token], [KEYS.USERNAME, username]]),

  getToken: () => AsyncStorage.getItem(KEYS.TOKEN),

  getUsername: () => AsyncStorage.getItem(KEYS.USERNAME),

  clearAuth: () => AsyncStorage.multiRemove([KEYS.TOKEN, KEYS.USERNAME]),

  getServerUrl: async () =>
    (await AsyncStorage.getItem(KEYS.SERVER_URL)) ?? DEFAULT_SERVER_URL,

  saveServerUrl: (url: string) => AsyncStorage.setItem(KEYS.SERVER_URL, url),

  /** 获取设备硬件标识（ANDROID_ID，不需要权限）。NFC 模块不可用时回退 AsyncStorage UUID */
  getPhoneId: async (): Promise<string> => {
    try {
      const {getPhoneId: nativeGetPhoneId} = await import('../native/NfcModule');
      return nativeGetPhoneId();
    } catch {
      let id = await AsyncStorage.getItem('phone_id');
      if (!id) {
        id = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        await AsyncStorage.setItem('phone_id', id);
      }
      return id;
    }
  },
};
