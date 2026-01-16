import { MiddlewareClient } from '../client';
import { ClusterWSConnection } from '../services/subscribe-ws';
import { ClusterWSCallbacks, DeviceListItem, OnlineStatus } from '../types';

/**
 * Subscribe WebSocket 模块
 * 用于设备列表管理、批量操作
 */
export class SubscribeModule {
  private connection: ClusterWSConnection | null = null;

  constructor(private client: MiddlewareClient) { }

  /**
   * 连接Subscribe WebSocket
   * @param callbacks 事件回调（可选）
   */
  async connect(callbacks?: ClusterWSCallbacks): Promise<void> {
    this.connection = new ClusterWSConnection(
      this.client.getApiBase(),
      this.client.getToken(),
      callbacks
    );
    await this.connection.connect();
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.connection) {
      this.connection.disconnect();
      this.connection = null;
    }
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connection !== null && this.connection.isConnected();
  }


  /**
   * 获取设备列表
   *
   * 封装 `ClusterWSConnection.fetchDeviceList()`，返回所有设备的详细信息。
   *
   * @returns {Promise<DeviceListItem[]>} 设备列表，包含 uuid、model、type、cpu、memory、diskSize、width、height、seat 等字段
   * @throws {Error} 当 WebSocket 未连接时抛出
   *
   * @see {@link ClusterWSConnection.fetchDeviceList} 查看详细的字段说明和示例
   *
   * @example
   * ```typescript
   * const client = new MiddlewareClient({ apiBase, token });
   * await client.subscribe.connect();
   *
   * const devices = await client.subscribe.fetchDeviceList();
   * console.log(`共 ${devices.length} 台设备`);
   * ```
   */
  async fetchDeviceList(): Promise<DeviceListItem[]> {
    if (!this.connection) {
      throw new Error('Subscribe WebSocket未连接');
    }
    return this.connection.fetchDeviceList();
  }

  /**
   * 获取设备在线信息
   *
   * 封装 `ClusterWSConnection.fetchDeviceOnlineInfo()`，返回设备在线状态。
   *
   * @returns {Promise<OnlineStatus[]>} 返回设备在线状态列表
   * @see {@link ClusterWSConnection.fetchDeviceOnlineInfo} 查看详细的字段说明
   */
  async fetchDeviceOnlineInfo(): Promise<OnlineStatus[]> {
    if (!this.connection) {
      throw new Error('Subscribe WebSocket未连接');
    }
    return this.connection.fetchDeviceOnlineInfo();
  }


  /**
   * 请求设备截图
   */
  async requestDeviceImage(deviceId: number, options?: {
    width?: number;
    height?: number;
    qua?: number;
    scale?: number;
    x?: number;
    y?: number;
    imgType?: 0 | 1 | 2;
  }): Promise<void> {
    if (!this.connection) {
      throw new Error('Subscribe WebSocket未连接');
    }
    await this.connection.requestDeviceImage(deviceId, options);
  }

  /**
   * 获取连接实例（用于高级操作）
   */
  getConnection(): ClusterWSConnection | null {
    return this.connection;
  }
}
