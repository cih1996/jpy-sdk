import { encodeProtocolMessage, decodeProtocolMessage, MessageType } from '../../shared/protocol';
import {
  ConnectionStatus,
  ClusterWSCallbacks,
  CommandResponse,
  WSBaseMessage,
  WSResponse,
  WSPushMessage,
  DeviceListItem,
  OnlineStatus
} from '../types';
import { BusinessFunction } from '../constants';
import { stringifyBigInt, normalizeDeviceListItem, processImageData, parseOnlineStatus } from '../utils';

/**
 * Cluster WebSocket 连接类
 * @description 负责与中间件服务器的 WebSocket 通信，包括设备列表、在线状态、图片订阅等功能
 */
class ClusterWSConnection {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;

  private seqCounter = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatInterval = 30000; // 30秒心跳检查
  private connectPromise: { resolve: () => void; reject: (err: Error) => void } | null = null;

  private requestCallbacks = new Map<number, {
    resolve: (data: any) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();

  // 图片订阅相关
  private imageSubscribers = new Map<number, {
    onImage: (deviceId: number, blob: Blob) => void;
    onError?: (deviceId: number, error: Error) => void;
  }>();

  // 事件回调
  private callbacks: ClusterWSCallbacks;

  /**
   * 构造函数
   * @param url 服务器地址（如 ht.htsystem.cn:1443）
   * @param token 授权令牌
   * @param callbacks 事件回调（可选）
   */
  constructor(url: string, token: string, callbacks?: ClusterWSCallbacks) {
    this.url = url;
    this.token = token;
    this.callbacks = callbacks || {};
  }

  /**
   * 构建 WebSocket URL
   * @private
   * @returns 完整的 WSS URL（wss://host/box/subscribe?Authorization=***）
   */
  private buildWSUrl(): string {
    // 将 https:// 转换为 wss://
    let wsUrl = this.url.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
    if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
      wsUrl = 'wss://' + wsUrl;
    }

    // 添加路径后缀
    const urlObj = new URL(wsUrl);
    if (!urlObj.pathname.includes('/box/subscribe')) {
      urlObj.pathname = urlObj.pathname.replace(/\/$/, '') + '/box/subscribe';
    }

    // 添加 Authorization 参数
    urlObj.searchParams.set('Authorization', this.token);

    return urlObj.toString();
  }

  /**
   * 连接到服务器
   * @description 建立 WebSocket 连接，设置事件处理器
   * @throws {Error} 连接失败或超时
   */
  async connect(): Promise<void> {
    // 如果已经有正在进行的连接 Promise，返回它
    if (this.connectPromise) {
      return new Promise((resolve, reject) => {
        // 等待现有的连接完成
        const checkInterval = setInterval(() => {
          if (!this.connectPromise) {
            clearInterval(checkInterval);
            // 连接已完成，检查是否成功
            if (this.isConnected()) {
              resolve();
            } else {
              reject(new Error('连接失败'));
            }
          }
        }, 100);
        // 设置超时，避免无限等待
        setTimeout(() => {
          clearInterval(checkInterval);
          if (this.connectPromise) {
            reject(new Error('连接超时'));
          }
        }, 10000); // 10秒超时
      });
    }

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.buildWSUrl();
        console.log(`[cluster-ws] 连接中: ${wsUrl.replace(/Authorization=[^&]+/, 'Authorization=***')}`);

        // 设置连接中状态
        this.updateServerStatus('connecting');

        // 保存 resolve 和 reject
        this.connectPromise = { resolve, reject };

        this.ws = new WebSocket(wsUrl);
        this.ws.binaryType = 'arraybuffer';

        const connectTimeout = setTimeout(() => {
          if (this.ws) {
            this.ws.close();
            this.updateServerStatus('offline');
            if (this.connectPromise) {
              this.connectPromise.reject(new Error('连接超时'));
              this.connectPromise = null;
            }
          }
        }, 10000);

        this.ws.onopen = () => {
          clearTimeout(connectTimeout);
          this.sendInitRequest();
          this.startHeartbeat();
          this.updateServerStatus('online');
          // resolve connectPromise
          if (this.connectPromise) {
            this.connectPromise.resolve();
            this.connectPromise = null;
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error(`[cluster-ws] 连接错误:`, error);
          // 连接错误时，状态会在 onclose 中更新
        };

        this.ws.onclose = (event) => {
          clearTimeout(connectTimeout);
          console.log(`[cluster-ws] 连接关闭:`, event.code, event.reason);
          this.stopHeartbeat();

          // 更新状态为离线
          this.updateServerStatus('offline');
          
          // 如果 Promise 还未 resolve/reject，则 reject
          if (this.connectPromise) {
            this.connectPromise.reject(new Error(`连接关闭: ${event.code} ${event.reason}`));
            this.connectPromise = null;
          }
          
          // 清除 WebSocket 引用
          this.ws = null;
        };
      } catch (err) {
        this.updateServerStatus('offline');
        if (this.connectPromise) {
          this.connectPromise.reject(err instanceof Error ? err : new Error(String(err)));
          this.connectPromise = null;
        } else {
          reject(err);
        }
      }
    });
  }

  /**
   * 发送系统同步初始化请求 (f=111)
   * @private
   * @description 连接建立后发送此请求，确保双方会话同步
   * @description 仅发送初始化请求，不自动获取任何数据
   * @description 用户需要显式调用 fetchDeviceList() 等方法获取数据
   */
  private sendInitRequest() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // 发送初始化请求 f=111
    const seq = this.getNextSeq();
    const request = {
      f: BusinessFunction.SYSTEM_SYNC,
      req: true,
      seq
    };

    try {
      const buffer = encodeProtocolMessage(request, MessageType.MSGPACK, [0]);
      this.ws.send(buffer);
      console.log(`[cluster-ws] Sent system sync request (f=${BusinessFunction.SYSTEM_SYNC})`);

      // 设置回调：仅记录日志，不执行任何自动操作
      const callback = {
        resolve: (_data: any) => {
          console.log(`[cluster-ws] System sync successful`);
        },
        reject: (err: Error) => {
          console.warn(`[cluster-ws] System sync failed:`, err);
          // 即使失败也不自动重试，用户可以手动重连或调用数据获取方法
        },
        timeout: setTimeout(() => {
          if (this.requestCallbacks.has(seq)) {
            this.requestCallbacks.delete(seq);
            console.warn(`[cluster-ws] System sync timeout`);
          }
        }, 2000)
      };

      this.requestCallbacks.set(seq, callback);
    } catch (err) {
      console.error(`[cluster-ws] Failed to send system sync:`, err);
    }
  }

  /**
   * 获取设备列表 (f=5)
   *
   * 向中间件服务器请求所有连接设备的信息，包括设备型号、系统版本、硬件规格等。
   *
   * @returns {Promise<DeviceListItem[]>} 设备列表数组，每项包含以下字段：
   *
   * **返回字段说明**:
   * - `uuid: string` - 设备唯一标识符
   * - `model: string` - 设备型号（如 "iPhone10,3", "SM-G973F"）
   * - `type: number` - 设备类型（1=Android, 2=iOS）
   * - `osVersion: string` - 系统版本（如 "14.5", "11.0"）
   * - `androidVersion?: string` - Android 版本（仅 Android 设备）
   * - `cpu: number` - CPU 核心数
   * - `memory: string` - 内存大小（字节，字符串格式避免精度丢失）
   * - `diskSize: string` - 磁盘大小（字节，字符串格式）
   * - `width: number` - 屏幕宽度（像素）
   * - `height: number` - 屏幕高度（像素）
   * - `seat: number` - 设备位号/槽位号
   *
   * @throws {Error} 当 WebSocket 未连接或请求超时（10秒）时抛出
   *
   * @example
   * ```typescript
   * import { ClusterWSConnection, formatBytes } from 'jpy/middleware';
   *
   * const connection = new ClusterWSConnection(url, token);
   * await connection.connect();
   *
   * const devices = await connection.fetchDeviceList();
   * devices.forEach(device => {
   *   console.log(`设备 ${device.seat}: ${device.model}`);
   *   console.log(`内存: ${formatBytes(device.memory)}`);
   *   console.log(`磁盘: ${formatBytes(device.diskSize)}`);
   *   console.log(`分辨率: ${device.width}x${device.height}`);
   * });
   * ```
   */
  async fetchDeviceList(): Promise<DeviceListItem[]> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const seq = this.getNextSeq();
    const request = {
      f: BusinessFunction.DEVICE_LIST,
      req: true,
      seq
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.requestCallbacks.delete(seq);
        reject(new Error('Device list request timeout'));
      }, 10000);

      this.requestCallbacks.set(seq, {
        resolve: (rawData) => {
          clearTimeout(timeout);
          // 解析并标准化数据
          const devices = Array.isArray(rawData) ? rawData : (rawData?.data || []);
          const normalized = devices.map((item: any) => normalizeDeviceListItem(item));
          resolve(normalized);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout
      });

      try {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          const buffer = encodeProtocolMessage(request, MessageType.MSGPACK, [0]);
          this.ws.send(buffer);
          console.log(`[cluster-ws] Request device list (f=${BusinessFunction.DEVICE_LIST})`);
        } else {
          this.requestCallbacks.delete(seq);
          reject(new Error('WebSocket not connected'));
        }
      } catch (err) {
        this.requestCallbacks.delete(seq);
        reject(err);
      }
    });
  }



  /**
   * 获取设备在线信息 (f=6)
   *
   * 查询所有设备的在线状态，包括 IP 地址和连接时间。
   *
   * @returns {Promise<any>} 返回数据结构不明确，建议使用前进行校验。预期为 OnlineStatus[]
   *
   * 获取设备在线信息 (f=6)
   *
   * @returns {Promise<OnlineStatus[]>} 在线状态列表
   * @throws {Error} 当 WebSocket 未连接或请求超时（10秒）时抛出
   */
  async fetchDeviceOnlineInfo(): Promise<OnlineStatus[]> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const seq = this.getNextSeq();
    const request = {
      f: BusinessFunction.ONLINE_STATUS,
      req: true,
      data: {},
      code: 0,
      msg: '',
      t: 0,
      seq
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.requestCallbacks.delete(seq);
        reject(new Error('Online info request timeout'));
      }, 10000);

      this.requestCallbacks.set(seq, {
        resolve: (data) => {
          clearTimeout(timeout);
          // 解析返回数据结构
          try {
            if (Array.isArray(data)) {
              resolve(data.map(item => parseOnlineStatus(item)));
            } else {
              // 兼容单个对象的情况
              resolve([parseOnlineStatus(data)]);
            }
          } catch (error) {
            console.error('[cluster-ws] 解析在线状态数据失败:', error);
            resolve([]); // 解析失败返回空数组，避免阻塞
          }
        },
        reject: (error) => {
          clearTimeout(timeout);
          console.error(`[cluster-ws] 获取设备在线信息失败:`, error);
          reject(error);
        },
        timeout
      });

      try {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          const buffer = encodeProtocolMessage(request, MessageType.MSGPACK, [0]);
          this.ws.send(buffer);
          console.log(`[cluster-ws] 已请求设备在线信息 (f=${BusinessFunction.ONLINE_STATUS})`);
        } else {
          this.requestCallbacks.delete(seq);
          const error = new Error('WebSocket 未连接，无法发送请求');
          console.warn(`[cluster-ws] ${error.message}`);
          reject(error);
        }
      } catch (err) {
        this.requestCallbacks.delete(seq);
        console.error(`[cluster-ws] 发送请求失败:`, err);
        reject(err);
      }
    });
  }


  /**
   * 处理 WebSocket 消息
   * @private
   * @param data WebSocket 接收到的消息（ArrayBuffer 或 string）
   * @description 解析二进制协议消息，处理心跳、响应回调、图片消息、设备推送等
   */
  private handleMessage(data: ArrayBuffer | string) {
    try {
      let buffer: ArrayBuffer;
      if (typeof data === 'string') {
        const encoder = new TextEncoder();
        buffer = encoder.encode(data).buffer;
      } else {
        buffer = data;
      }

      const view = new DataView(buffer);
      const type = view.getUint8(0);

      if (type === MessageType.PING) {
        this.sendPong();
        return;
      }

      if (type === MessageType.PONG) {
        return;
      }

      const decoded = decodeProtocolMessage(buffer);
      if (!decoded) return;

      const { deviceIds, data: message } = decoded as { deviceIds: number[]; data: WSBaseMessage };
      console.log(`[cluster-ws] 收到消息:`, message, 'deviceIds:', deviceIds);

      // 1. 处理业务推送消息 (req=true 的主动推送)
      if (message.req === true) {
        this.dispatchPushMessage(message as WSPushMessage, deviceIds);
      }

      // 2. 处理请求响应 (带有 seq 的消息)
      if (message.seq !== undefined) {
        this.handleCommandResponse(message as WSResponse);
      }

      // 3. 处理没有 seq 也没有被已知推送逻辑命中的特殊消息 (根据用户要求记录日志)
      if (message.seq === undefined && !this.isKnownPushMessage(message.f)) {
        console.log(`[cluster-ws] 收到未知业务消息 (f=${message.f}):`, JSON.stringify(message, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
      }
    } catch (err) {
      console.error(`[cluster-ws] 解析消息失败:`, err);
    }
  }

  /**
   * 将接收到来自websocket消息时，进行分发主动推送消息
   */
  private dispatchPushMessage(message: WSPushMessage, deviceIds: number[]) {
    const f = message.f as BusinessFunction;
    switch (f) {
      case BusinessFunction.SCREENSHOT:
        this.handleImageMessage(message, deviceIds);
        break;
      case BusinessFunction.ONLINE_STATUS:
        // 移除了自动更新：推送消息不再触发 store 更新
        // 用户如需处理推送，应通过回调显式注册
        break;
      default:
        // 其他推送消息暂不处理或记录日志
        break;
    }
  }

  /**
   * 处理命令响应
   */
  private handleCommandResponse(message: WSResponse) {
    const seq = typeof message.seq === 'number' ? message.seq : Number(message.seq);

    if (this.requestCallbacks.has(seq)) {
      const callback = this.requestCallbacks.get(seq)!;
      clearTimeout(callback.timeout);
      this.requestCallbacks.delete(seq);

      if (message.code === 0 || message.code === undefined) {
        const responseData = stringifyBigInt(message.data || message);
        console.log(`[SDK-Response:Subscribe] f=${message.f} seq=${seq}`, responseData);
        callback.resolve(responseData);
      } else {
        console.error(`[SDK-Response:Subscribe] f=${message.f} seq=${seq} ERROR:`, message.msg || `错误码: ${message.code}`);
        callback.reject(new Error(message.msg || `错误码: ${message.code}`));
      }
    }
    // 移除了自动重试逻辑：不再处理丢失的回调
  }

  private isKnownPushMessage(f: number | undefined): boolean {
    if (f === undefined) return false;
    return f === BusinessFunction.ONLINE_STATUS || f === BusinessFunction.SCREENSHOT;
  }

  /**
   * 发送 pong 心跳响应
   * @private
   * @description 收到服务器 ping (type=1) 后自动回复 pong (type=2)
   */
  private sendPong(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const buffer = new ArrayBuffer(10);
      const view = new DataView(buffer);

      view.setUint8(0, MessageType.PONG); // type=2
      view.setUint8(1, 8); // header length = 8 bytes (1 deviceId)
      view.setBigUint64(2, BigInt(0), true); // deviceId=0, 小端序

      this.ws.send(buffer);
      //console.log(`[cluster-ws] 已发送心跳响应 (pong)`);
    } catch (err) {
      console.error(`[cluster-ws] 发送 pong 失败:`, err);
    }
  }

  /**
   * 启动心跳检查定时器
   * @private
   * @description 每 30 秒检查一次连接状态
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // 心跳检查：连接正常（服务器会主动发送 ping，我们回复 pong）
        // 这里只是检查连接状态，不需要主动发送 ping
      } else {
        // 连接异常，停止心跳
        this.stopHeartbeat();
      }
    }, this.heartbeatInterval);
  }

  /**
   * 停止心跳检查定时器
   * @private
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }



  /**
   * 更新服务器连接状态
   * @private
   * @param status 连接状态：online/offline/connecting
   */
  private updateServerStatus(status: ConnectionStatus) {
    console.log(`[cluster-ws] 状态变更: ${status}`);
    if (this.callbacks.onStatusChange) {
      this.callbacks.onStatusChange(status);
    }
  }


  /**
   * 获取下一个序列号
   * @private
   * @returns 递增的序列号
   */
  private getNextSeq(): number {
    return ++this.seqCounter;
  }

  /**
   * 检查 WebSocket 是否已连接
   * @returns true 表示已连接且可用
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }



  /**
   * 处理图片消息 (f=299)
   * @private
   * @param message 图片消息对象
   * @param deviceIds 设备ID数组
   * @description 解析图片数据，转换为 Blob，通知订阅者
   */
  private handleImageMessage(message: any, deviceIds?: number[]): void {
    const deviceId = deviceIds && deviceIds.length > 0 ? deviceIds[0] : 0;

    // 检查是否有错误
    if (message.code !== undefined && message.code !== 0) {
      const subscriber = this.imageSubscribers.get(deviceId);
      if (subscriber && subscriber.onError) {
        subscriber.onError(deviceId, new Error(message.msg || `图片请求失败，code=${message.code}`));
      }
      return;
    }

    // 查找订阅者
    const subscriber = this.imageSubscribers.get(deviceId);
    if (!subscriber) {
      // 如果没有特定设备的订阅者，尝试查找通用订阅者（deviceId=0）
      const generalSubscriber = this.imageSubscribers.get(0);
      if (generalSubscriber) {
        try {
          const blob = processImageData(message.data || message);
          generalSubscriber.onImage(deviceId, blob);
        } catch (err) {
          const error = err instanceof Error ? err : new Error('处理图片失败');
          if (generalSubscriber.onError) {
            generalSubscriber.onError(deviceId, error);
          }
        }
      }
      return;
    }

    try {
      const blob = processImageData(message.data || message);
      subscriber.onImage(deviceId, blob);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('处理图片失败');
      if (subscriber.onError) {
        subscriber.onError(deviceId, error);
      }
    }
  }



  /**
   * 请求设备截图 (f=299)
   * @param deviceId 设备ID
   * @param options 截图选项
   */
  public async requestDeviceImage(
    deviceId: number,
    options: {
      width?: number;
      height?: number;
      qua?: number; // 图像品质 1-100
      scale?: number; // 等比缩放到这个宽度，0=不缩放
      x?: number;
      y?: number;
      imgType?: 0 | 1 | 2; // 0=jpeg, 1=png, 2=webp
    } = {}
  ): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket 未连接');
    }

    const request = {
      f: BusinessFunction.SCREENSHOT,
      req: true,
      seq: 0,
      data: {
        x: options.x ?? 0,
        y: options.y ?? 0,
        width: options.width ?? 0,
        height: options.height ?? 0,
        qua: options.qua ?? 70,
        scale: options.scale ?? 0,
        imgType: options.imgType ?? 0
      }
    };

    try {
      const buffer = encodeProtocolMessage(request, MessageType.MSGPACK, [deviceId]);
      this.ws.send(buffer);
      console.log(`[cluster-ws] 已请求设备 ${deviceId} 截图 (f=${BusinessFunction.SCREENSHOT})`);
    } catch (err) {
      console.error(`[cluster-ws] 请求截图失败:`, err);
      throw err;
    }
  }

  /**
   * 发送原始命令（供高级用户使用）
   * @param command 命令对象
   * @param deviceIds 目标设备ID数组，默认 [0]
   */
  async sendRawCommand(command: any, deviceIds: number[] = [0]): Promise<CommandResponse> {
    if (!this.isConnected()) {
      throw new Error('WebSocket 未连接');
    }

    const seq = this.getNextSeq();
    const request = {
      ...command,
      seq: command.seq !== undefined ? command.seq : seq,
      req: command.req !== undefined ? command.req : true
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.requestCallbacks.delete(seq);
        reject(new Error('命令执行超时'));
      }, 10000);

      this.requestCallbacks.set(seq, {
        resolve: (data) => {
          clearTimeout(timeout);
          resolve(data);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout
      });

      try {
        const buffer = encodeProtocolMessage(request, MessageType.MSGPACK, deviceIds);
        this.ws!.send(buffer);
        console.log(`[cluster-ws] 已发送原始命令 (f=${request.f}, seq=${seq})`);
      } catch (err) {
        this.requestCallbacks.delete(seq);
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  /**
   * 断开 WebSocket 连接
   * @description 停止心跳、清理定时器、关闭连接
   */
  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    // 清除连接 Promise
    if (this.connectPromise) {
      this.connectPromise = null;
    }
  }
}

export { ClusterWSConnection };

