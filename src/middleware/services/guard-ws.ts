/**
 * Guard WebSocket 连接管理器
 * 用于发送控制指令（USB模式切换、电源控制等）
 */

import { encodeProtocolMessage, decodeProtocolMessage, MessageType } from '../../shared/protocol';
import { bigIntToNumber, stringifyBigInt } from '../utils';
import { GuardWSConfig, ROMFlashProgressData, CommandResponse, ROMPackage, BatchOperationResult, WSResponse, WSPushMessage, WSBaseMessage } from '../types';
import { BusinessFunction } from '../constants';

export class GuardWebSocket {
  private ws: WebSocket | null = null;
  private config: Required<GuardWSConfig>;
  private deviceId: number; // 设备ID（盘位）

  private seqCounter = 0;
  private connectingPromise: Promise<void> | null = null; // 正在连接中的 Promise
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatInterval = 30000; // 30秒心跳检查
  private requestCallbacks = new Map<number, {
    resolve: (data: any) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();
  // 终端数据回调
  public onTerminalData: ((data: Uint8Array) => void) | null = null;
  // ROM刷入进度回调（f=118消息）
  public onROMFlashProgress: ((data: ROMFlashProgressData) => void) | null = null;

  constructor(config: GuardWSConfig) {
    this.deviceId = config.deviceId || 0; // 默认0
    this.config = {
      url: config.url,
      token: config.token,
      deviceId: config.deviceId || 0,
      autoReconnect: config.autoReconnect !== undefined ? config.autoReconnect : true,
      reconnectInterval: config.reconnectInterval || 3000,
      maxReconnectAttempts: config.maxReconnectAttempts || 5,
    };
  }

  private buildWSUrl(): string {
    // 将 https:// 转换为 wss://
    let wsUrl = this.config.url.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
    if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
      wsUrl = 'wss://' + wsUrl;
    }

    // 添加路径后缀
    const urlObj = new URL(wsUrl);
    if (!urlObj.pathname.includes('/box/guard')) {
      urlObj.pathname = urlObj.pathname.replace(/\/$/, '') + '/box/guard';
    }

    // 添加查询参数
    urlObj.searchParams.set('id', String(this.deviceId));
    urlObj.searchParams.set('Authorization', this.config.token);

    return urlObj.toString();
  }

  async connect(): Promise<void> {
    // 如果已经在连接中，等待现有连接完成
    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    // 如果已经连接，直接返回
    if (this.isConnected()) {
      return Promise.resolve();
    }

    // 创建新的连接 Promise
    this.connectingPromise = new Promise((resolve, reject) => {
      try {

        const wsUrl = this.buildWSUrl();
        console.log(`[Guard WS] 连接中: ${wsUrl.replace(/Authorization=[^&]+/, 'Authorization=***')}`);

        // 如果已有 WebSocket，先关闭
        if (this.ws) {
          try {
            this.ws.close();
          } catch (e) {
            // 忽略关闭错误
          }
          this.ws = null;
        }

        this.ws = new WebSocket(wsUrl);
        this.ws.binaryType = 'arraybuffer';

        const connectTimeout = setTimeout(() => {
          if (this.ws) {
            this.ws.close();
          }
          this.connectingPromise = null;
          reject(new Error('连接超时'));
        }, 15000); // 增加到 15 秒

        this.ws.onopen = () => {
          clearTimeout(connectTimeout);
          console.log(`[Guard WS] device ${this.deviceId} 连接成功`);

          this.connectingPromise = null;
          this.startHeartbeat(); // 启动心跳
          // 等待一小段时间确保连接完全就绪
          setTimeout(() => {
            resolve();
          }, 100);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error(`[Guard WS] device ${this.deviceId} 连接错误:`, error);
        };

        this.ws.onclose = (event) => {
          clearTimeout(connectTimeout);
          console.log(`[Guard WS] device ${this.deviceId} 连接关闭:`, event.code, event.reason);
          this.connectingPromise = null;
          this.stopHeartbeat(); // 停止心跳

          // 清除所有相关的状态
          this.onTerminalData = null;
          this.onTerminalOutput = null;
          this.terminalOutputBuffer = '';
          this.terminalInitialized = false;
          this.terminalReady = false;
          this.terminalReadyCallbacks = [];
        };
      } catch (err) {
        this.connectingPromise = null;
        reject(err);
      }
    });

    return this.connectingPromise;
  }

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

      // 处理终端数据（type=13）
      if (type === MessageType.TERMINAL) {
        this.handleTerminalMessage(buffer);
        return;
      }

      // 处理 msgpack 消息（type=6）
      if (type === MessageType.MSGPACK) {
        const decoded = decodeProtocolMessage(buffer);
        if (decoded) {
          this.dispatchSpecialMsgpackMessage(decoded);
        }
      }
    } catch (err) {
      console.error(`[Guard WS] 解析消息失败:`, err);
    }
  }

  /**
   * 处理终端业务消息
   */
  private handleTerminalMessage(buffer: ArrayBuffer) {
    if (this.deviceId > 0) {
      const dataStart = 10;
      if (buffer.byteLength > dataStart) {
        const terminalData = new Uint8Array(buffer, dataStart);
        const decoder = new TextDecoder();
        const text = decoder.decode(terminalData);

        // console.log(`[Guard Terminal ${this.deviceId}] 收到终端数据 (type=13):`, { rawLength: terminalData.length, textLength: text.length });

        this.terminalOutputBuffer += text;

        if (!this.terminalReady && this.terminalInitialized) {
          if (this.terminalOutputBuffer.includes('$')) {
            this.terminalReady = true;
            this.terminalReadyCallbacks.forEach(callback => callback());
            this.terminalReadyCallbacks = [];
          }
        }

        if (this.onTerminalData) this.onTerminalData(terminalData);
        if (this.onTerminalOutput) this.onTerminalOutput(this.terminalOutputBuffer);
      }
    }
  }

  /**
   * 分发 Msgpack 消息
   */
  private dispatchSpecialMsgpackMessage(decoded: { deviceIds: number[]; data: WSBaseMessage }) {
    const { deviceIds: _deviceIds, data: message } = decoded;

    // console.log(`[Guard WS] device ${this.deviceId} 收到消息:`, deepSerialize(message), 'deviceIds:', deviceIds);

    // 1. 处理主动推送
    if (message.req === true) {
      if (message.f === BusinessFunction.FLASH_ROM_PROGRESS) {
        this.handleFlashROMProgressMessage(message as WSPushMessage);
        return;
      }
    }

    // 2. 处理请求响应
    if (message.seq !== undefined && this.requestCallbacks.has(message.seq)) {
      this.handleCommandResponse(message as WSResponse);
    }
  }

  /**
   * 处理刷机进度消息
   */
  private handleFlashROMProgressMessage(message: WSPushMessage) {
    if (this.onROMFlashProgress && message.data) {
      const flashData = stringifyBigInt(message.data);
      this.onROMFlashProgress({
        seat: flashData.seat || 0,
        sn: flashData.sn || '',
        mode: flashData.mode || 0,
        status: flashData.status || 0,
        session: flashData.session || '',
        image: flashData.image || '',
        queueTime: flashData.queueTime || 0,
        startTime: flashData.startTime || 0,
        endTime: flashData.endTime || 0,
        lastError: flashData.lastError || '',
        progress: 0,
        step: '',
        message: ''
      });
    }
  }

  /**
   * 处理命令响应
   */
  private handleCommandResponse(message: WSResponse) {
    const callback = this.requestCallbacks.get(message.seq!)!;
    clearTimeout(callback.timeout);
    this.requestCallbacks.delete(message.seq!);

    if (message.code === 0 || message.code === undefined) {
      const rawData = message.data ? message.data : message;
      // 对返回数据进行 BigInt 字符串化处理，确保 consistency
      const responseData = stringifyBigInt(rawData);
      console.log(`[SDK-Response:Guard] f=${message.f} seq=${message.seq} deviceId=${this.deviceId}`, responseData);
      callback.resolve(responseData);
    } else {
      console.error(`[SDK-Response:Guard] f=${message.f} seq=${message.seq} deviceId=${this.deviceId} ERROR:`, message.msg || `错误码: ${message.code}`);
      callback.reject(new Error(message.msg || `错误码: ${message.code}`));
    }
  }

  /**
   * 发送 ping 心跳包
   */
  private sendPing(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const buffer = new ArrayBuffer(10);
      const view = new DataView(buffer);

      view.setUint8(0, MessageType.PING); // type=1
      view.setUint8(1, 8); // header length = 8 bytes (1 deviceId)
      view.setBigUint64(2, BigInt(this.deviceId), true); // 使用配置的 deviceId，小端序

      this.ws.send(buffer);
      //console.log(`[Guard WS] guard-ws 已发送心跳包 (ping)`);
    } catch (err) {
      console.error(`[Guard WS] guard-ws 发送 ping 失败:`, err);
    }
  }

  private sendPong(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const buffer = new ArrayBuffer(10);
      const view = new DataView(buffer);

      view.setUint8(0, MessageType.PONG); // type=2
      view.setUint8(1, 8); // header length = 8 bytes (1 deviceId)
      view.setBigUint64(2, BigInt(this.deviceId), true); // 使用配置的 deviceId，小端序

      this.ws.send(buffer);
      console.log(`[Guard WS] guard-ws 已发送心跳响应 (pong)`);
    } catch (err) {
      console.error(`[Guard WS] guard-ws 发送 pong 失败:`, err);
    }
  }

  /**
   * 启动心跳检查（定时主动发送 ping）
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // 主动发送 ping 心跳包（格式和 subscribe 一样）
        this.sendPing();
      } else {
        // 连接异常，停止心跳
        this.stopHeartbeat();
      }
    }, this.heartbeatInterval);
  }

  /**
   * 停止心跳检查
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }



  private getNextSeq(): number {
    return ++this.seqCounter;
  }

  // 注意：不再更新 Guard 状态到 store，因为 Guard 只在批量操作时临时连接

  /**
   * 切换 USB 口模式 (f=106)
   * @param seat 盘位号
   * @param mode 模式：0=OTG, 1=USB
   */
  async switchUSBMode(seat: number, mode: 0 | 1): Promise<CommandResponse> {
    // 确保连接已建立
    if (!this.isConnected()) {
      throw new Error('WebSocket 未连接');
    }

    const seq = this.getNextSeq();
    const request = {
      f: BusinessFunction.SWITCH_USB_MODE,
      req: true,
      data: {
        seat,
        mode
      },
      code: 0,
      msg: '',
      t: 0,
      seq
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.requestCallbacks.delete(seq);
        reject(new Error('切换 USB 模式超时'));
      }, 10000);

      this.requestCallbacks.set(seq, {
        resolve: (data) => {
          clearTimeout(timeout);
          console.log(`[Guard WS] USB 模式切换成功 (seat=${seat}, mode=${mode}):`, data);
          resolve(data);
        },
        reject: (error) => {
          clearTimeout(timeout);
          console.error(`[Guard WS] USB 模式切换失败 (seat=${seat}, mode=${mode}):`, error);
          reject(error);
        },
        timeout
      });

      try {
        // 再次检查连接状态，确保在发送前连接仍然有效
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          this.requestCallbacks.delete(seq);
          clearTimeout(timeout);
          reject(new Error('WebSocket 未连接'));
          return;
        }

        const buffer = encodeProtocolMessage(request, MessageType.MSGPACK, [0]);
        this.ws.send(buffer);
        console.log(`[Guard WS] 已发送 USB 模式切换请求 (f=106, seat=${seat}, mode=${mode})`);
      } catch (err) {
        this.requestCallbacks.delete(seq);
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  /**
   * 电源控制 (f=107)
   * @param seat 盘位号
   * @param mode 模式：0=断电, 1=供电, 2=强制重启
   */
  async powerControl(seat: number, mode: 0 | 1 | 2): Promise<CommandResponse> {
    // 确保连接已建立
    if (!this.isConnected()) {
      throw new Error('WebSocket 未连接');
    }

    const seq = this.getNextSeq();
    const request = {
      f: BusinessFunction.POWER_CONTROL,
      req: true,
      data: {
        seat,
        mode
      },
      code: 0,
      msg: '',
      t: 0,
      seq
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.requestCallbacks.delete(seq);
        reject(new Error('电源控制超时'));
      }, 10000);

      this.requestCallbacks.set(seq, {
        resolve: (data) => {
          clearTimeout(timeout);
          console.log(`[Guard WS] 电源控制成功 (seat=${seat}, mode=${mode}):`, data);
          resolve(data);
        },
        reject: (error) => {
          clearTimeout(timeout);
          console.error(`[Guard WS] 电源控制失败 (seat=${seat}, mode=${mode}):`, error);
          reject(error);
        },
        timeout
      });

      try {
        // 再次检查连接状态，确保在发送前连接仍然有效
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          this.requestCallbacks.delete(seq);
          clearTimeout(timeout);
          reject(new Error('WebSocket 未连接'));
          return;
        }

        const buffer = encodeProtocolMessage(request, MessageType.MSGPACK, [0]);
        this.ws.send(buffer);
        console.log(`[Guard WS] 已发送电源控制请求 (f=${BusinessFunction.POWER_CONTROL}, seat=${seat}, mode=${mode})`);
      } catch (err) {
        this.requestCallbacks.delete(seq);
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  /**
   * 批量切换 USB 模式
   * @param seats 盘位号数组
   * @param mode 模式：0=OTG, 1=USB
   */
  async batchSwitchUSBMode(seats: number[], mode: 0 | 1): Promise<BatchOperationResult[]> {
    const results = await Promise.allSettled(
      seats.map(seat =>
        this.switchUSBMode(seat, mode)
          .then(() => ({ seat, success: true }))
          .catch(err => ({ seat, success: false, error: err instanceof Error ? err.message : String(err) }))
      )
    );

    return results.map((result, index) =>
      result.status === 'fulfilled'
        ? result.value
        : { seat: seats[index], success: false, error: result.reason?.message || '未知错误' }
    );
  }

  /**
   * 批量电源控制
   * @param seats 盘位号数组
   * @param mode 模式：0=断电, 1=供电, 2=强制重启
   */
  async batchPowerControl(seats: number[], mode: 0 | 1 | 2): Promise<BatchOperationResult[]> {
    const results = await Promise.allSettled(
      seats.map(seat =>
        this.powerControl(seat, mode)
          .then(() => ({ seat, success: true }))
          .catch(err => ({ seat, success: false, error: err instanceof Error ? err.message : String(err) }))
      )
    );

    return results.map((result, index) =>
      result.status === 'fulfilled'
        ? result.value
        : { seat: seats[index], success: false, error: result.reason?.message || '未知错误' }
    );
  }

  /**
   * 开启 ADB (f=109)
   * @param seat 盘位号
   * @param mode 模式：2=开启ADB
   */
  async enableADB(seat: number, mode: number = 2): Promise<CommandResponse> {
    // 确保连接已建立
    if (!this.isConnected()) {
      throw new Error('WebSocket 未连接');
    }

    const seq = this.getNextSeq();
    const request = {
      f: 109,
      req: true,
      data: {
        seat,
        mode
      },
      code: 0,
      msg: '',
      t: 0,
      seq
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.requestCallbacks.delete(seq);
        reject(new Error('开启 ADB 超时'));
      }, 10000);

      this.requestCallbacks.set(seq, {
        resolve: (data) => {
          clearTimeout(timeout);
          console.log(`[Guard WS] 开启 ADB 成功 (seat=${seat}, mode=${mode}):`, data);
          resolve(data);
        },
        reject: (error) => {
          clearTimeout(timeout);
          console.error(`[Guard WS] 开启 ADB 失败 (seat=${seat}, mode=${mode}):`, error);
          reject(error);
        },
        timeout
      });

      try {
        // 再次检查连接状态，确保在发送前连接仍然有效
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          this.requestCallbacks.delete(seq);
          clearTimeout(timeout);
          reject(new Error('WebSocket 未连接'));
          return;
        }

        const buffer = encodeProtocolMessage(request, MessageType.MSGPACK, [0]);
        this.ws.send(buffer);
        console.log(`[Guard WS] 已发送开启 ADB 请求 (f=${BusinessFunction.ENABLE_ADB}, seat=${seat}, mode=${mode})`);
      } catch (err) {
        this.requestCallbacks.delete(seq);
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  /**
   * 批量开启 ADB
   * @param seats 盘位号数组
   * @param mode 模式：2=开启ADB
   */
  async batchEnableADB(seats: number[], mode: number = 2): Promise<BatchOperationResult[]> {
    const results = await Promise.allSettled(
      seats.map(seat =>
        this.enableADB(seat, mode)
          .then(() => ({ seat, success: true }))
          .catch(err => ({ seat, success: false, error: err instanceof Error ? err.message : String(err) }))
      )
    );

    return results.map((result, index) =>
      result.status === 'fulfilled'
        ? result.value
        : { seat: seats[index], success: false, error: result.reason?.message || '未知错误' }
    );
  }

  /**
   * 强开刷机（模式2）(f=108)
   * @param seat 盘位号
   * @param mode 模式，固定为2
   */
  async forceFlashROM(seat: number, mode: number = 2): Promise<CommandResponse> {
    // 确保连接已建立
    if (!this.isConnected()) {
      throw new Error('WebSocket 未连接');
    }

    const seq = this.getNextSeq();
    const request = {
      f: 108,
      req: true,
      seq,
      data: {
        seat,
        mode
      }
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.requestCallbacks.delete(seq);
        reject(new Error('强开刷机超时'));
      }, 10000);

      this.requestCallbacks.set(seq, {
        resolve: (data) => {
          clearTimeout(timeout);
          console.log(`[Guard WS] 强开刷机成功 (seat=${seat}, mode=${mode}):`, data);
          resolve(data);
        },
        reject: (error) => {
          clearTimeout(timeout);
          console.error(`[Guard WS] 强开刷机失败 (seat=${seat}, mode=${mode}):`, error);
          reject(error);
        },
        timeout
      });

      try {
        // 再次检查连接状态
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          this.requestCallbacks.delete(seq);
          clearTimeout(timeout);
          reject(new Error('WebSocket 未连接'));
          return;
        }

        const buffer = encodeProtocolMessage(request, MessageType.MSGPACK, [0]);
        this.ws.send(buffer);
        console.log(`[Guard WS] 已发送强开刷机请求 (f=${BusinessFunction.FORCE_FLASH_ROM}, seat=${seat}, mode=${mode})`);
      } catch (err) {
        this.requestCallbacks.delete(seq);
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  /**
   * 批量强开刷机
   * @param seats 盘位号数组
   * @param mode 模式，固定为2
   */
  async batchForceFlashROM(seats: number[], mode: number = 2): Promise<BatchOperationResult[]> {
    const results = await Promise.allSettled(
      seats.map(seat =>
        this.forceFlashROM(seat, mode)
          .then(() => ({ seat, success: true }))
          .catch(err => ({ seat, success: false, error: err instanceof Error ? err.message : String(err) }))
      )
    );

    return results.map((result, index) =>
      result.status === 'fulfilled'
        ? result.value
        : { seat: seats[index], success: false, error: result.reason?.message || '未知错误' }
    );
  }

  /**
   * 删除ROM包 (f=114)
   */
  async deleteROMPackage(packageName: string): Promise<CommandResponse> {
    // 确保连接已建立
    if (!this.isConnected()) {
      throw new Error('WebSocket 未连接');
    }

    const seq = this.getNextSeq();
    const request = {
      f: 114,
      req: true,
      seq,
      data: packageName
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.requestCallbacks.delete(seq);
        reject(new Error('删除ROM包超时'));
      }, 10000);

      this.requestCallbacks.set(seq, {
        resolve: (data) => {
          clearTimeout(timeout);
          console.log(`[Guard WS] 删除ROM包成功:`, data);
          resolve(data);
        },
        reject: (error) => {
          clearTimeout(timeout);
          console.error(`[Guard WS] 删除ROM包失败:`, error);
          reject(error);
        },
        timeout
      });

      try {
        // 再次检查连接状态
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          this.requestCallbacks.delete(seq);
          clearTimeout(timeout);
          reject(new Error('WebSocket 未连接'));
          return;
        }

        const buffer = encodeProtocolMessage(request, MessageType.MSGPACK, [0]);
        this.ws.send(buffer);
        console.log(`[Guard WS] 已发送删除ROM包请求 (f=${BusinessFunction.DELETE_ROM_PACKAGE}, package=${packageName})`);
      } catch (err) {
        this.requestCallbacks.delete(seq);
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  /**
   * 获取ROM包列表 (f=113)
   */
  async getROMPackages(): Promise<ROMPackage[]> {
    // 确保连接已建立
    if (!this.isConnected()) {
      throw new Error('WebSocket 未连接');
    }

    const seq = this.getNextSeq();
    const request = {
      f: BusinessFunction.GET_ROM_PACKAGES,
      req: true,
      seq
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.requestCallbacks.delete(seq);
        reject(new Error('获取ROM包列表超时'));
      }, 10000);

      this.requestCallbacks.set(seq, {
        resolve: (data) => {
          clearTimeout(timeout);
          console.log(`[Guard WS] 获取ROM包列表成功:`, data);
          // data 应该是数组
          if (Array.isArray(data)) {
            // 隐式类转换
            resolve(data);
            // 显式类型转换
            // const romPackages = data.map((item: any) => ({
            //   name: item.name || '',
            //   size: item.size || 0,
            //   md5: item.md5 || '',
            //   date: item.date || ''
            // }));
          } else {
            resolve([]);
          }
        },
        reject: (error) => {
          clearTimeout(timeout);
          console.error(`[Guard WS] 获取ROM包列表失败:`, error);
          reject(error);
        },
        timeout
      });

      try {
        // 再次检查连接状态
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          this.requestCallbacks.delete(seq);
          clearTimeout(timeout);
          reject(new Error('WebSocket 未连接'));
          return;
        }

        const buffer = encodeProtocolMessage(request, MessageType.MSGPACK, [0]);
        this.ws.send(buffer);
        console.log(`[Guard WS] 已发送获取ROM包列表请求 (f=${BusinessFunction.GET_ROM_PACKAGES})`);
      } catch (err) {
        this.requestCallbacks.delete(seq);
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  /**
   * 查询刷机状态 (f=117)
   * @returns 返回刷机状态列表
   */
  async queryFlashStatus(): Promise<ROMFlashProgressData[]> {
    // 确保连接已建立
    if (!this.isConnected()) {
      throw new Error('WebSocket 未连接');
    }

    const seq = this.getNextSeq();
    const request = {
      f: BusinessFunction.QUERY_FLASH_STATUS,
      req: true,
      seq
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.requestCallbacks.delete(seq);
        reject(new Error('查询刷机状态超时'));
      }, 10000);

      this.requestCallbacks.set(seq, {
        resolve: (data) => {
          clearTimeout(timeout);
          console.log(`[Guard WS] 查询刷机状态成功:`, data);
          // data 应该是数组
          if (Array.isArray(data)) {
            // 显式类型转换
            const result = data.map((item: any) => ({
              seat: item.seat || 0,
              sn: item.sn || '',
              mode: item.mode || 0,
              status: item.status || 0,
              session: item.session || '',
              image: item.image || '',
              queueTime: bigIntToNumber(item.queueTime),
              startTime: bigIntToNumber(item.startTime),
              endTime: bigIntToNumber(item.endTime),
              lastError: item.lastError || '',
              progress: 0,
              step: '',
              message: ''
            }));
            resolve(result);
          } else {
            resolve([]);
          }
        },
        reject: (error) => {
          clearTimeout(timeout);
          console.error(`[Guard WS] 查询刷机状态失败:`, error);
          reject(error);
        },
        timeout
      });

      try {
        // 再次检查连接状态
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          this.requestCallbacks.delete(seq);
          clearTimeout(timeout);
          reject(new Error('WebSocket 未连接'));
          return;
        }

        const buffer = encodeProtocolMessage(request, MessageType.MSGPACK, [0]);
        this.ws.send(buffer);
        console.log(`[Guard WS] 已发送查询刷机状态请求 (f=${BusinessFunction.QUERY_FLASH_STATUS})`);
      } catch (err) {
        this.requestCallbacks.delete(seq);
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  /**
   * 刷入ROM包 (f=119)
   * @param seat 盘位号
   * @param sn 设备序列号
   * @param image ROM镜像ID（name字段）
   * @param mode 模式，固定为2
   */
  async flashROM(seat: number, sn: string, image: string, mode: number = 2): Promise<CommandResponse> {
    // 确保连接已建立
    if (!this.isConnected()) {
      throw new Error('WebSocket 未连接');
    }

    const seq = this.getNextSeq();
    const request = {
      f: BusinessFunction.FLASH_ROM,
      req: true,
      seq,
      data: {
        seat,
        sn,
        image,
        mode
      }
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.requestCallbacks.delete(seq);
        reject(new Error('刷入ROM包超时'));
      }, 30000); // 30秒超时，因为刷入可能需要较长时间

      this.requestCallbacks.set(seq, {
        resolve: (data) => {
          clearTimeout(timeout);
          console.log(`[Guard WS] 刷入ROM包成功 (seat=${seat}, sn=${sn}, image=${image}):`, data);
          resolve(data);
        },
        reject: (error) => {
          clearTimeout(timeout);
          console.error(`[Guard WS] 刷入ROM包失败 (seat=${seat}, sn=${sn}, image=${image}):`, error);
          reject(error);
        },
        timeout
      });

      try {
        // 再次检查连接状态
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          this.requestCallbacks.delete(seq);
          clearTimeout(timeout);
          reject(new Error('WebSocket 未连接'));
          return;
        }

        const buffer = encodeProtocolMessage(request, MessageType.MSGPACK, [0]);
        this.ws.send(buffer);
        console.log(`[Guard WS] 已发送刷入ROM包请求 (f=${BusinessFunction.FLASH_ROM}, seat=${seat}, sn=${sn}, image=${image})`);
      } catch (err) {
        this.requestCallbacks.delete(seq);
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  /**
   * 发送终端数据（type=13）
   * @param data 要发送的字节数据
   */
  sendTerminal(data: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket 未连接');
    }

    // 格式：type(1) + headerLength(1) + deviceId(8) + data
    const buffer = new ArrayBuffer(10 + data.byteLength);
    const view = new DataView(buffer);

    view.setUint8(0, 13); // type=13
    view.setUint8(1, 8); // header length = 8 bytes (1 deviceId)
    view.setBigUint64(2, BigInt(this.deviceId), true); // deviceId，小端序

    // 复制数据
    new Uint8Array(buffer, 10).set(data);

    this.ws.send(buffer);
    console.log(`[Guard WS] device ${this.deviceId} 已发送终端数据 (${data.byteLength} bytes)`);
  }

  /**
   * 发送原始消息（用于发送 msgpack 格式的消息）
   * @param buffer 要发送的 ArrayBuffer
   */
  sendRaw(buffer: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket 未连接');
    }
    this.ws.send(buffer);
  }

  /**
   * 发送原始命令（供高级用户使用）
   * @param command 命令对象
   */
  async sendRawCommand(command: any): Promise<CommandResponse> {
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
        const buffer = encodeProtocolMessage(request, MessageType.MSGPACK, [0]);
        this.ws!.send(buffer);
        console.log(`[Guard WS] device ${this.deviceId} 已发送原始命令 (f=${request.f}, seq=${seq})`);
      } catch (err) {
        this.requestCallbacks.delete(seq);
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  // 终端输出缓冲区（用于诊断功能）
  private terminalOutputBuffer: string = '';
  // 终端输出回调（用于诊断功能）
  public onTerminalOutput: ((output: string) => void) | null = null;

  // 终端初始化标志（用于诊断功能）
  private terminalInitialized = false;
  // 终端就绪标志（检测到 $ 字符）
  private terminalReady = false;
  // 终端就绪回调（用于等待终端就绪）
  private terminalReadyCallbacks: Array<() => void> = [];

  /**
   * 初始化终端（发送 f=9 请求并等待终端就绪）
   * 必须在发送命令前调用
   * 会等待终端返回 $ 字符（0x24）表示终端已就绪
   */
  private async initializeTerminal(): Promise<void> {
    if (this.terminalInitialized || this.deviceId === 0) {
      // 如果已初始化，检查是否就绪
      if (this.terminalReady) {
        return;
      }
      // 如果已初始化但未就绪，等待就绪
      await this.waitForTerminalReady();
      return;
    }

    try {
      // 重置就绪标志
      this.terminalReady = false;
      this.terminalOutputBuffer = ''; // 清空缓冲区，准备接收新的输出

      const initRequest = {
        f: BusinessFunction.TERMINAL_INIT,
        req: true,
        seq: 0,
        data: {
          action: 1,
          rows: 36,
          cols: 120
        }
      };

      const buffer = encodeProtocolMessage(initRequest, MessageType.MSGPACK, [this.deviceId]);
      if (this.isConnected()) {
        this.ws!.send(buffer);
        this.terminalInitialized = true;
        console.log(`[Guard Terminal ${this.deviceId}] 已发送终端初始化请求 (f=${BusinessFunction.TERMINAL_INIT})，等待终端就绪...`);

        // 等待终端就绪（检测到 $ 字符）
        await this.waitForTerminalReady();
      }
    } catch (err) {
      console.error(`[Guard Terminal ${this.deviceId}] 终端初始化失败:`, err);
      throw err;
    }
  }

  /**
   * 等待终端就绪（检测到 $ 字符，hex 0x24）
   * 最多等待3秒
   */
  private async waitForTerminalReady(): Promise<void> {
    // 如果已经就绪，直接返回
    if (this.terminalReady) {
      return;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // 移除回调
        const index = this.terminalReadyCallbacks.indexOf(resolve);
        if (index > -1) {
          this.terminalReadyCallbacks.splice(index, 1);
        }
        reject(new Error('等待终端就绪超时（3秒内未检测到 $ 字符）'));
      }, 3000); // 最多等待3秒

      // 添加就绪回调
      const readyCallback = () => {
        clearTimeout(timeout);
        const index = this.terminalReadyCallbacks.indexOf(readyCallback);
        if (index > -1) {
          this.terminalReadyCallbacks.splice(index, 1);
        }
        resolve();
      };
      this.terminalReadyCallbacks.push(readyCallback);

      // 立即检查一次（可能已经就绪）
      if (this.terminalReady) {
        readyCallback();
      }
    });
  }

  /**
   * 发送自定义命令（通过终端逐个字符发送）
   * @param command shell 命令字符串
   * @param onOutput 输出回调（已废弃，回调应该在连接时设置）
   */
  async sendCommand(
    command: string,
    _onOutput?: (output: string) => void // 保留参数以兼容，但不再使用
  ): Promise<string> {
    // 确保连接已建立
    if (!this.isConnected()) {
      throw new Error('WebSocket 未连接');
    }

    // 确保 deviceId > 0（终端功能只支持特定设备）
    if (this.deviceId === 0) {
      throw new Error('终端命令只支持特定设备（deviceId > 0）');
    }

    // 先初始化终端（如果还未初始化），并等待终端就绪
    if (!this.terminalInitialized) {
      await this.initializeTerminal();
    } else if (!this.terminalReady) {
      // 如果已初始化但未就绪，等待就绪
      await this.waitForTerminalReady();
    }

    // 不清空输出缓冲区，继续累积数据
    // 注意：onTerminalOutput 回调应该在连接时就设置好了，这里不再设置

    console.log(`[Guard Terminal ${this.deviceId}] sendCommand 开始，命令:`, command, '终端已就绪，缓冲区不清空，继续累积数据');

    return new Promise((resolve, reject) => {
      try {
        // 再次检查连接状态
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket 未连接'));
          return;
        }

        // 记录发送命令前的缓冲区长度（用于提取本次命令的输出）
        const bufferBeforeCommand = this.terminalOutputBuffer.length;
        console.log(`[Guard Terminal ${this.deviceId}] 发送命令前缓冲区长度:`, bufferBeforeCommand);

        // 逐个字符发送命令
        const encoder = new TextEncoder();
        const commandBytes = encoder.encode(command + '\n'); // 添加换行符

        // 逐个字符发送（添加小延迟避免过快）
        let charIndex = 0;
        const sendNextChar = () => {
          if (charIndex >= commandBytes.length) {
            // 所有字符发送完成，等待一段时间后返回结果
            console.log(`[Guard Terminal ${this.deviceId}] 所有字符发送完成，当前缓冲区长度:`, this.terminalOutputBuffer.length);
            setTimeout(() => {
              // 返回完整的累积输出（不清空）
              const result = this.terminalOutputBuffer;
              console.log(`[Guard Terminal ${this.deviceId}] sendCommand 完成，最终输出长度:`, result.length, '输出预览:', result.substring(0, 200));
              resolve(result);
            }, 2000); // 等待2秒，确保命令输出已接收
            return;
          }

          const charByte = new Uint8Array([commandBytes[charIndex]]);
          this.sendTerminal(charByte);
          charIndex++;

          // 添加小延迟（10ms）避免发送过快
          setTimeout(sendNextChar, 10);
        };

        sendNextChar();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 断开连接
   */
  disconnect() {
    this.connectingPromise = null; // 清除连接中的 Promise
    this.stopHeartbeat(); // 停止心跳
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.onTerminalData = null; // 清除终端回调
    this.onTerminalOutput = null; // 清除输出回调
    this.terminalOutputBuffer = ''; // 清空输出缓冲区
    this.terminalInitialized = false; // 重置初始化标志
    this.terminalReady = false; // 重置就绪标志
    this.terminalReadyCallbacks = []; // 清空就绪回调
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
