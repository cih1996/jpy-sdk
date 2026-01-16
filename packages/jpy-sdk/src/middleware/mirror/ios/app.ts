import { BaseIOSModule } from './base';
import { BusinessFunction } from '../../constants';
import { CommandResponse } from '../../types';

export class IOSAppModule extends BaseIOSModule {
  /**
   * 290 取app列表
   */
  async getList(type: 'any' | 'system' | 'internal' | 'user' = 'user'): Promise<any> {
    return this.connection.sendCommand({ f: BusinessFunction.GET_APP_LIST, data: { seat: this.deviceId, type }, req: true });
  }

  /**
   * 159 卸载app
   */
  async uninstall(bundleId: string): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.UNINSTALL_APP, data: { seat: this.deviceId, bundleId }, req: true });
  }

  /**
   * 291 启动app
   */
  async start(packageName: string): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.START_APP, data: { packageName }, req: true });
  }

  /**
   * 292 杀死app
   */
  async kill(packageName: string): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.KILL_APP, data: { packageName }, req: true });
  }

  /**
   * 320 取前台app
   */
  async getForegroundApp(): Promise<any> {
    return this.connection.sendCommand({ f: BusinessFunction.GET_FOREGROUND_APP, data: {}, req: true });
  }

  /**
   * 323 内置浏览框URL跳转
   */
  async openUrl(url: string): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.OPEN_URL, data: { url }, req: true });
  }

  /**
   * 326 取app浏览框的当前URL
   */
  async getWebviewUrl(): Promise<any> {
    return this.connection.sendCommand({ f: BusinessFunction.GET_APP_WEBVIEW_URL, data: {}, req: true });
  }
}
