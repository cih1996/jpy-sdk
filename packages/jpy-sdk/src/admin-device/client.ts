/**
 * 管理端设备 API 客户端
 *
 * 提供统一的接口管理 Admin 登录、授权等功能
 */

import * as AuthAPI from './auth-api';

export interface AdminDeviceClientConfig {
  /** 管理端 token（可选，登录后设置） */
  token?: string;
}

/**
 * 管理端设备客户端
 */
export default class AdminDeviceClient {
  private token: string | null = null;

  constructor(config: AdminDeviceClientConfig = {}) {
    this.token = config.token || null;
  }

  // ========== Token 管理 ==========

  /**
   * 设置 token
   */
  setToken(token: string): void {
    this.token = token;
  }

  /**
   * 获取 token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * 清除 token
   */
  clearToken(): void {
    this.token = null;
  }

  // ========== 管理端 API ==========

  /**
   * 获取管理端验证码（已废弃）
   * @deprecated 登录无需验证码，请直接调用 login
   */
  async getAdminCaptcha() {
    return AuthAPI.getAdminCaptcha();
  }

  /**
   * 管理端登录
   */
  async login(username: string, password: string) {
    const result = await AuthAPI.adminLogin({ username, password, captchaId: '', captchaKey: '' });
    if (result.success && result.token) {
      this.token = result.token;
    }
    return result;
  }

  /**
   * 生成授权码
   */
  async generateAuthCode(name: string) {
    if (!this.token) {
      return { success: false, error: '请先登录管理端' };
    }
    return AuthAPI.generateAuthCode(this.token, name);
  }

  /**
   * 解密密码
   */
  async decryptPassword(encryptedCode: string) {
    if (!this.token) {
      return { success: false, error: '请先登录管理端' };
    }
    return AuthAPI.decryptPassword(this.token, encryptedCode);
  }

  /**
   * 搜索授权码
   */
  async searchAuthCode(name: string) {
    if (!this.token) {
      return { success: false, error: '请先登录管理端' };
    }
    return AuthAPI.searchAuthCode(this.token, name);
  }
}
