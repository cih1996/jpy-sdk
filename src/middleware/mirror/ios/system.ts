import { BaseIOSModule } from './base';
import { BusinessFunction } from '../../constants';
import { CommandResponse } from '../../types';

export interface HttpRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  proxy?: string;
  headers?: string[];
  body?: any;
  timeout?: number;
  skipVerify?: boolean;
}

export class IOSSystemModule extends BaseIOSModule {
  /**
   * 323 内置浏览框URL跳转
   */
  async openUrl(url: string): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.OPEN_URL, data: { url }, req: true });
  }

  /**
   * 324 Siri语音指令
   */
  async siri(text: string): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.TTS, data: { text }, req: true });
  }

  /**
   * 325 发送通知
   */
  async sendNotification(text: string): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.TOAST, data: { text }, req: true });
  }

  /**
   * 500 http请求
   */
  async httpRequest(options: HttpRequestOptions): Promise<any> {
    return this.connection.sendCommand({ f: BusinessFunction.HTTP_REQUEST, data: options, req: true });
  }

  /**
   * 510 执行js脚本
   */
  async executeScript(text: string): Promise<any> {
    return this.connection.sendCommand({ f: BusinessFunction.EXECUTE_JS_SCRIPT, data: { text }, req: true });
  }

  /**
   * 511 执行js脚本文件
   */
  async executeScriptFile(path: string): Promise<any> {
    return this.connection.sendCommand({ f: BusinessFunction.EXECUTE_JS_SCRIPT_FILE, data: { path }, req: true });
  }
}
