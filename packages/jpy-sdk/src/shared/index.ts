/**
 * 通用工具模块
 * 
 * 提供跨平台的工具函数，包括：
 * - 协议编解码（MessagePack/JSON）
 * - 时间格式化
 * - 视频解码 Worker（仅浏览器）
 */

// 协议工具
export {
  encodeProtocolMessage,
  decodeProtocolMessage,
  MessageType
} from './protocol';

// 时间格式化工具
export {
  formatTimeAgo,
  formatServerUrl,
  formatDateTime,
  formatDate,
  formatTime
} from './time-format';

// 注意：video-decoder.worker.ts 是一个 Web Worker 文件
// 需要单独作为 Worker 引用，不能直接导入
// 使用方式见 video-decoder.worker.ts 文件顶部的注释
