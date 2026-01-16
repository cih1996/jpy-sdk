import { MiddlewareClient } from '../client';
import * as ClusterAPI from '../services/cluster-api';
import { LicenseInfo, LoginResult } from '../types';

/**
 * Cluster API 模块
 * 封装 HTTP REST API 调用
 */
export class ClusterModule {
  constructor(private client: MiddlewareClient) { }

  /**
   * 登录授权
   */
  async login(payload: { username: string; password: string }): Promise<LoginResult> {
    const result = await ClusterAPI.login(this.client.getApiBase(), payload);
    if (result.success && result.token) {
      this.client.setToken(result.token);
    }
    return result;
  }

  /**
   * 验证Token有效性
   */
  async validateToken(): Promise<{ valid: boolean; error?: string }> {
    return ClusterAPI.validateToken(this.client.getApiBase(), this.client.getToken());
  }

  /**
   * 获取授权状态
   */
  async getLicenseInfo(): Promise<{ success: boolean; data?: LicenseInfo; error?: string }> {
    const result = await ClusterAPI.getLicenseInfo(this.client.getApiBase(), this.client.getToken());
    // 适配 LicenseData 到 LicenseInfo
    if (result.success && result.data) {
      const rawData = result.data;
      const licenseInfo: LicenseInfo = {
        ...rawData,
        valid: rawData.status === 1,
        expireTime: rawData.IL,
        maxDevices: rawData.M,
        statusTxt: rawData.statusTxt
      };
      return { success: true, data: licenseInfo };
    }
    return { success: false, error: result.error };
  }

  /**
   * 重新授权
   */
  async reauthorize(key: string): Promise<{ success: boolean; error?: string }> {
    return ClusterAPI.reauthorize(this.client.getApiBase(), this.client.getToken(), key);
  }

  /**
   * 获取网络信息
   */
  async getNetworkInfo(): Promise<{ success: boolean; data?: { Speed?: number; IPv4?: string }; error?: string }> {
    return ClusterAPI.getNetworkInfo(this.client.getApiBase(), this.client.getToken());
  }

  /**
   * 获取系统版本信息
   */
  async getSystemVersion(): Promise<{
    success: boolean;
    data?: {
      version: string;
      project?: string;
      timestamp?: number;
      arch?: string;
      os?: string;
      info?: string;
    };
    error?: string;
  }> {
    return ClusterAPI.getSystemVersion(this.client.getApiBase(), this.client.getToken());
  }

  /**
   * 上传系统包
   */
  async uploadSystemPackage(file: File): Promise<{ success: boolean; packageId?: number; error?: string }> {
    return ClusterAPI.uploadSystemPackage(this.client.getApiBase(), this.client.getToken(), file);
  }

  /**
   * 刷入系统包
   */
  async updateSystemPackage(packageId: number, required: boolean = true): Promise<{ success: boolean; error?: string }> {
    return ClusterAPI.updateSystemPackage(this.client.getApiBase(), this.client.getToken(), packageId, required);
  }

  /**
   * 上传ROM包(带进度回调)
   * @param file ROM包文件
   * @param onProgress 进度回调函数，参数为 0-100 的进度百分比
   */
  async uploadROMPackage(file: File, onProgress?: (progress: number) => void): Promise<{ success: boolean; error?: string }> {
    return ClusterAPI.uploadROMPackage(this.client.getApiBase(), this.client.getToken(), file, onProgress);
  }

  /**
   * 获取刷机详情日志
   */
  async getFlashDetail(deviceId: number, session: string): Promise<{ success: boolean; data?: string; error?: string }> {
    return ClusterAPI.getFlashDetail(this.client.getApiBase(), this.client.getToken(), deviceId, session);
  }
}
