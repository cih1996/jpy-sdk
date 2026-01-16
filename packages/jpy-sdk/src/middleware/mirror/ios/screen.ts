import { BaseIOSModule } from './base';
import { BusinessFunction } from '../../constants';

export interface ScreenshotOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  qua: number;   // 1~100
  scale?: number; // 0=不缩放
  imgType?: 0 | 1 | 2; // 0=jpeg, 1=png, 2=webp
}

export class IOSScreenModule extends BaseIOSModule {
  /**
   * 299 截图
   */
  async screenshot(options: ScreenshotOptions = { qua: 70, scale: 0, imgType: 0, x: 0, y: 0, width: 0, height: 0 }): Promise<any> {
    return this.connection.sendCommand({ f: BusinessFunction.SCREENSHOT, data: options, req: true });
  }
}
