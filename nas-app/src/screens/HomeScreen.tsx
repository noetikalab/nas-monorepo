import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ActionSheetIOS,
  Platform,
  BackHandler,
} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {pick} from '@react-native-documents/picker';
import {storage} from '../storage/local';
import {filesApi} from '../api/files';
import type {FileItem} from '../types';
import type {RootStackParamList} from '../navigation';
import {c} from '../theme/tokens';
import {shared} from '../theme/shared';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

function formatSize(bytes: number): string {
  if (bytes === 0) return '--';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 从绝对路径中取最后一段作为显示名称 */
function dirName(path: string): string {
  const parts = path.replace(/\/$/, '').split('/');
  return parts[parts.length - 1] || '文件';
}

export function HomeScreen({navigation}: Props) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');

  // 共享文件相关
  const [tab, setTab] = useState<'mine' | 'shared'>('mine');

  // 当前路径（后端返回的绝对路径，如 /data/alice）
  const [currentPath, setCurrentPath] = useState('');
  // 回退栈（进入子目录时 push，返回时 pop）
  const [prevPaths, setPrevPaths] = useState<string[]>([]);

  // 新建文件夹 Modal
  const [mkdirVisible, setMkdirVisible] = useState(false);
  const [mkdirName, setMkdirName] = useState('');

  // 长按选中的文件
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  // 点击文件预览
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  // 用 ref 保存回退栈最新值，避免 BackHandler 闭包过时
  const prevPathsRef = useRef(prevPaths);
  prevPathsRef.current = prevPaths;

  useEffect(() => {
    storage.getUsername().then(u => setUsername(u ?? ''));
    fetchFiles();
  }, []);

  // 拦截 Android 返回键：子目录中优先回退上级，不退出 APP
  useEffect(() => {
    const handler = () => {
      if (prevPathsRef.current.length > 0) {
        goBackRef.current();
        return true;
      }
      // 根目录：确认退出
      Alert.alert('退出', '确定要退出应用吗？', [
        {text: '取消', style: 'cancel'},
        {text: '退出', onPress: () => BackHandler.exitApp()},
      ]);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => sub.remove();
  }, []);

  // 拉取文件列表：当前 Tab 为空时根据 tab 类型选默认路径
  const fetchFiles = async (path?: string) => {
    const target = path ?? (tab === 'shared' ? '/data/shared' : '');
    try {
      setError(null);
      const res = await filesApi.list(target);
      // 服务端返回的 path 是权威值（根目录 "" 时自动映射）
      setCurrentPath(res.path);
      // 目录在前，文件在后
      const sorted = [...res.files].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setFiles(sorted);
    } catch (e: any) {
      if (e.message === '认证已过期，请重新登录') {
        await storage.clearAuth();
        navigation.replace('Login');
        return;
      }
      setError('加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFiles(currentPath || undefined);
  }, [currentPath, tab]);

  // 进入子目录
  const enterDir = (dir: FileItem) => {
    const newPath = `${currentPath}/${dir.name}`;
    setPrevPaths(prev => [...prev, currentPath]);
    setLoading(true);
    fetchFiles(newPath);
  };

  // 返回上级
  const goBack = () => {
    if (prevPaths.length === 0) return;
    const parent = prevPaths[prevPaths.length - 1];
    setPrevPaths(prev => prev.slice(0, -1));
    setLoading(true);
    fetchFiles(parent);
  };
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;

  // 切换"我的文件"与"共享文件" Tab
  const switchTab = (newTab: 'mine' | 'shared') => {
    if (newTab === tab) return;
    setTab(newTab);
    setPrevPaths([]);
    setLoading(true);
    setError(null);
    // 显式传入路径，避免 setTab 异步导致 fetchFiles 读到旧 tab 值
    fetchFiles(newTab === 'shared' ? '/data/shared' : '');
  };

  // 退出登录
  const handleLogout = async () => {
    await storage.clearAuth();
    navigation.replace('Login');
  };

  // 新建文件夹
  const handleMkdir = async () => {
    const name = mkdirName.trim();
    if (!name) return;
    setMkdirVisible(false);
    setMkdirName('');
    try {
      await filesApi.mkdir(`${currentPath}/${name}`);
      fetchFiles();
    } catch (e: any) {
      if (tab === 'shared') {
        Alert.alert('创建失败', '共享目录只读，请联系管理员开通权限');
      } else {
        Alert.alert('创建失败', '无法创建文件夹');
      }
    }
  };

  // 删除
  const handleDelete = (file: FileItem) => {
    const filePath = `${currentPath}/${file.name}`;
    Alert.alert(
      '确认删除',
      `确定要删除 ${file.name} 吗？${file.type === 'directory' ? '将同时删除目录下所有文件。' : ''}`,
      [
        {text: '取消', style: 'cancel'},
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await filesApi.remove(filePath);
              fetchFiles();
            } catch {
              Alert.alert('删除失败', '无法删除该项');
            }
          },
        },
      ],
    );
  };

  // 重命名
  const handleRename = (file: FileItem) => {
    const oldPath = `${currentPath}/${file.name}`;
    Alert.prompt ? Alert.prompt(
      '重命名',
      `请输入 ${file.type === 'directory' ? '文件夹' : '文件'} 的新名称：`,
      [
        {text: '取消', style: 'cancel'},
        {
          text: '确定',
          onPress: async (newName?: string) => {
            if (!newName || newName.trim() === '' || newName.trim() === file.name) return;
            try {
              await filesApi.move(oldPath, `${currentPath}/${newName.trim()}`);
              fetchFiles();
            } catch {
              Alert.alert('重命名失败', '请检查名称是否合法');
            }
          },
        },
      ],
      'plain-text',
      file.name,
    ) : Alert.alert('提示', '请在 Android 上使用长按菜单进行重命名');
  };

  // 上传文件
  const handleUpload = async () => {
    try {
      const [picked] = await pick({allowMultiSelection: false});
      if (!picked) return;
      await filesApi.upload(currentPath, {
        uri: picked.uri,
        name: picked.name || 'untitled',
        type: picked.type || 'application/octet-stream',
      });
      fetchFiles();
    } catch (e: any) {
      if (e?.code === 'DOCUMENT_PICKER_CANCELED') return;
      const msg = tab === 'shared'
        ? '共享目录只读，请联系管理员开通权限'
        : e.message || '无法上传文件';
      Alert.alert('上传失败', msg);
    }
  };

  // 长按菜单
  const showActionSheet = (file: FileItem) => {
    setSelectedFile(file);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['重命名', '删除', '取消'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
        },
        index => {
          if (index === 0) handleRename(file);
          else if (index === 1) handleDelete(file);
        },
      );
    } else {
      Alert.alert(file.name, undefined, [
        {text: '重命名', onPress: () => handleRename(file)},
        {text: '删除', style: 'destructive', onPress: () => handleDelete(file)},
        {text: '取消', style: 'cancel'},
      ]);
    }
  };

  // 单条文件行
  const renderItem = ({item}: {item: FileItem}) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => item.type === 'directory' ? enterDir(item) : setPreviewFile(item)}
      onLongPress={() => showActionSheet(item)}
      activeOpacity={0.6}>
      <View style={styles.fileIcon}>
        <Text style={styles.fileIconText}>
          {item.type === 'directory' ? '▸' : '□'}
        </Text>
      </View>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
        <Text style={shared.subtitle} numberOfLines={1}>
          {item.type === 'directory' ? '--' : formatSize(item.size)}
          {' · '}
          {formatDate(item.modified)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={shared.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {prevPaths.length > 0 && (
            <TouchableOpacity onPress={goBack} style={styles.backBtn}>
              <Text style={styles.backBtnText}>‹</Text>
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.headerTitle}>{dirName(currentPath) || '文件'}</Text>
            {username ? <Text style={styles.headerUser}>{username}</Text> : null}
          </View>
        </View>
        <View style={styles.headerActions}>
          {/* 共享文件 Tab 下普通用户只读，隐藏新建/上传 */}
          {tab === 'mine' && (
            <>
              <TouchableOpacity onPress={() => setMkdirVisible(true)} style={styles.headerBtn}>
                <Text style={styles.headerBtnText}>+</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleUpload} style={styles.headerBtn}>
                <Text style={styles.headerBtnText}>↑</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>退出</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab 栏：我的文件 / 共享文件 */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'mine' && styles.tabActive]}
          onPress={() => switchTab('mine')}>
          <Text style={[styles.tabText, tab === 'mine' && styles.tabTextActive]}>我的文件</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'shared' && styles.tabActive]}
          onPress={() => switchTab('shared')}>
          <Text style={[styles.tabText, tab === 'shared' && styles.tabTextActive]}>共享文件</Text>
        </TouchableOpacity>
      </View>

      {/* Path breadcrumb */}
      {currentPath ? (
        <View style={styles.breadcrumb}>
          <Text style={styles.breadcrumbText} numberOfLines={1}>{currentPath}</Text>
        </View>
      ) : null}

      {/* Content */}
      {loading ? (
        <View style={shared.centered}>
          <ActivityIndicator size="large" color={c.foreground} />
        </View>
      ) : error ? (
        <View style={shared.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={shared.emptyBtn} onPress={() => { setLoading(true); fetchFiles(); }}>
            <Text style={shared.emptyBtnText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={files}
          keyExtractor={item => `${currentPath}/${item.name}`}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[c.foreground]} />
          }
          contentContainerStyle={files.length === 0 ? shared.centered : styles.list}
          ItemSeparatorComponent={() => <View style={shared.separator} />}
          ListEmptyComponent={<Text style={shared.subtitle}>暂无文件</Text>}
        />
      )}

      {/* 文件预览 Modal */}
      <Modal visible={previewFile !== null} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPreviewFile(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{previewFile?.name}</Text>
            {previewFile && (
              <View style={styles.previewBody}>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>类型</Text>
                  <Text style={styles.previewValue}>文件</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>大小</Text>
                  <Text style={styles.previewValue}>{formatSize(previewFile.size)}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>修改日期</Text>
                  <Text style={styles.previewValue}>{formatDate(previewFile.modified)}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>权限</Text>
                  <Text style={styles.previewValue}>{previewFile.permission}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>路径</Text>
                  <Text style={styles.previewValue} numberOfLines={2}>{currentPath}/{previewFile.name}</Text>
                </View>
              </View>
            )}
            <TouchableOpacity
              style={[styles.modalConfirmBtn, {alignSelf: 'center', marginTop: 12}]}
              onPress={() => setPreviewFile(null)}>
              <Text style={styles.modalConfirmText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 新建文件夹 Modal */}
      <Modal visible={mkdirVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => { setMkdirVisible(false); setMkdirName(''); }}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>新建文件夹</Text>
            <TextInput
              style={[shared.input, styles.modalInput]}
              placeholder="输入文件夹名称"
              placeholderTextColor={c.mutedForeground}
              autoFocus
              value={mkdirName}
              onChangeText={setMkdirName}
              onSubmitEditing={handleMkdir}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setMkdirVisible(false); setMkdirName(''); }}>
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleMkdir}>
                <Text style={styles.modalConfirmText}>创建</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Header
  header: {
    backgroundColor: c.primary,
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  backBtnText: {color: '#FFFFFF', fontSize: 28, lineHeight: 30, fontWeight: '300'},
  headerTitle: {fontSize: 20, fontWeight: '700', color: '#FFFFFF'},
  headerUser: {fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2},
  headerActions: {flexDirection: 'row', alignItems: 'center', gap: 8},
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnText: {color: '#FFFFFF', fontSize: 18, fontWeight: '500'},
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logoutText: {color: '#FFFFFF', fontSize: 13, fontWeight: '500'},

  // Breadcrumb
  breadcrumb: {
    backgroundColor: c.muted,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  breadcrumbText: {fontSize: 12, color: c.mutedForeground},

  // List
  list: {paddingBottom: 20},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: c.background,
  },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: c.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileIconText: {fontSize: 16, color: c.foreground, fontWeight: '600'},
  fileInfo: {flex: 1},
  fileName: {fontSize: 15, fontWeight: '500', color: c.foreground},
  errorText: {fontSize: 15, color: c.destructive, marginBottom: 12},

  // Modal
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
  modalTitle: {fontSize: 17, fontWeight: '600', color: c.foreground, marginBottom: 16},
  modalInput: {marginBottom: 16},
  modalActions: {flexDirection: 'row', justifyContent: 'flex-end', gap: 10},
  modalCancelBtn: {paddingHorizontal: 16, paddingVertical: 10},
  modalCancelText: {fontSize: 15, color: c.mutedForeground},
  modalConfirmBtn: {
    backgroundColor: c.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalConfirmText: {color: '#FFFFFF', fontSize: 15, fontWeight: '600'},

  // Preview
  previewBody: {marginBottom: 4},
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  previewLabel: {fontSize: 14, color: c.mutedForeground},
  previewValue: {fontSize: 14, color: c.foreground, fontWeight: '500', flex: 1, textAlign: 'right'},

  // Tab
  tabBar: {
    flexDirection: 'row',
    backgroundColor: c.muted,
    borderRadius: 10,
    padding: 3,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  tabItem: {flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center'},
  tabActive: {backgroundColor: c.background, borderWidth: 1, borderColor: c.border},
  tabText: {fontSize: 14, color: c.mutedForeground, fontWeight: '500'},
  tabTextActive: {color: c.foreground, fontWeight: '600'},
});
