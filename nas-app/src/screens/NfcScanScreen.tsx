import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {connectToNas} from '../network/connector';
import {getDeviceInfo} from '../api/device';
import {authApi} from '../api/auth';
import {readNdef, getPhoneId} from '../native/NfcModule';
import {storage} from '../storage/local';
import type {RootStackParamList} from '../navigation';
import {c} from '../theme/tokens';
import {shared} from '../theme/shared';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'NfcScan'>;
};

/** NFC 碰一碰登录的状态机 */
type NfcPhase =
  | 'idle'        // 等待用户碰标签
  | 'connecting'  // connectToNas() 中
  | 'verifying'   // 校验设备身份
  | 'login'       // nfcLogin / nfcBind
  | 'error';       // 错误

export function NfcScanScreen({navigation}: Props) {
  const [phase, setPhase] = useState<NfcPhase>('idle');
  const [statusText, setStatusText] = useState('请贴近 NAS 的 NFC 标签');
  const [errorMsg, setErrorMsg] = useState('');

  // 首次碰需要绑定时弹出的密码框
  const [bindVisible, setBindVisible] = useState(false);
  const [bindUsername, setBindUsername] = useState('');
  const [bindPassword, setBindPassword] = useState('');
  const bindRef = useRef<{resolve: () => void; reject: () => void} | null>(null);

  // 页面打开即开始等待 NFC
  useEffect(() => {
    handleNfcLogin();
  }, []);

  async function handleNfcLogin() {
    try {
      // ① 等待用户碰 NFC 标签
      setPhase('idle');

      // ② 读取标签
      const {device_id} = await readNdef();
      setPhase('connecting');
      setStatusText(`已读取标签 ${device_id}`);

      // ③ 建立网络连接（三层降级）
      setPhase('connecting');
      setStatusText('正在连接 NAS...');
      const baseUrl = await connectToNas();
      if (!baseUrl) {
        setPhase('error');
        setErrorMsg('发现多台 NAS 设备，请手动选择');
        return;
      }

      // ④ 校验设备身份
      setPhase('verifying');
      setStatusText('校验设备身份...');
      const info = await getDeviceInfo(baseUrl);
      if (info.device_id !== device_id) {
        setPhase('error');
        setErrorMsg('这不是你想连接的那台 NAS，请确认标签和设备匹配');
        return;
      }

      // ⑤ NFC 登录
      setPhase('login');
      setStatusText('登录中...');
      const phoneId = await getPhoneId();
      const result = await authApi.nfcLogin(device_id, phoneId);

      if ('need_bind' in result) {
        // 首次碰：需要用户输入密码绑定
        await handleFirstBind(device_id, phoneId);
      } else {
        // 已绑定：直接登录
        await storage.saveAuth(result.token, result.username);
        navigation.replace('Home');
      }
    } catch (e: any) {
      if (e?.code === 'NFC_ERR') {
        // NFC 特定错误（设备不支持、NFC 未开启、标签格式不对等）
        setPhase('error');
        setErrorMsg(e.message);
      } else if (e?.message === '认证已过期，请重新登录') {
        setPhase('error');
        setErrorMsg('登录状态异常，请重试');
      } else {
        setPhase('error');
        setErrorMsg(e.message || '连接失败，请检查 NAS 是否开机');
      }
    }
  }

  /** 首次碰：弹出密码框，绑定 phone_id 到用户 */
  function handleFirstBind(deviceId: string, phoneId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      bindRef.current = {
        resolve: async () => {
          setBindVisible(false);
          try {
            const result = await authApi.nfcBind(
              deviceId, phoneId, bindUsername.trim(), bindPassword,
            );
            await storage.saveAuth(result.token, result.username);
            navigation.replace('Home');
            resolve();
          } catch (e: any) {
            reject(new Error('绑定失败'));
          }
        },
        reject: () => {
          setBindVisible(false);
          reject(new Error('用户取消'));
        },
      };
      setBindVisible(true);
    });
  }

  /** 重试 */
  function retry() {
    setPhase('idle');
    setErrorMsg('');
    handleNfcLogin();
  }

  return (
    <View style={styles.root}>
      {/* 状态区 */}
      {phase === 'idle' && (
        <>
          <View style={styles.nfcRing}>
            <View style={styles.nfcRingInner} />
          </View>
          <Text style={styles.phaseText}>{statusText}</Text>
          <Text style={styles.hint}>将手机背面贴近 NAS 的 NFC 标签</Text>
        </>
      )}

      {(phase === 'connecting' || phase === 'verifying' || phase === 'login') && (
        <>
          <ActivityIndicator size="large" color={c.foreground} />
          <Text style={styles.phaseText}>{statusText}</Text>
        </>
      )}

      {phase === 'error' && (
        <>
          <Text style={styles.phaseText}>连接失败</Text>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={shared.emptyBtn} onPress={retry}>
            <Text style={shared.emptyBtnText}>重试</Text>
          </TouchableOpacity>
        </>
      )}

      {/* 首次绑定的密码输入框 Modal */}
      <Modal visible={bindVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => bindRef.current?.reject()}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>首次绑定</Text>
            <Text style={[shared.subtitle, {marginBottom: 16}]}>
              首次碰一碰需要输入账号密码，绑定后下次自动登录
            </Text>
            <Text style={shared.label}>用户名</Text>
            <TextInput
              style={[shared.input, styles.modalInput]}
              placeholder="请输入用户名"
              placeholderTextColor={c.mutedForeground}
              autoCapitalize="none"
              value={bindUsername}
              onChangeText={setBindUsername}
            />
            <Text style={shared.label}>密码</Text>
            <TextInput
              style={[shared.input, styles.modalInput]}
              placeholder="请输入密码"
              placeholderTextColor={c.mutedForeground}
              secureTextEntry
              value={bindPassword}
              onChangeText={setBindPassword}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
          onPress={() => bindRef.current?.reject()}> 
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => bindRef.current?.resolve()}>
                <Text style={styles.modalConfirmText}>绑定并登录</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.background,
    paddingHorizontal: 40,
  },
  nfcRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: c.foreground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  nfcRingInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: c.primary,
  },
  phaseText: {
    fontSize: 17,
    fontWeight: '600',
    color: c.foreground,
    marginTop: 12,
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    color: c.mutedForeground,
    marginTop: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: c.destructive,
    marginTop: 8,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  modalCard: {
    backgroundColor: c.background,
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {fontSize: 17, fontWeight: '600', color: c.foreground, marginBottom: 8},
  modalInput: {marginBottom: 12},
  modalActions: {flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4},
  modalCancelBtn: {paddingHorizontal: 16, paddingVertical: 10},
  modalCancelText: {fontSize: 15, color: c.mutedForeground},
  modalConfirmBtn: {
    backgroundColor: c.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalConfirmText: {color: '#FFFFFF', fontSize: 15, fontWeight: '600'},
});
