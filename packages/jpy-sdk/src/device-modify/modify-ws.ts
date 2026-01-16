/**
 * 改机测试 WebSocket 连接管理
 * 
 * 特性：
 * - 无 DOM 依赖
 * - 跨平台支持
 * - 环境兼容（Node.js / Browser / Electron）
 */

import { ModifyWebSocketConfig, ModifyWSCallbacks } from './types';
export type { ModifyWebSocketConfig, ModifyWSCallbacks };

/**
 * 改机测试 WebSocket 类
 */
export class ModifyWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private status: 'connecting' | 'connected' | 'disconnected' | 'error' = 'disconnected';
  private heartbeatTimer: any = null;
  private callbacks: ModifyWSCallbacks = {};
  private config: Required<ModifyWebSocketConfig>;

  constructor(config: ModifyWebSocketConfig) {
    this.url = config.url;
    this.config = {
      url: config.url,
      autoRequestDeviceList: config.autoRequestDeviceList ?? true,
      heartbeatInterval: config.heartbeatInterval ?? 30000
    };
  }

  /**
   * 连接 WebSocket
   */
  async connect(callbacks: ModifyWSCallbacks = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('[改机测试 WS] 开始连接:', this.url);

      this.callbacks = callbacks;
      this.ws = new WebSocket(this.url);
      this.status = 'connecting';

      // 连接建立成功
      this.ws.onopen = () => {
        console.log('[改机测试 WS] 连接成功');
        this.status = 'connected';
        this.callbacks.onStatusChange?.('connected');

        // 启动心跳
        this.startHeartbeat();

        // 连接成功后自动获取设备列表
        if (this.config.autoRequestDeviceList) {
          setTimeout(() => {
            this.requestDeviceList();
          }, 100);
        }

        resolve();
      };

      // 收到消息
      this.ws.onmessage = (event) => {
        try {
          console.log('[改机测试 WS] 收到原始消息:', event.data);

          let data;
          if (typeof event.data === 'string') {
            try {
              data = JSON.parse(event.data);
            } catch {
              data = event.data;
            }
          } else {
            data = event.data;
          }

          console.log('[改机测试 WS] 解析后的消息:', data);
          this.callbacks.onMessage?.(data);
        } catch (error) {
          console.error('[改机测试 WS] 消息处理错误:', error);
          this.callbacks.onError?.(`消息处理错误: ${error}`);
        }
      };

      // 连接关闭
      this.ws.onclose = (event) => {
        console.log('[改机测试 WS] 连接关闭:', event.code, event.reason);
        this.status = 'disconnected';
        this.stopHeartbeat();
        this.callbacks.onStatusChange?.('disconnected');
      };

      // 连接错误
      this.ws.onerror = (event) => {
        console.error('[改机测试 WS] 连接错误:', event);
        this.status = 'error';
        this.stopHeartbeat();
        this.callbacks.onStatusChange?.('error');
        this.callbacks.onError?.('WebSocket连接错误');
        reject(new Error('WebSocket连接失败'));
      };
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('[改机测试 WS] 主动断开连接');
      this.ws.close();
    }
    this.status = 'disconnected';
    this.ws = null;
  }

  /**
   * 获取连接状态
   */
  getStatus(): 'connecting' | 'connected' | 'disconnected' | 'error' {
    return this.status;
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * 发送消息
   */
  sendMessage(data: any): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[改机测试 WS] WebSocket未连接，无法发送消息');
      return false;
    }

    try {
      let message: string;

      if (typeof data === 'object') {
        message = JSON.stringify(data);
      } else {
        message = String(data);
      }

      console.log('[改机测试 WS] 发送消息:', message);
      this.ws.send(message);
      return true;
    } catch (error) {
      console.error('[改机测试 WS] 发送消息失败:', error);
      return false;
    }
  }

  /**
   * 发送二进制消息
   */
  sendBinaryMessage(data: ArrayBuffer | Uint8Array): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[改机测试 WS] WebSocket未连接，无法发送消息');
      return false;
    }

    try {
      console.log('[改机测试 WS] 发送二进制消息, 长度:', data.byteLength);
      this.ws.send(data);
      return true;
    } catch (error) {
      console.error('[改机测试 WS] 发送二进制消息失败:', error);
      return false;
    }
  }

  /**
   * 请求设备列表
   */
  requestDeviceList(): boolean {
    const request = {
      type: "F",
      content: JSON.stringify({
        f: 5,
        data: { flag: false },
        req: true,
        seq: 0
      })
    };

    console.log('[改机测试 WS] 请求设备列表');
    return this.sendMessage(request);
  }

  /**
   * 发送改机指令
   */
  sendModifyCommand(deviceIds: number[], seq: number): boolean {
    const deviceCommands = deviceIds.map(deviceId => ({
      deviceId,
      type: "changeDevice",
      func: 1,
      paramsAll: {
        sdk: { value: 31 },
        zhiding: { PKG1: "", PKG2: "" },
        huanji: {}
      }
    }));

    const request = {
      type: "F",
      content: JSON.stringify({
        f: 515,
        data: deviceCommands,
        req: true,
        seq
      })
    };

    console.log('[改机测试 WS] 发送改机指令，设备数:', deviceIds.length);
    return this.sendMessage(request);
  }

  /**
   * 查询改机状态
   */
  queryModifyStatus(mainTaskId: string, seq: number): boolean {
    const request = {
      type: "F",
      content: JSON.stringify({
        f: 612,
        data: { mainTaskId },
        req: true,
        seq
      })
    };

    console.log('[改机测试 WS] 查询改机状态, taskId:', mainTaskId);
    return this.sendMessage(request);
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    // 使用 setTimeout 递归实现，兼容所有环境
    const sendHeartbeat = () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const heartbeat = new Uint8Array(0);
        this.ws.send(heartbeat);
        console.log('[改机测试 WS] 发送心跳包');
      }

      // 递归调用
      this.heartbeatTimer = setTimeout(sendHeartbeat, this.config.heartbeatInterval);
    };

    this.heartbeatTimer = setTimeout(sendHeartbeat, this.config.heartbeatInterval);
    console.log(`[改机测试 WS] 心跳已启动，间隔 ${this.config.heartbeatInterval} 毫秒`);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
      console.log('[改机测试 WS] 心跳已停止');
    }
  }
}
