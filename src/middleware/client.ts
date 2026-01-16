/**
 * 中间件客户端 - 统一封装类
 * 
 * 将 cluster-api、subscribe-ws、guard-ws、mirror-ws 四个模块组合起来
 * 提供统一的调用接口
 */

import { MiddlewareClientConfig, LoginResult } from './types';
import { ClusterModule } from './modules/cluster';
import { SubscribeModule } from './modules/subscribe';
import { GuardModule } from './modules/guard';
import { MirrorModule } from './modules/mirror';

/**
 * 中间件客户端
 * 
 * 使用示例:
 * ```typescript
 * const client = new MiddlewareClient({
 *   apiBase: 'https://server.com:1443',
 *   token: 'your-auth-token'
 * });
 *
 * // 1. 连接Subscribe WebSocket(设备列表)
 * await client.subscribe.connect();
 * const devices = await client.subscribe.fetchDeviceList();
 *
 * // 2. 连接Guard WebSocket(设备控制)
 * await client.guard.connect(1); // 连接设备1
 * await client.guard.switchUSBMode(1, 1); // 切换USB模式
 *
 * // 3. 连接Mirror WebSocket(单设备操作)
 * await client.mirror.connect(1); // 连接设备1
 * const detail = await client.mirror.instance?.ios.device.getDetail();
 * ```
 */
export class MiddlewareClient {
  private config: MiddlewareClientConfig;
  private _token: string = '';

  // 子模块
  public readonly cluster: ClusterModule;
  public readonly subscribe: SubscribeModule;
  public readonly guard: GuardModule;
  public readonly mirror: MirrorModule;

  constructor(config: MiddlewareClientConfig) {
    // 确保apiBase包含协议
    if (!config.apiBase.startsWith('http://') && !config.apiBase.startsWith('https://')) {
      config.apiBase = `https://${config.apiBase}`;
    }

    this.config = config;
    this._token = config.token || '';

    // 初始化子模块
    this.cluster = new ClusterModule(this);
    this.subscribe = new SubscribeModule(this);
    this.guard = new GuardModule(this);
    this.mirror = new MirrorModule(this);
  }

  /**
   * 获取API基础地址
   */
  getApiBase(): string {
    return this.config.apiBase;
  }

  /**
   * 设置Token
   */
  setToken(token: string): void {
    this._token = token;
  }

  /**
   * 获取Token
   */
  getToken(): string {
    return this._token;
  }

  /**
   * 登录授权（快捷方法）
   */
  async login(username: string, password: string): Promise<LoginResult> {
    return this.cluster.login({ username, password });
  }

  /**
   * 验证Token有效性（快捷方法）
   */
  async validateToken(): Promise<{ valid: boolean; error?: string }> {
    return this.cluster.validateToken();
  }

  /**
   * 断开所有连接
   */
  disconnectAll(): void {
    this.subscribe.disconnect();
    this.guard.disconnect();
    this.mirror.disconnect();
  }
}

export default MiddlewareClient;
