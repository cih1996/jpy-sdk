import { BaseIOSModule } from './base';
import { BusinessFunction } from '../../constants';
import { CommandResponse } from '../../types';

export interface TouchPoint {
  id: number;      // 手指编号
  type: 0 | 1 | 2; // 动作类型：0=按下，1=抬起，2=移动
  x: number;       // x坐标
  y: number;       // y坐标
  offset: number;  // 执行该动作前先延时offset毫秒
  pressure: number;// 压力值，0～1之间float32
}

export class IOSInputModule extends BaseIOSModule {
  /**
   * 257 触摸(绝对坐标)
   */
  async touchAbsolute(points: TouchPoint[]): Promise<CommandResponse> {
    return this.connection.sendCommand({
      f: BusinessFunction.TOUCH_ABSOLUTE,
      data: points,
      req: true
    });
  }

  /**
   * 258 触摸(相对坐标)
   */
  async touchRelative(points: TouchPoint[]): Promise<CommandResponse> {
    return this.connection.sendCommand({
      f: BusinessFunction.TOUCH_RELATIVE,
      data: points,
      req: true
    });
  }

  /**
   * 281 按键(home/音量加减)
   * keyCode: 64=home, 233=音量+, 234=音量-
   * action: 0=按下，1=抬起，3=按下延迟50ms后抬起
   */
  async pressKey(keyCode: number, action: number = 3, usage: number = 12): Promise<CommandResponse> {
    return this.connection.sendCommand({
      f: BusinessFunction.PRESS_KEY,
      data: { action, usage, keyCode },
      req: true
    });
  }

  /**
   * 769 输入文本
   */
  async inputText(text: string): Promise<CommandResponse> {
    return this.connection.sendCommand({
      f: BusinessFunction.INPUT_TEXT,
      data: { text },
      req: true
    });
  }
}
