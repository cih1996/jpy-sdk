import { MirrorWSConfig, WSBaseMessage, WSResponse, WSPushMessage } from '../types';
import { BusinessFunction} from '../constants';
import { MessageType } from '../../shared/protocol';
import { encodeProtocolMessage, decodeProtocolMessage } from '../../shared/protocol';
import { stringifyBigInt, processImageData } from '../utils';

export class MirrorConnection {
  protected ws: WebSocket | null = null;
  protected config: Required<MirrorWSConfig>;
  public readonly deviceId: number;

  private seqCounter = 0;
  private connectingPromise: Promise<void> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatInterval = 30000;

  // Request callbacks map
  private requestCallbacks = new Map<number, {
    resolve: (data: any) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();

  // Seq callbacks map
  private seqCallbacks = new Map<number, {
    resolve: (data: any) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();

  // Subscribers
  public videoStreamSubscriber: ((data: Blob | ArrayBuffer | Uint8Array) => void) | null = null;
  public imageSubscribers = new Map<number, {
    onImage: (deviceId: number, blob: Blob) => void;
    onError?: (deviceId: number, error: Error) => void;
  }>();
  public screenshotCallback: {
    resolve: (blob: Blob) => void;
    reject: (error: Error) => void;
  } | null = null;

  constructor(config: MirrorWSConfig) {
    this.deviceId = config.deviceId;
    this.config = {
      deviceId: config.deviceId,
      url: config.url,
      token: config.token,
      autoReconnect: config.autoReconnect !== undefined ? config.autoReconnect : true,
      reconnectInterval: config.reconnectInterval || 3000,
      maxReconnectAttempts: config.maxReconnectAttempts || 5,
    };
  }

  private buildWSUrl(): string {
    let wsUrl = this.config.url.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
    if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
      wsUrl = 'wss://' + wsUrl;
    }
    const urlObj = new URL(wsUrl);
    if (!urlObj.pathname.includes('/box/mirror')) {
      urlObj.pathname = urlObj.pathname.replace(/\/$/, '') + '/box/mirror';
    }
    urlObj.searchParams.set('id', String(this.deviceId));
    urlObj.searchParams.set('Authorization', this.config.token);
    return urlObj.toString();
  }

  async connect(): Promise<void> {
    if (this.connectingPromise) return this.connectingPromise;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return Promise.resolve();

    this.connectingPromise = new Promise((resolve, reject) => {
      try {
        const url = this.buildWSUrl();
        console.log(`[Mirror WS] 连接中: ${url}`);
        this.ws = new WebSocket(url);
        this.ws.binaryType = 'arraybuffer';

        const timeout = setTimeout(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            this.ws.close();
            reject(new Error('连接超时'));
          }
        }, 10000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          console.log(`[Mirror WS] 连接成功`);
          this.startHeartbeat();
          resolve();
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          console.log(`[Mirror WS] 连接关闭: ${event.code}`);
          this.stopHeartbeat();
          this.ws = null;
          this.connectingPromise = null;
        };

        this.ws.onerror = (error) => {
          console.error(`[Mirror WS] 连接错误:`, error);
        };

        this.ws.onmessage = (event) => this.handleMessage(event.data);
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
        buffer = new TextEncoder().encode(data).buffer;
      } else {
        buffer = data;
      }

      const view = new DataView(buffer);
      const type = view.getUint8(0);

      if (type === MessageType.PING) {
        this.sendPong();
        return;
      }
      if (type === MessageType.PONG) return;

      const decoded = decodeProtocolMessage(buffer);
      if (decoded) {
        const { deviceIds, data: message } = decoded as { deviceIds: number[]; data: WSBaseMessage };
        
        // Dispatch to special handlers (Video/Image)
        if (this.dispatchSpecialMessage(message, type, deviceIds)) return;

        // Dispatch to request callbacks
        if (message.seq !== undefined && message.seq > 0) {
          if (this.handleSeqResponse(message as WSResponse)) return;
        }
        if (message.f !== undefined && this.handleFResponse(message as WSResponse)) return;

        console.log(`[Mirror WS] 未处理消息 (f=${message.f})`, message);
      }
    } catch (err) {
      console.error(`[Mirror WS] 解析消息失败:`, err);
    }
  }

  private dispatchSpecialMessage(message: WSBaseMessage, type: number, deviceIds: number[]): boolean {
    // Video
    if ((message.f === 9 || type === MessageType.VIDEO) && this.videoStreamSubscriber) {
      if (message.data instanceof Uint8Array || message.data instanceof ArrayBuffer) {
        this.videoStreamSubscriber(message.data);
      }
      return true;
    }
    // Screenshot
    if (message.f === BusinessFunction.SCREENSHOT) {
      this.handleScreenshotMessage(message as WSPushMessage, deviceIds);
      return true;
    }
    return false;
  }

  private handleScreenshotMessage(message: WSPushMessage, deviceIds: number[]) {
    // Clear pending request if exists
    if (message.f && this.requestCallbacks.has(message.f)) {
      const callback = this.requestCallbacks.get(message.f)!;
      clearTimeout(callback.timeout);
      this.requestCallbacks.delete(message.f);
      callback.resolve(message.data || message);
    }

    if (this.screenshotCallback && message.data) {
      try {
        const blob = processImageData(message.data || message);
        this.screenshotCallback.resolve(blob);
        this.screenshotCallback = null;
      } catch (err) {
        this.screenshotCallback?.reject(err instanceof Error ? err : new Error('处理图片失败'));
        this.screenshotCallback = null;
      }
      return;
    }
    
    // Notify subscribers
    const deviceId = deviceIds && deviceIds.length > 0 ? deviceIds[0] : this.deviceId;
    const subscriber = this.imageSubscribers.get(deviceId) || this.imageSubscribers.get(0);
    if (subscriber) {
      try {
        const blob = processImageData(message.data || message);
        subscriber.onImage(deviceId, blob);
      } catch (err) {
        if (subscriber.onError) subscriber.onError(deviceId, err instanceof Error ? err : new Error('Image Error'));
      }
    }
  }

  private handleSeqResponse(message: WSResponse): boolean {
    const seq = Number(message.seq);
    if (this.seqCallbacks.has(seq)) {
      const callback = this.seqCallbacks.get(seq)!;
      clearTimeout(callback.timeout);
      this.seqCallbacks.delete(seq);
      if (message.code === 0 || message.code === undefined) {
        callback.resolve(stringifyBigInt(message.data || message));
      } else {
        callback.reject(new Error(message.msg || `错误码: ${message.code}`));
      }
      return true;
    }
    return false;
  }

  private handleFResponse(message: WSResponse): boolean {
    if (message.f !== undefined && this.requestCallbacks.has(message.f)) {
      const callback = this.requestCallbacks.get(message.f)!;
      clearTimeout(callback.timeout);
      this.requestCallbacks.delete(message.f);
      if (message.code === 0 || message.code === undefined) {
        callback.resolve(stringifyBigInt(message.data || message));
      } else {
        callback.reject(new Error(message.msg || `错误码: ${message.code}`));
      }
      return true;
    }
    return false;
  }

  private sendPing() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      const buffer = new ArrayBuffer(10);
      const view = new DataView(buffer);
      view.setUint8(0, MessageType.PING);
      view.setUint8(1, 8);
      view.setBigUint64(2, BigInt(this.deviceId), true);
      this.ws.send(buffer);
    } catch (e) { console.error('Ping failed', e); }
  }

  private sendPong() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      const buffer = new ArrayBuffer(10);
      const view = new DataView(buffer);
      view.setUint8(0, MessageType.PONG);
      view.setUint8(1, 8);
      view.setBigUint64(2, BigInt(this.deviceId), true);
      this.ws.send(buffer);
    } catch (e) { console.error('Pong failed', e); }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => this.sendPing(), this.heartbeatInterval);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private getNextSeq(): number {
    return ++this.seqCounter;
  }

  async sendCommand(command: { f: number; data?: any; req?: boolean; seq?: number }, deviceIds?: number[]): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error('WebSocket 未连接');

    const seq = command.seq !== undefined ? command.seq : this.getNextSeq();
    const request = {
      f: command.f,
      req: command.req !== undefined ? command.req : true,
      data: command.data || null,
      code: 0,
      msg: '',
      t: 0,
      seq
    };

    const fKey = command.f;
    return new Promise((resolve, reject) => {
      if (this.requestCallbacks.has(fKey)) {
        const old = this.requestCallbacks.get(fKey)!;
        clearTimeout(old.timeout);
        old.reject(new Error('被新请求覆盖'));
      }

      const timeout = setTimeout(() => {
        this.requestCallbacks.delete(fKey);
        reject(new Error('命令执行超时'));
      }, 10000);

      this.requestCallbacks.set(fKey, {
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
        const targetIds = deviceIds || [this.deviceId];
        const buffer = encodeProtocolMessage(request, MessageType.MSGPACK, targetIds);
        this.ws!.send(buffer);
        console.log(`[Mirror] Send f=${command.f} seq=${seq}`);
      } catch (err) {
        this.requestCallbacks.delete(fKey);
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectingPromise = null;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
