import { BaseAndroidModule } from './base';
import { BusinessFunction } from '../../constants';
import { DeviceDetail, OnlineStatus, ShellResult, CommandResponse } from '../../types';
import { parseOnlineStatus } from '../../utils';

export class AndroidDeviceModule extends BaseAndroidModule {
  /**
   * 4 设备详情
   */
  async getDetail(): Promise<DeviceDetail> {
    return await this.connection.sendCommand({ f: BusinessFunction.DEVICE_DETAIL, data: null, req: true });
  }

  /**
   * 6 上下线状态
   */
  async getOnlineStatus(): Promise<OnlineStatus> {
    const response = await this.connection.sendCommand({ f: BusinessFunction.ONLINE_STATUS, data: null, req: true });
    const data = Array.isArray(response) ? response[0] : response;
    return parseOnlineStatus(data);
  }

  /**
   * 289 执行shell命令
   */
  async executeShell(shell: string): Promise<ShellResult> {
    if (!shell || !shell.trim()) throw new Error('Shell命令不能为空');
    return this.connection.sendCommand({ f: BusinessFunction.EXECUTE_SHELL, data: { shell: shell.trim() }, req: true });
  }

  /**
   * 218 USB 模式切换
   */
  async switchUSBMode(mode: 0 | 1): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.SWITCH_USB_MODE_MIRROR, data: { mode }, req: true });
  }

  /**
   * 219 ADB 控制
   */
  async controlADB(mode: 0 | 1): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.CONTROL_ADB_MIRROR, data: { mode }, req: true });
  }

  /**
   * 297 息屏
   * @param timeLong 持续时间(秒)，默认1年(31536000)
   */
  async screenOff(timeLong: number = 31536000): Promise<CommandResponse> {
    return this.connection.sendCommand({ 
      f: BusinessFunction.SCREEN_OFF, 
      data: { state: "off", timeLong }, 
      req: true 
    });
  }

  /**
   * 298 屏幕常亮
   * @param timeLong 持续时间(秒)，默认1年(31536000)
   */
  async screenOn(timeLong: number = 31536000): Promise<CommandResponse> {
    return this.connection.sendCommand({ 
      f: BusinessFunction.SCREEN_ON, 
      data: { state: "on", timeLong }, 
      req: true 
    });
  }

  /**
   * 515 切换摄像头
   * @param type 'back' | 'front'
   */
  async switchCamera(type: 'back' | 'front'): Promise<CommandResponse> {
    const params = type === 'back' ? { switchBack: null } : { switchFront: null };
    return this.connection.sendCommand({
      f: BusinessFunction.SWITCH_CAMERA,
      data: { type: "setting", params },
      req: true
    });
  }

  /**
   * 516 root提权
   */
  async rootGrant(pkg: string): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.ROOT_GRANT, data: { pkg }, req: true });
  }

  /**
   * 517 root去权
   */
  async rootRevoke(pkg: string): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.ROOT_REVOKE, data: { pkg }, req: true });
  }

  /**
   * 518 指定输入法并禁用其他输入法
   */
  async setIME(imeId: string): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.SET_IME, data: { imeId }, req: true });
  }
}
