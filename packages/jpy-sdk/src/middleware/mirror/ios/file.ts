import { BaseIOSModule } from './base';
import { BusinessFunction } from '../../constants';
import { CommandResponse } from '../../types';

export class IOSFileModule extends BaseIOSModule {
  /**
   * 293 添加下载任务
   */
  async addDownloadTask(url: string, name?: string, sha256?: string): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.ADD_DOWNLOAD_TASK, data: { url, name, sha256 }, req: true });
  }

  /**
   * 294 取当前下载任务
   */
  async getCurrentDownloadTask(): Promise<any> {
    return this.connection.sendCommand({ f: BusinessFunction.GET_CURRENT_DOWNLOAD_TASK, data: {}, req: true });
  }

  /**
   * 295 取消下载任务
   */
  async cancelDownloadTask(taskId: string): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.CANCEL_DOWNLOAD_TASK, data: { taskId }, req: true });
  }

  /**
   * 296 取下载列表
   */
  async getDownloadList(): Promise<any> {
    return this.connection.sendCommand({ f: BusinessFunction.GET_DOWNLOAD_LIST, data: {}, req: true });
  }

  /**
   * 304 文件列表
   */
  async listFiles(path: string): Promise<any> {
    return this.connection.sendCommand({ f: BusinessFunction.LIST_FILES, data: { path }, req: true });
  }

  /**
   * 305 文件信息
   */
  async getFileInfo(path: string): Promise<any> {
    return this.connection.sendCommand({ f: BusinessFunction.GET_FILE_INFO, data: { path }, req: true });
  }

  /**
   * 306 文件移动
   */
  async moveFile(srcPath: string, dstPath: string): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.MOVE_FILE, data: { srcPath, dstPath }, req: true });
  }

  /**
   * 307 文件删除
   */
  async deleteFile(path: string): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.DELETE_FILE, data: { path }, req: true });
  }

  /**
   * 308 拷贝到相册
   */
  async copyToPhotos(path: string): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.COPY_TO_PHOTOS, data: { path }, req: true });
  }

  /**
   * 311 解压zip文件
   */
  async unzipFile(srcPath: string, dstPath: string, password?: string): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.UNZIP_FILE, data: { srcPath, dstPath, password }, req: true });
  }

  /**
   * 301 文件直传开始(用户-->手机)
   */
  async startUpload(path: string, size: number, toPhotos: boolean = false): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.FILE_TRANSFER_START, data: { path, size, toPhotos }, req: true });
  }

  /**
   * 302 文件直传发送块(用户-->手机)
   */
  async uploadChunk(id: number, offset: number, payload: any): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.FILE_TRANSFER_UPLOAD, data: { id, offset, payload }, req: true });
  }

  /**
   * 309 文件直传开始(手机-->用户)
   */
  async startDownload(path: string): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.FILE_DOWNLOAD_START, data: { path }, req: true });
  }

  /**
   * 310 文件直传接收块(手机-->用户)
   */
  async downloadChunk(id: number, offset: number): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.FILE_DOWNLOAD_CHUNK, data: { id, offset }, req: true });
  }

  /**
   * 303 取消文件直传任务
   */
  async cancelTransfer(id: number): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.FILE_TRANSFER_CANCEL, data: { id }, req: true });
  }
}
