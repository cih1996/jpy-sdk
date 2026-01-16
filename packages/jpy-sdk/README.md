# JPY SDK

跨平台中间件 SDK，支持 WebSocket 和 HTTP API 通信，用于设备管理、中间件交互和自动化控制。

## 安装

### 方式一：直接安装构建好的分支 (推荐)

由于本仓库是一个 Monorepo，我们推荐使用专门的 `sdk` 分支来安装，这样无需关心构建过程：

```bash
# 使用 pnpm
pnpm add github:cih1996/jpy-sdk#sdk

# 使用 npm
npm install github:cih1996/jpy-sdk#sdk
```

### 方式二：本地开发

如果你是在本 Monorepo 中开发：

```bash
pnpm install
pnpm build
```

## 核心模块

SDK 包含以下主要模块：

- **Middleware (`jpy/middleware`)**: 核心中间件通信，支持 WebSocket 订阅、设备状态监控、屏幕镜像等。
- **Admin Device (`jpy/admin-device`)**: 管理员设备管理，包含授权码生成、密码解密等。
- **Device Modify (`jpy/device-modify`)**: 设备属性修改接口。
- **Admin DHCP (`jpy/admin-dhcp`)**: DHCP 服务管理。

## 快速开始

### 1. 中间件客户端 (Middleware Client)

用于连接中间件服务，获取设备列表和状态。

```typescript
import { MiddlewareClient } from 'jpy';
// 或者按需导入
// import { MiddlewareClient } from 'jpy/middleware';

const client = new MiddlewareClient({
  apiBase: 'https://ht.htsystem.cn:1443'
});

async function init() {
  // 1. 登录
  const loginResult = await client.login('admin', 'admin');
  
  if (loginResult.success) {
    console.log('登录成功:', loginResult.token);

    // 2. 建立 WebSocket 订阅
    await client.subscribe.connect({
      // 连接状态变化
      onStatusChange: (status) => {
        console.log('连接状态:', status);
      },
      
      // 设备列表更新
      onDeviceListUpdate: (devices, stats) => {
        console.log(`收到 ${devices.length} 台设备`);
        console.log('统计信息:', stats);
      },
      
      // 在线状态统计更新
      onDeviceOnlineUpdate: (_, stats) => {
        console.log(`在线设备: ${stats.ipReady}/${stats.ipTotal}`);
      }
    });
  } else {
    console.error('登录失败:', loginResult.error);
  }
}

// 断开连接
function cleanup() {
  client.disconnectAll();
}
```

### 2. 管理员设备管理 (Admin Device)

用于后台管理操作，如生成授权码。

```typescript
import { AdminDeviceClient } from 'jpy/admin-device';

const adminClient = new AdminDeviceClient();

async function manage() {
  // 登录后台
  const res = await adminClient.login('admin', 'admin');
  
  if (res.success) {
    // 生成授权码
    const codeRes = await adminClient.generateAuthCode('MyDevice01');
    if (codeRes.success) {
      console.log('授权码生成成功');
    }
  }
}
```

## 构建

```bash
# 构建 SDK
pnpm build

# 开发模式 (监听文件变化)
pnpm dev
```

## License

MIT