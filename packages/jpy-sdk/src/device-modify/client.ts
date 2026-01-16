/**
 * 改机测试客户端
 * 
 * 提供统一的改机测试功能接口
 */

import { ModifyWebSocket, type ModifyWSCallbacks } from './modify-ws';

export interface DeviceModifyClientConfig {
  /** WebSocket URL */
  url: string;
  /** 连接成功后自动请求设备列表 */
  autoRequestDeviceList?: boolean;
  /** 心跳间隔（毫秒），默认 30000 */
  heartbeatInterval?: number;
}

/**
 * 改机测试客户端
 */
export default class DeviceModifyClient {
  private ws: ModifyWebSocket | null = null;
  private config: DeviceModifyClientConfig;

  constructor(config: DeviceModifyClientConfig) {
    this.config = config;
  }

  /**
   * 连接 WebSocket
   */
  async connect(callbacks: ModifyWSCallbacks = {}): Promise<void> {
    if (this.ws) {
      console.log('[改机测试] 已有连接，先断开旧连接');
      this.disconnect();
    }

    this.ws = new ModifyWebSocket({
      url: this.config.url,
      autoRequestDeviceList: this.config.autoRequestDeviceList,
      heartbeatInterval: this.config.heartbeatInterval
    });

    await this.ws.connect(callbacks);
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.disconnect();
      this.ws = null;
    }
  }

  /**
   * 获取连接状态
   */
  getStatus(): 'connecting' | 'connected' | 'disconnected' | 'error' {
    return this.ws ? this.ws.getStatus() : 'disconnected';
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.ws ? this.ws.isConnected() : false;
  }

  /**
   * 发送消息
   */
  sendMessage(data: any): boolean {
    if (!this.ws) {
      console.error('[改机测试] 未连接');
      return false;
    }
    return this.ws.sendMessage(data);
  }

  /**
   * 发送二进制消息
   */
  sendBinaryMessage(data: ArrayBuffer | Uint8Array): boolean {
    if (!this.ws) {
      console.error('[改机测试] 未连接');
      return false;
    }
    return this.ws.sendBinaryMessage(data);
  }

  /**
   * 请求设备列表
   */
  requestDeviceList(): boolean {
    if (!this.ws) {
      console.error('[改机测试] 未连接');
      return false;
    }
    return this.ws.requestDeviceList();
  }

  /**
   * 发送改机指令
   */
  sendModifyCommand(deviceIds: number[], seq: number): boolean {
    if (!this.ws) {
      console.error('[改机测试] 未连接');
      return false;
    }
    return this.ws.sendModifyCommand(deviceIds, seq);
  }

  /**
   * 查询改机状态
   */
  queryModifyStatus(mainTaskId: string, seq: number): boolean {
    if (!this.ws) {
      console.error('[改机测试] 未连接');
      return false;
    }
    return this.ws.queryModifyStatus(mainTaskId, seq);
  }
}
