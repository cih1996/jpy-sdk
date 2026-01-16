/**
 * JPY SDK - 跨平台中间件 SDK
 *
 * 支持环境：
 * - Svelte / Vue / React
 * - Node.js (v18+)
 * - Electron
 * - Bun / Deno
 * - 单元测试环境
 *
 * 特性：
 * - 无 DOM 依赖
 * - 无框架依赖
 * - TypeScript 支持
 * - 完整的类型定义
 *
 * @example
 * ```typescript
 * import { MiddlewareClient, AdminDeviceClient, DeviceModifyClient, DHCPClient } from 'jpy';
 *
 * // 中间件客户端
 * const middleware = new MiddlewareClient({
 *   serverId: 'server-001',
 *   apiBase: 'https://server.com:1443'
 * });
 *
 * // 管理端设备客户端
 * const adminDevice = new AdminDeviceClient();
 *
 * // DHCP 客户端
 * const dhcp = new DHCPClient();
 *
 * // 改机测试客户端
 * const deviceModify = new DeviceModifyClient({
 *   url: 'ws://server.com:8080'
 * });
 * ```
 */

// ========== 中间件模块 ==========
export * from './middleware';

// ========== 管理端设备模块 ==========
export * from './admin-device';

// ========== DHCP 管理模块 ==========
export * from './admin-dhcp';

// ========== 改机测试模块 ==========
export * from './device-modify';

// ========== 通用工具模块 ==========
export {
  encodeProtocolMessage,
  decodeProtocolMessage,
  MessageType,
  formatTimeAgo,
  formatServerUrl,
  formatDateTime,
  formatDate,
  formatTime
} from './shared';
