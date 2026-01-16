import { MiddlewareClient } from '../client';
import { MirrorClient } from '../mirror';

/**
 * Mirror WebSocket 模块
 * 用于单个设备的详细操作
 * 
 * @remarks
 * 已重构为直接暴露 MirrorClient 实例。
 * 请通过 `client.mirror.instance` 访问具体功能模块:
 * - ios: iOS 专属功能 (包含 device, app, file 等子模块)
 * - android: Android 专属功能
 */
export class MirrorModule {
  private _instance: MirrorClient | null = null;

  constructor(private client: MiddlewareClient) { }

  /**
   * 连接Mirror WebSocket
   * @param deviceId 设备盘位ID
   */
  async connect(deviceId: number): Promise<void> {
    if (this._instance) {
        this._instance.disconnect();
    }

    this._instance = new MirrorClient({
      deviceId,
      url: this.client.getApiBase(),
      token: this.client.getToken(),
      autoReconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 5
    });
    await this._instance.connect();
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this._instance) {
      this._instance.disconnect();
      this._instance = null;
    }
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this._instance !== null && this._instance.isConnected();
  }

  /**
   * 获取MirrorClient实例
   */
  get instance(): MirrorClient | null {
    return this._instance;
  }
}
