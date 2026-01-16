import { MiddlewareClient } from '../client';
import { GuardWebSocket } from '../services/guard-ws';
import { BatchOperationResult, CommandResponse, ROMFlashProgressData, ROMPackage } from '../types';

/**
 * Guard WebSocket 模块
 * 用于设备控制(USB模式、电源、ADB、刷机等)
 */
export class GuardModule {
  private guardWS: GuardWebSocket | null = null;

  constructor(private client: MiddlewareClient) { }

  /**
   * 连接Guard WebSocket
   * @param deviceId 设备ID(盘位),默认0(针对整个服务器)
   */
  async connect(deviceId: number = 0): Promise<void> {
    this.guardWS = new GuardWebSocket({
      deviceId,
      url: this.client.getApiBase(),
      token: this.client.getToken(),
      autoReconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 5
    });
    await this.guardWS.connect();
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.guardWS) {
      this.guardWS.disconnect();
      this.guardWS = null;
    }
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.guardWS !== null && this.guardWS.isConnected();
  }

  /**
   * 获取GuardWebSocket实例(用于高级操作)
   */
  getInstance(): GuardWebSocket | null {
    return this.guardWS;
  }

  /**
   * 切换USB口模式
   * @param seat 盘位号
   * @param mode 模式: 0=OTG, 1=USB
   */
  async switchUSBMode(seat: number, mode: 0 | 1): Promise<CommandResponse> {
    if (!this.guardWS) throw new Error('Guard WebSocket未连接');
    return this.guardWS.switchUSBMode(seat, mode);
  }

  async batchSwitchUSBMode(seats: number[], mode: 0 | 1): Promise<BatchOperationResult[]> {
    if (!this.guardWS) throw new Error('Guard WebSocket未连接');
    return this.guardWS.batchSwitchUSBMode(seats, mode);
  }

  /**
   * 电源控制
   * @param seat 盘位号
   * @param mode 模式: 0=断电, 1=供电, 2=强制重启
   */
  async powerControl(seat: number, mode: 0 | 1 | 2): Promise<CommandResponse> {
    if (!this.guardWS) throw new Error('Guard WebSocket未连接');
    return this.guardWS.powerControl(seat, mode);
  }

  async batchPowerControl(seats: number[], mode: 0 | 1 | 2): Promise<BatchOperationResult[]> {
    if (!this.guardWS) throw new Error('Guard WebSocket未连接');
    return this.guardWS.batchPowerControl(seats, mode);
  }

  /**
   * 开启ADB
   * @param seat 盘位号
   */
  async enableADB(seat: number): Promise<CommandResponse> {
    if (!this.guardWS) throw new Error('Guard WebSocket未连接');
    return this.guardWS.enableADB(seat);
  }

  async batchEnableADB(seats: number[], mode: number = 2): Promise<BatchOperationResult[]> {
    if (!this.guardWS) throw new Error('Guard WebSocket未连接');
    return this.guardWS.batchEnableADB(seats, mode);
  }

  /**
   * 强开刷机(模式2)
   */
  async forceFlashROM(seat: number, mode: number = 2): Promise<CommandResponse> {
    if (!this.guardWS) throw new Error('Guard WebSocket未连接');
    return this.guardWS.forceFlashROM(seat, mode);
  }

  async batchForceFlashROM(seats: number[]): Promise<BatchOperationResult[]> {
    if (!this.guardWS) throw new Error('Guard WebSocket未连接');
    return this.guardWS.batchForceFlashROM(seats);
  }

  async getROMPackages(): Promise<ROMPackage[]> {
    if (!this.guardWS) throw new Error('Guard WebSocket未连接');
    return this.guardWS.getROMPackages();
  }

  async deleteROMPackage(packageName: string): Promise<CommandResponse> {
    if (!this.guardWS) throw new Error('Guard WebSocket未连接');
    return this.guardWS.deleteROMPackage(packageName);
  }

  async queryFlashStatus(): Promise<ROMFlashProgressData[]> {
    if (!this.guardWS) throw new Error('Guard WebSocket未连接');
    return this.guardWS.queryFlashStatus();
  }

  /**
   * 刷入ROM包
   * @param seat 盘位号
   * @param sn 设备序列号
   * @param image ROM镜像ID(name字段)
   */
  async flashROM(seat: number, sn: string, image: string, mode: number = 2): Promise<CommandResponse> {
    if (!this.guardWS) throw new Error('Guard WebSocket未连接');
    return this.guardWS.flashROM(seat, sn, image, mode);
  }

  /**
   * 设置ROM刷入进度回调
   * @param callback 进度回调函数
   */
  setROMFlashProgressCallback(callback: ((data: ROMFlashProgressData) => void) | null): void {
    if (this.guardWS) {
      this.guardWS.onROMFlashProgress = callback;
    }
  }

  /**
   * 发送终端数据
   */
  sendTerminal(data: Uint8Array): void {
    if (!this.guardWS) throw new Error('Guard WebSocket未连接');
    this.guardWS.sendTerminal(data);
  }

  /**
   * 设置终端字符串输出回调
   * @param callback 终端输出回调函数
   */
  setTerminalOutputCallback(callback: ((output: string) => void) | null): void {
    if (this.guardWS) {
      this.guardWS.onTerminalOutput = callback;
    }
  }

  /**
   * 设置终端数据回调
   * @param callback 终端数据回调函数
   */
  setTerminalDataCallback(callback: ((data: Uint8Array) => void) | null): void {
    if (this.guardWS) {
      this.guardWS.onTerminalData = callback;
    }
  }

  /**
   * 发送自定义命令
   */
  async sendCommand(command: string): Promise<string> {
    if (!this.guardWS) throw new Error('Guard WebSocket未连接');
    return this.guardWS.sendCommand(command);
  }

  async sendRawCommand(command: any): Promise<CommandResponse> {
    if (!this.guardWS) throw new Error('Guard WebSocket未连接');
    return this.guardWS.sendRawCommand(command);
  }
}
