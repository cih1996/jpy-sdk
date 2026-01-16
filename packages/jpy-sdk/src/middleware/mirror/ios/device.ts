import { BaseIOSModule } from './base';
import { BusinessFunction } from '../../constants';
import { DeviceDetail, CommandResponse } from '../../types';

export class IOSDeviceModule extends BaseIOSModule {
  /**
   * 4 设备信息
   */
  async getDetail(): Promise<DeviceDetail> {
    return await this.connection.sendCommand({ f: BusinessFunction.DEVICE_DETAIL, data: {}, req: true });
  }

  /**
   * 149 取定位
   */
  async getLocation(): Promise<{ latitude: number; longitude: number }> {
    return this.connection.sendCommand({ f: BusinessFunction.GET_LOCATION, data: {}, req: true });
  }

  /**
   * 150 模拟定位
   */
  async simulateLocation(latitude: number, longitude: number, type: 0 | 1 | 2 = 0): Promise<CommandResponse> {
    return this.connection.sendCommand({
      f: BusinessFunction.SIMULATE_LOCATION,
      data: { seat: this.deviceId, latitude, longitude, type },
      req: true
    });
  }

  /**
   * 151 停止模拟定位
   */
  async stopSimulateLocation(): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.STOP_SIMULATE_LOCATION, data: { seat: this.deviceId }, req: true });
  }

  /**
   * 155 重启设备
   */
  async reboot(): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.REBOOT_DEVICE, data: { seat: this.deviceId }, req: true });
  }

  /**
   * 156 抹机
   */
  async wipe(): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.WIPE_DEVICE, data: { seat: this.deviceId }, req: true });
  }

  /**
   * 157 设置语言和地区
   */
  async setLanguageAndLocale(language: string, locale: string): Promise<CommandResponse> {
    return this.connection.sendCommand({
      f: BusinessFunction.SET_LANGUAGE_LOCALE,
      data: { seat: this.deviceId, language, locale },
      req: true
    });
  }
}
