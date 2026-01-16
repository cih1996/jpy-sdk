import { BaseAndroidModule } from './base';
import { BusinessFunction } from '../../constants';
import { CommandResponse } from '../../types';

export class AndroidInputModule extends BaseAndroidModule {
  /**
   * 258 触屏（鼠标）
   * @param type 0按下 1抬起 2移动
   * @param id 手指编号
   * @param pressure 压力值 0~1
   */
  async touch(type: 0 | 1 | 2, x: number, y: number, id: number = 1, pressure: number = 1, offset: number = 0): Promise<CommandResponse> {
    return this.connection.sendCommand({
      f: BusinessFunction.TOUCH_RELATIVE,
      data: [{ type, x, y, id, offset, pressure }],
      req: true
    });
  }

  /**
   * 259 滚轮
   * @param upOrDown -1向下，1向上
   */
  async scroll(upOrDown: -1 | 1, x: number, y: number): Promise<CommandResponse> {
    return this.connection.sendCommand({
      f: BusinessFunction.SCROLL,
      data: { upOrDown, x, y },
      req: true
    });
  }

  /**
   * 281 按键
   * @param action 0按下 1抬起 3按下并抬起 4组合ctrl键
   */
  async pressKey(keyCode: number, action: 0 | 1 | 3 | 4 = 3): Promise<CommandResponse> {
    return this.connection.sendCommand({
      f: BusinessFunction.PRESS_KEY,
      data: { action, keyCode },
      req: true
    });
  }

  /**
   * 769 输入文本
   */
  async inputText(text: string): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.INPUT_TEXT, data: { text }, req: true });
  }

  /**
   * 770 获取剪切板内容
   */
  async getClipboard(): Promise<any> {
    return this.connection.sendCommand({ f: BusinessFunction.GET_CLIPBOARD, req: true });
  }
}
