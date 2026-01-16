import { BaseAndroidModule } from './base';
import { BusinessFunction } from '../../constants';
import { CommandResponse } from '../../types';

export class AndroidAppModule extends BaseAndroidModule {
  /**
   * 290 取应用列表
   */
  async getList(): Promise<any> {
    return this.connection.sendCommand({ f: BusinessFunction.GET_APP_LIST, req: true });
  }

  /**
   * 291 启动应用
   */
  async start(packageName: string): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.START_APP, data: { packageName }, req: true });
  }
}
