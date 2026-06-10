# NasApp 工程搭建文档

## 环境要求

| 工具 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 22.11.0 | 推荐用 nvm 管理 |
| pnpm | 11.1.1 | 独立安装，不绑定 node 版本 |
| JDK | 17 | `sudo apt install openjdk-17-jdk` |
| Android SDK | API 34 | 通过 cmdline-tools 安装 |

## Android SDK 配置

```bash
# 下载 cmdline-tools（官网：https://developer.android.com/studio#command-tools）
unzip commandlinetools-linux-*.zip -d ~/Android/cmdline-tools
mv ~/Android/cmdline-tools/cmdline-tools ~/Android/cmdline-tools/latest

# 安装 SDK 组件（实际构建时 Gradle 会自动安装 API 36 和 NDK，无需手动指定）
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

`~/.bashrc` 环境变量：

```bash
export ANDROID_HOME=$HOME/Android
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin
```

## 项目初始化

```bash
pnpm dlx @react-native-community/cli@latest init NasApp
cd NasApp
pnpm install
```

## 目录结构

```
NasApp/
├── android/                  # Android 原生工程
├── src/
│   ├── screens/              # 页面组件
│   ├── components/           # 可复用 UI 组件
│   ├── navigation/           # 路由配置
│   ├── api/                  # 接口请求层
│   ├── store/                # 全局状态（Zustand）
│   ├── hooks/                # 自定义 Hook
│   ├── native/               # JSB 原生模块封装（NFC、WiFi P2P）
│   ├── network/              # 网络连接策略（mDNS → 缓存 → P2P）
│   ├── storage/              # 本地持久化（phone_id、token）
│   ├── utils/                # 工具函数
│   └── types/                # TypeScript 类型定义
├── docs/                     # 项目文档
├── babel.config.js
├── tsconfig.json
└── package.json
```

## 路径别名

`@/` 指向项目根目录，例如：

```ts
import { LoginScreen } from '@/src/screens/LoginScreen'
```

由 `tsconfig.json` 的 `paths` 和 `babel-plugin-module-resolver` 共同支持。

## 依赖说明

### 运行时依赖

| 包 | 版本 | 用途 |
|----|------|------|
| react-native | 0.85.3 | 框架核心 |
| react | 19.2.3 | UI 库 |
| @react-navigation/native | ^7.2.4 | 导航容器 |
| @react-navigation/stack | ^7.9.1 | Stack 导航器 |
| react-native-screens | ^4.25.0 | 原生屏幕优化（导航依赖） |
| react-native-safe-area-context | ^5.5.2 | 安全区域处理 |
| @react-native-async-storage/async-storage | ^2.1.2 | 本地持久化（phone_id、JWT）|
| zustand | ^5.0.13 | 轻量全局状态管理 |
| axios | ^1.16.0 | HTTP 请求 |

> **注意**：async-storage 必须用 v2，v3 依赖 `org.asyncstorage.shared_storage:storage-android` 这个 Maven 包，国内镜像没有，构建会失败。

### 待安装（开发推进时按需添加）

| 包 | 用途 |
|----|------|
| react-native-nfc-manager | NFC 读标签 |
| react-native-wifi-p2p | WiFi P2P 直连 |
| react-native-fs | 文件系统操作（WebDAV 上传下载） |

### 开发依赖

| 包 | 用途 |
|----|------|
| typescript | ^5.8.3 | 类型系统 |
| eslint | ^8.19.0 | 代码检查 |
| prettier | 2.8.8 | 代码格式化 |
| babel-plugin-module-resolver | ^5.0.3 | 路径别名（配合 tsconfig paths） |
| jest | ^29.6.3 | 单元测试 |

### 环境工具补充

安装 VS Code 编辑器，推荐使用官方 `.deb` 包而非 snap 版本：

```bash
wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
sudo install -D -o root -g root -m 644 packages.microsoft.gpg /etc/apt/keyrings/packages.microsoft.gpg
echo 'deb [arch=amd64 signed-by=/etc/apt/keyrings/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main' | sudo tee /etc/apt/sources.list.d/vscode.list
sudo apt update && sudo apt install code
```

> **snap 版已废弃**：snap 238 版有 Mesa/OpenGL 驱动搜索路径 bug，导致窗口无法渲染（详见下方已知坑点）。

## 已知坑点

### VS Code snap 无法打开窗口

**现象**：`code` 命令执行后进程运行但没有窗口出现，verbose 日志报 `failed to open radeonsi: /usr/lib/dri/radeonsi_dri.so: 无法打开共享目标文件`。

**根因**：snap 版 VS Code（v238）的 Electron 运行时搜索 Mesa DRI 驱动路径为 `/usr/lib/dri/`，但系统实际路径为 `/usr/lib/x86_64-linux-gnu/dri/`。这是 snap 沙箱与系统 Mesa 库的兼容性问题。

**解决方案**：卸载 snap 版，改用官方 `.deb` 安装（命令见上方"环境工具补充"）。安装后执行 `hash -r` 清除 shell 对旧 `/snap/bin/code` 的路径缓存。

### USB 网络共享 IP 动态变化

USB 网络共享每次重新连接，手机分配给电脑的 IP 会变（如 `10.106.26.92` → `10.106.26.104`），导致 App 无法连接后端。

根因：USB 网络共享使用 DHCP，IP 不固定。

解决方案：长按登录页右下角的 ⚡ ping 按钮，进入 **DevSettings** 屏幕，在 App 内修改服务器地址并持久化到 AsyncStorage，无需改代码重编译。服务器地址默认值在 `src/storage/local.ts` 的 `DEFAULT_SERVER_URL` 中设置。

### Gradle 下载超时
国内访问 `services.gradle.org` 被墙，需改用腾讯云镜像。

`android/gradle/wrapper/gradle-wrapper.properties`：
```
distributionUrl=https\://mirrors.cloud.tencent.com/gradle/gradle-9.3.1-bin.zip
networkTimeout=60000
```

`android/build.gradle` 的 `repositories` 块加阿里云 Maven 镜像：
```groovy
maven { url 'https://maven.aliyun.com/repository/google' }
maven { url 'https://maven.aliyun.com/repository/central' }
```

### async-storage v3 构建失败
v3 依赖 `org.asyncstorage.shared_storage:storage-android`，国内镜像没有此包。固定使用 v2：
```bash
pnpm add @react-native-async-storage/async-storage@^2.1.2
```

### INSTALL_FAILED_USER_RESTRICTED
手机拒绝安装，两种原因：
1. 手机屏幕弹出安装确认框未点允许
2. 开发者选项中 **USB 安装** 未开启（小米等品牌需要单独开启）

### tsconfig baseUrl 已移除
新版 TypeScript 不支持 `baseUrl`，路径别名改用：
```json
"paths": { "@/*": ["./*"] }
```
`babel.config.js` 的 alias 同步改为 `"@": "./"` 。

**必须使用真机**，模拟器不支持 NFC 和 WiFi P2P。

```bash
# 手机开启开发者模式 + USB 调试 + USB 安装后
adb devices          # 确认设备已识别

# 日常开发（推荐）：自动执行 adb reverse + 启动 Metro
pnpm dev

# 首次运行或修改了原生代码（Kotlin/Java、android/ 目录、新增带原生代码的 npm 包）后
pnpm android
```

### adb reverse 说明

手机通过 USB 连接时，`localhost` 在手机上指向手机自身，无法访问电脑上的 Metro。`adb reverse tcp:8081 tcp:8081` 在手机和电脑之间建立端口隧道，让手机的 `localhost:8081` 指向电脑的 8081 端口。

`pnpm dev` 已内置此命令，每次重新插拔手机后重跑 `pnpm dev` 即可，无需重新编译 APK。

## 相关文档

- [NAS 整体方案（飞书）](https://my.feishu.cn/docx/EhQodDF20oHLMixoRaWcrejinIf)
- [手机 APP 连接 NAS 方案（飞书）](https://my.feishu.cn/docx/ECfhdOcRUoa4XHxqCiOckoS7nOb)
- 后端（authd）：`../ldap-demo/`

## 相关文章
- [[../../wiki/index]] — 全局知识目录
- [[mdns-integration]] — 网络配置与 mDNS 调试
