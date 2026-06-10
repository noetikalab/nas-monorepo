import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {discover, type DiscoveredDevice} from '../native/MdnsModule';
import {getDeviceInfo} from '../api/device';
import {storage} from '../storage/local';
import type {RootStackParamList} from '../navigation';
import {c} from '../theme/tokens';
import {shared} from '../theme/shared';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Discovery'>;
};

export function DiscoveryScreen({navigation}: Props) {
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [scanning, setScanning] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const runDiscovery = useCallback(async () => {
    setScanning(true);
    setError(null);
    setDevices([]);
    try {
      const found = await discover();
      setDevices(found);
    } catch (e: any) {
      setError(e.message ?? 'mDNS 发现失败');
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    runDiscovery();
  }, [runDiscovery]);

  const handleConnect = useCallback(
    async (device: DiscoveredDevice) => {
      setVerifyingId(device.name);
      const url = `http://${device.ip}:${device.port}`;
      try {
        await getDeviceInfo(url);
        setSelectedId(device.name);
        await storage.saveServerUrl(url);
        setTimeout(() => navigation.goBack(), 400);
      } catch {
        Alert.alert('连接失败', `无法连接到 ${device.name} (${device.ip}:${device.port})，请确认设备在线`);
      } finally {
        setVerifyingId(null);
      }
    },
    [navigation],
  );

  const isAnySelected = selectedId !== null || verifyingId !== null;

  const renderDevice = ({item}: {item: DiscoveredDevice}) => {
    const isSelected = selectedId === item.name;
    const isVerifying = verifyingId === item.name;
    return (
      <TouchableOpacity
        style={[shared.card, styles.cardRow, isSelected && shared.cardSelected]}
        onPress={() => handleConnect(item)}
        disabled={isAnySelected}
        activeOpacity={0.7}>
        <View style={[shared.centered, styles.deviceIcon]}>
          <View style={styles.deviceDot} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={shared.subtitle}>{item.ip}:{item.port}</Text>
        </View>
        {isVerifying ? (
          <ActivityIndicator color={c.foreground} size="small" />
        ) : isSelected ? (
          <Text style={styles.checkMark}>✓</Text>
        ) : (
          <Text style={styles.connectArrow}>→</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={shared.root}>
      {/* Scanning indicator */}
      <View style={styles.scanArea}>
        <Animated.View style={[styles.radar, {opacity: pulseAnim}]}>
          <View style={styles.radarInner} />
        </Animated.View>
        <Text style={styles.scanTitle}>
          {scanning
            ? '正在搜索局域网 NAS...'
            : error
              ? '搜索失败'
              : `发现 ${devices.length} 台设备`}
        </Text>
        <Text style={shared.subtitle}>
          {scanning
            ? '请确保手机与 NAS 在同一网络'
            : error
              ? '请检查网络连接后重试'
              : '点击选择要连接的设备'}
        </Text>
      </View>

      {/* Content */}
      {!scanning && error && devices.length === 0 ? (
        <View style={[shared.centered, styles.emptyArea]}>
          <Text style={styles.emptyTitle}>未发现设备</Text>
          <Text style={styles.emptyHint}>
            {error}{'\n'}请确认 NAS 已启动并在同一局域网
          </Text>
          <TouchableOpacity style={shared.emptyBtn} onPress={runDiscovery}>
            <Text style={shared.emptyBtnText}>重新搜索</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.manualBtn} onPress={() => navigation.navigate('DevSettings')}>
            <Text style={styles.manualBtnText}>手动输入地址</Text>
          </TouchableOpacity>
        </View>
      ) : !scanning && !error && devices.length === 0 ? (
        <View style={[shared.centered, styles.emptyArea]}>
          <Text style={styles.emptyTitle}>未发现设备</Text>
          <Text style={styles.emptyHint}>
            请确认 NAS 已启动并在同一局域网{'\n'}或手动输入服务器地址
          </Text>
          <TouchableOpacity style={shared.emptyBtn} onPress={runDiscovery}>
            <Text style={shared.emptyBtnText}>重新搜索</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.manualBtn} onPress={() => navigation.navigate('DevSettings')}>
            <Text style={styles.manualBtnText}>手动输入地址</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={item => item.name}
          renderItem={renderDevice}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListFooterComponent={
            scanning ? (
              <View style={styles.scanningFooter}>
                <ActivityIndicator color={c.foreground} size="small" />
                <Text style={shared.subtitle}>搜索中...</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.rescanBtn} onPress={runDiscovery}>
                <Text style={styles.rescanText}>⟳ 重新搜索</Text>
              </TouchableOpacity>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scanArea: {
    alignItems: 'center',
    paddingTop: 100,
    paddingBottom: 32,
    backgroundColor: c.background,
  },
  radar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: c.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  radarInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.primary,
  },
  scanTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: c.foreground,
    marginBottom: 6,
  },

  /* Device cards */
  list: {padding: 20},
  cardRow: {flexDirection: 'row', alignItems: 'center', padding: 16},
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: c.muted,
    marginRight: 14,
  },
  deviceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: c.foreground,
  },
  cardInfo: {flex: 1},
  cardName: {fontSize: 15, fontWeight: '600', color: c.foreground, marginBottom: 2},
  connectArrow: {fontSize: 20, color: c.mutedForeground},
  checkMark: {fontSize: 18, color: c.foreground, fontWeight: '700'},
  sep: {height: 10},

  /* Footer */
  scanningFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  rescanBtn: {alignItems: 'center', paddingVertical: 16},
  rescanText: {fontSize: 14, color: c.foreground, fontWeight: '500'},

  /* Empty */
  emptyArea: {paddingHorizontal: 40, paddingBottom: 80},
  emptyTitle: {fontSize: 18, fontWeight: '600', color: c.foreground, marginBottom: 8},
  emptyHint: {fontSize: 14, color: c.mutedForeground, textAlign: 'center', lineHeight: 20, marginBottom: 24},
  manualBtn: {paddingVertical: 8},
  manualBtnText: {color: c.mutedForeground, fontSize: 14},
});
