/**
 * 中间件 SDK 主入口
 *
 * 跨平台支持：
 * - Svelte / Vue / React
 * - Node.js (v18+)
 * - Electron
 * - Bun / Deno
 * - 单元测试环境
 *
 */

// 主客户端（统一封装）
export { default as MiddlewareClient } from './client';

// 模块导出
export { ClusterModule } from './modules/cluster';
export { SubscribeModule } from './modules/subscribe';
export { GuardModule } from './modules/guard';
export { MirrorModule } from './modules/mirror';

// WebSocket 连接类（底层服务）
export { ClusterWSConnection } from './services/subscribe-ws';
export { GuardWebSocket } from './services/guard-ws';
export * from './mirror'; // 导出 Mirror 相关所有内容（包括 iOS/Android 类型）

// 类型定义
export * from './types';

// 错误类
export { MiddlewareError } from './types';

// 工具函数
export * from './utils';

// 常量
export { BusinessFunction } from './constants';

// Cluster HTTP API
export * as ClusterAPI from './services/cluster-api';
