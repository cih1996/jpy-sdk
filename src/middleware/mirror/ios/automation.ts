import { BaseIOSModule } from './base';
import { BusinessFunction } from '../../constants';
import { CommandResponse } from '../../types';

export interface GetImageFromCacheOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  qua?: number;
  scale?: number;
  imgType?: -1 | 0 | 1 | 2; // -1=original, 0=jpeg, 1=png, 2=webp
}

export interface FindColorOptions {
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: string;
  dir?: 0 | 1 | 2 | 3;
  sim?: number;
  num?: number;
  hold?: boolean;
}

export interface FindImageOptions {
  id?: string;
  transparent?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  sim?: number;
  method?: 0 | 1 | 2 | 3 | 4 | 5;
  hold?: boolean;
}

export interface OCROptions {
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  language?: string[];
  hold?: boolean;
}

export class IOSAutomationModule extends BaseIOSModule {
  /**
   * 321 取界面元素节点
   */
  async getUIElement(depth: number = 50, query: string = "", stage: number = 0): Promise<any> {
    return this.connection.sendCommand({ f: BusinessFunction.FIND_NODE, data: { depth, query, stage }, req: true });
  }

  /**
   * 322 取系统级弹窗
   */
  async getSystemAlert(): Promise<any> {
    return this.connection.sendCommand({ f: BusinessFunction.FIND_DIALOG, data: {}, req: true });
  }

  /**
   * 398 上传图片到缓存
   */
  async uploadImageToCache(data: any): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.UPLOAD_IMAGE_CACHE, data, req: true });
  }

  /**
   * 399 载入zip文件到缓存
   */
  async loadZipToCache(path: string, password?: string): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.UPLOAD_IMAGE_ZIP_CACHE, data: { path, password }, req: true });
  }

  /**
   * 400 清空缓存
   */
  async clearCache(): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.CLEAN_IMAGE_CACHE, data: {}, req: true });
  }

  /**
   * 401 截图到缓存
   */
  async screenshotToCache(): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.SCREENSHOT_TO_CACHE, data: {}, req: true });
  }

  /**
   * 402 缓存续期
   */
  async renewCache(id: string): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.RENEW_IMAGE_CACHE, data: { id }, req: true });
  }

  /**
   * 403 释放一张图片
   */
  async releaseImage(id: string): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.RELEASE_IMAGE_CACHE, data: { id }, req: true });
  }

  /**
   * 404 从缓存获取图片
   */
  async getImageFromCache(id: string, options: GetImageFromCacheOptions = {}): Promise<any> {
    return this.connection.sendCommand({ f: BusinessFunction.GET_IMAGE_FROM_CACHE, data: { id, ...options }, req: true });
  }

  /**
   * 405 缓存列表
   */
  async getCacheList(): Promise<any> {
    return this.connection.sendCommand({ f: BusinessFunction.GET_CACHE_LIST, data: {}, req: true });
  }

  /**
   * 406 取色
   */
  async getColor(x: number, y: number, id: string = "", hold: boolean = false): Promise<any> {
    return this.connection.sendCommand({ f: BusinessFunction.GET_COLOR, data: { id, x, y, hold }, req: true });
  }

  /**
   * 407 多点比色
   * points: "x|y|color-offset,..."
   */
  async compareColors(points: string, id: string = "", hold: boolean = false): Promise<any> {
    return this.connection.sendCommand({ f: BusinessFunction.COMPARE_COLORS, data: { id, points, hold }, req: true });
  }

  /**
   * 408 找色
   */
  async findColor(color: string, options: FindColorOptions = {}): Promise<any> {
    return this.connection.sendCommand({ f: BusinessFunction.FIND_COLOR, data: { color, ...options }, req: true });
  }

  /**
   * 410 找图
   */
  async findImage(tmpl: string | any, options: FindImageOptions = {}): Promise<any> {
    return this.connection.sendCommand({ f: BusinessFunction.FIND_IMAGE, data: { tmpl, ...options }, req: true });
  }

  /**
   * 411 文字识别(OCR)
   */
  async ocr(options: OCROptions = {}): Promise<any> {
    return this.connection.sendCommand({ f: BusinessFunction.OCR, data: options, req: true });
  }
}
