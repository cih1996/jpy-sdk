import { BaseAndroidModule } from './base';
import { BusinessFunction } from '../../constants';
import { CommandResponse } from '../../types';

export class AndroidScreenModule extends BaseAndroidModule {
  /**
   * 250 屏幕旋转 (被动接收)
   * 此接口通常是被动接收消息，但如果是作为命令发送可能无效或用于查询
   * 根据描述是 "此接口为被动接收"，所以这里可能只需要定义类型或不做主动调用封装
   * 但为了完整性，如果服务端支持主动查询，可以保留
   */
  // async getOrientation(): Promise<any> { ... }

  /**
   * 251 开启视频流
   */
  async startVideoStream(options: { fps?: number; bit?: number; quality?: number; width?: number } = {}): Promise<CommandResponse> {
    const { fps = 30, bit = 400000, quality = 10, width = 540 } = options;
    return this.connection.sendCommand({
      f: BusinessFunction.VIDEO_STREAM_START,
      data: { fps, bit, quality, width },
      req: true
    });
  }

  /**
   * 252 关闭视频流
   */
  async stopVideoStream(): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.VIDEO_STREAM_STOP, data: null, req: true });
  }

  /**
   * 299 取图片
   * @param imgType 1=jpeg, 2=webp
   */
  async screenshot(options: { width?: number; height?: number; qua?: number; scale?: number; x?: number; y?: number; imgType?: 1 | 2 } = {}): Promise<any> {
    const { width = 0, height = 0, qua = 70, scale = 150, x = 0, y = 0, imgType = 2 } = options;
    return this.connection.sendCommand({
      f: BusinessFunction.SCREENSHOT,
      data: { width, height, qua, scale, x, y, imgType },
      req: true
    });
  }
}
