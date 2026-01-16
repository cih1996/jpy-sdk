/**
 * DHCP 管理 API 客户端
 *
 * 提供 DHCP 登录、租约管理等功能
 */

import * as DHCPAPI from './api';

export interface DHCPClientConfig {
  /** DHCP token（可选，登录后设置） */
  token?: string;
}

/**
 * DHCP 客户端
 */
export default class DHCPClient {
  private token: string | null = null;

  constructor(config: DHCPClientConfig = {}) {
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

  // ========== DHCP API ==========

  /**
   * DHCP 登录
   */
  async login(payload: {
    username: string;
    password: string;
  }) {
    const result = await DHCPAPI.dhcpLogin(payload);
    if (result.success && result.token) {
      this.token = result.token;
    }
    return result;
  }

  /**
   * 获取 DHCP 租约列表
   */
  async getLeases(params?: {
    mode?: number;
    queryField?: string;
    query?: string;
    sortOrder?: string;
    pageNum?: number;
    pageSize?: number;
  }) {
    if (!this.token) {
      return { success: false, error: '请先登录 DHCP 服务器' };
    }
    return DHCPAPI.getDHCPLeases(this.token, params);
  }

  /**
   * 删除 DHCP 租约
   */
  async deleteLeases(ids: number[]) {
    if (!this.token) {
      return { success: false, error: '请先登录 DHCP 服务器' };
    }
    return DHCPAPI.deleteDHCPLeases(this.token, ids);
  }

  // ========== 工具方法 ==========

  /**
   * 将 IP 数字转换为字符串格式
   */
  ipNumberToString(ip: number): string {
    return DHCPAPI.ipNumberToString(ip);
  }

  /**
   * 将 MAC 数字转换为字符串格式
   */
  macNumberToString(mac: number): string {
    return DHCPAPI.macNumberToString(mac);
  }
}
