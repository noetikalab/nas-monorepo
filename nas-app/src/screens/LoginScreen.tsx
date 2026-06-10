import React, {useCallback, useRef, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {authApi} from '../api/auth';
import {storage} from '../storage/local';
import {connectToNas, type ConnProgress} from '../network/connector';
import type {RootStackParamList} from '../navigation';
import {c} from '../theme/tokens';
import {shared} from '../theme/shared';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

/**
 * Server bar 连接状态，在 connector.ConnPhase 基础上增加 UI 特有状态：
 *   idle / failed  —— 静止态
 *   mdns / cache / p2p / connected —— 对应 connectToNas 的三层降级
 */
type BarPhase = ConnProgress['phase'] | 'idle' | 'failed';

/** 各阶段对应的 Server bar 主文字 */
const PHASE_LABEL: Record<BarPhase, string> = {
  idle:      '',
  mdns:      '搜索局域网设备...',
  cache:     '验证缓存连接...',
  p2p:       'WiFi P2P 直连...',
  connected: '',
  failed:    '连接失败',
};

/** 各阶段对应的 Server bar 辅助文字（null 表示使用已有 subtitle） */
const PHASE_HINT: Record<BarPhase, string> = {
  idle:      '点击搜索设备',
  mdns:      '正在搜索局域网设备...',
  cache:     '尝试验证上次连接地址',
  p2p:       '无路由器，直连 NAS',
  connected: '连接正常',
  failed:    '点击重试',
};

export function LoginScreen({navigation}: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState('');
  const [barPhase, setBarPhase] = useState<BarPhase>('idle');
  const [barSubtitle, setBarSubtitle] = useState('');

  const connectingRef = useRef(false);

  // 每次页面获得焦点时：读取缓存地址 + 尝试自动登录
  useFocusEffect(
    useCallback(() => {
      storage.getServerUrl().then(url => {
        const val = url || '';
        setServerUrl(val);
        if (val) {
          setBarPhase('idle');
          setBarSubtitle('');
        }
      });
      // 已有 token → 尝试验证，有效则跳过登录直接进主页
      storage.getToken().then(async token => {
        if (!token) return;
        try {
          await authApi.validateToken();
          navigation.replace('Home');
        } catch {
          // token 过期或无效，留在登录页让用户重新登录
        }
      });
    }, [navigation]),
  );

  /** 点击 Server bar：触发三层连接策略 */
  async function handleConnect() {
    if (connectingRef.current) return;
    connectingRef.current = true;

    try {
      const url = await connectToNas((progress: ConnProgress) => {
        // 多设备场景：跳 DiscoveryScreen 让用户选择，中断当前连接流程
        if (progress.multipleDevices) {
          connectingRef.current = false;
          navigation.navigate('Discovery');
          return;
        }
        setBarPhase(progress.phase);
        if (progress.subtitle && progress.phase !== 'connected') {
          setBarSubtitle(progress.subtitle);
        }
      });

      if (url) {
        // 单设备自动连接成功
        setServerUrl(url);
        setBarPhase('connected');
        setBarSubtitle(url);
      }
    } catch (e: any) {
      const msg = e?.message || '无法连接到 NAS';
      setBarPhase('failed');
      setBarSubtitle('');
      Alert.alert('连接失败', msg);
    } finally {
      if (barPhase !== 'connected') {
        connectingRef.current = false;
      }
    }
  }

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('提示', '请输入用户名和密码');
      return;
    }
    setLoading(true);
    try {
      const fn = isRegister ? authApi.register : authApi.login;
      const res = await fn({username: username.trim(), password});
      await storage.saveAuth(res.token, username.trim());
      navigation.replace('Home');
    } catch (e: any) {
      Alert.alert('登录失败', e.message ?? '请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  // 根据阶段确定 Server bar 标题（默认显示 serverUrl，连接中显示阶段文字）
  const labelText = barPhase === 'idle'
    ? serverUrl || '搜索局域网设备'
    : barPhase === 'connected'
      ? serverUrl
      : PHASE_LABEL[barPhase];

  // 根据阶段确定 Server bar 辅助文字
  const hintText = barPhase === 'idle'
    ? serverUrl ? PHASE_HINT.idle : '连接到 NAS 后方可登录'
    : barPhase === 'connected'
      ? barSubtitle || PHASE_HINT.connected
      : barSubtitle || PHASE_HINT[barPhase];

  const isBusy = barPhase !== 'idle' && barPhase !== 'connected' && barPhase !== 'failed';

  return (
    <KeyboardAvoidingView
      style={shared.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[shared.centered, styles.card]}>
        {/* Server connection bar */}
        <TouchableOpacity
          style={[
            styles.serverBar,
            barPhase === 'connected' && shared.statusOk,
            barPhase === 'failed' && shared.statusFail,
          ]}
          onPress={handleConnect}
          onLongPress={() => navigation.navigate('DevSettings')}
          activeOpacity={0.7}>
          {/* 左侧状态指示器 */}
          <View
            style={[
              styles.statusDot,
              barPhase === 'connected' && shared.statusOk,
              barPhase === 'failed' && shared.statusFail,
            ]}>
            {isBusy ? (
              <ActivityIndicator size="small" color={c.foreground} />
            ) : (
              <Text style={styles.statusDotText}>
                {barPhase === 'connected' ? '✓' : barPhase === 'failed' ? '✗' : '⚡'}
              </Text>
            )}
          </View>

          {/* 中间状态文字 */}
          <View style={styles.serverContent}>
            <View style={styles.serverTextArea}>
              <Text style={styles.serverLabel} numberOfLines={1}>{labelText}</Text>
              <Text style={shared.subtitle} numberOfLines={1}>{hintText}</Text>
            </View>
            <Text style={styles.serverArrow}>›</Text>
          </View>
        </TouchableOpacity>

        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoIconText}>N</Text>
          </View>
          <Text style={shared.title}>NAS</Text>
          <Text style={[shared.subtitle, styles.logoSub]}>私有云存储</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, !isRegister && styles.tabActive]}
            onPress={() => setIsRegister(false)}>
            <Text style={[styles.tabText, !isRegister && styles.tabTextActive]}>登录</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, isRegister && styles.tabActive]}
            onPress={() => setIsRegister(true)}>
            <Text style={[styles.tabText, isRegister && styles.tabTextActive]}>注册</Text>
          </TouchableOpacity>
        </View>

        {/* Fields */}
        <View style={styles.form}>
          <View>
            <Text style={shared.label}>用户名</Text>
            <TextInput
              style={[shared.input, focusedField === 'username' && styles.inputFocus]}
              placeholder="请输入用户名"
              placeholderTextColor={c.mutedForeground}
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
              onFocus={() => setFocusedField('username')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          <View>
            <Text style={shared.label}>密码</Text>
            <TextInput
              style={[shared.input, focusedField === 'password' && styles.inputFocus]}
              placeholder="请输入密码"
              placeholderTextColor={c.mutedForeground}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[shared.btn, loading && shared.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}>
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={shared.btnText}>{isRegister ? '创建账号' : '登录'}</Text>
          )}
        </TouchableOpacity>

        <Text style={shared.hint}>
          {isRegister ? '注册即表示同意服务条款' : '忘记密码请联系管理员'}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: c.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoIconText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -1,
  },
  logoSub: {marginTop: 4, letterSpacing: 0.5},
  tabs: {
    flexDirection: 'row',
    backgroundColor: c.muted,
    borderRadius: 10,
    padding: 3,
    marginBottom: 24,
  },
  tab: {flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center'},
  tabActive: {
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.border,
  },
  tabText: {fontSize: 14, color: c.mutedForeground, fontWeight: '500'},
  tabTextActive: {color: c.foreground, fontWeight: '600'},
  form: {alignSelf: 'stretch', gap: 16, marginBottom: 20},
  inputFocus: {borderColor: c.primary, backgroundColor: c.background},
  serverBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.muted,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 28,
  },
  serverContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  serverTextArea: {flex: 1},
  serverLabel: {fontSize: 13, fontWeight: '600', color: c.foreground},
  serverArrow: {fontSize: 20, color: c.mutedForeground},
  statusDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.muted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: c.border,
  },
  statusDotText: {fontSize: 15},
});
