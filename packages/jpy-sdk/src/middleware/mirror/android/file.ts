import { BaseAndroidModule } from './base';
import { BusinessFunction } from '../../constants';
import { CommandResponse } from '../../types';

export class AndroidFileModule extends BaseAndroidModule {
  /**
   * 293 文件下载安装
   */
  async downloadAndInstall(url: string, name: string, sha256: string): Promise<CommandResponse> {
    return this.connection.sendCommand({
      f: BusinessFunction.ADD_DOWNLOAD_TASK,
      data: { url, name, sha256, install: true, receive: true },
      req: true
    });
  }

  /**
   * 294 查询文件下载进度
   */
  async getDownloadProgress(id: string): Promise<any> {
    return this.connection.sendCommand({
      f: BusinessFunction.GET_CURRENT_DOWNLOAD_TASK,
      data: { id },
      req: true
    });
  }
}
