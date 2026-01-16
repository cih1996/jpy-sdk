/**
 * DHCP 管理 API 模块
 *
 * 特性：
 * - 无 DOM 依赖
 * - Token 由用户管理
 * - 跨平台支持
 */

const DHCP_API_BASE = 'https://192.168.0.101';

import {
  DHCPLoginResult,
  DHCPLeaseListResult,
  DHCPDeleteResult
} from './types';

/**
 * DHCP 登录（无需验证码）
 */
export async function dhcpLogin(payload: {
  username: string;
  password: string;
}): Promise<DHCPLoginResult> {
  try {
    const response = await fetch(`${DHCP_API_BASE}/login/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const result = await response.json();

    if (result.code === 200 && result.data && result.data.token) {
      return {
        success: true,
        token: result.data.token,
        userInfo: result.data.userInfo
      };
    }

    return { success: false, error: result.msg || '登录失败' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '网络错误' };
  }
}

/**
 * 获取 DHCP 租约列表
 */
export async function getDHCPLeases(
  token: string,
  params?: {
    mode?: number;
    queryField?: string;
    query?: string;
    sortOrder?: string;
    pageNum?: number;
    pageSize?: number;
  }
): Promise<DHCPLeaseListResult> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.mode !== undefined) queryParams.append('mode', String(params.mode));
    if (params?.queryField) queryParams.append('queryField', params.queryField);
    if (params?.query) queryParams.append('query', params.query);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    if (params?.pageNum) queryParams.append('pageNum', String(params.pageNum));
    if (params?.pageSize) queryParams.append('pageSize', String(params.pageSize));

    const url = `${DHCP_API_BASE}/dhcp/lease${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 402 || response.status === 403) {
        return { success: false, error: '权限不足，请重新登录' };
      }
      return { success: false, error: `HTTP ${response.status}` };
    }

    const result = await response.json();

    if (result.code === 200 && result.data) {
      return {
        success: true,
        data: result.data
      };
    }

    if (result.code === 401 || result.code === 402 || result.code === 403) {
      return { success: false, error: result.msg || '权限不足，请重新登录' };
    }

    return { success: false, error: result.msg || '获取 DHCP 租约列表失败' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '网络错误' };
  }
}

/**
 * 删除 DHCP 租约
 */
export async function deleteDHCPLeases(token: string, ids: number[]): Promise<DHCPDeleteResult> {
  try {
    const response = await fetch(`${DHCP_API_BASE}/dhcp/lease`, {
      method: 'DELETE',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids })
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 402 || response.status === 403) {
        return { success: false, error: '权限不足，请重新登录' };
      }
      return { success: false, error: `HTTP ${response.status}` };
    }

    const result = await response.json();

    if (result.code === 200) {
      return { success: true };
    }

    if (result.code === 401 || result.code === 402 || result.code === 403) {
      return { success: false, error: result.msg || '权限不足，请重新登录' };
    }

    return { success: false, error: result.msg || '删除 DHCP 租约失败' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '网络错误' };
  }
}

/**
 * 将 IP 数字转换为字符串格式
 */
export function ipNumberToString(ip: number): string {
  return [
    (ip >>> 24) & 0xff,
    (ip >>> 16) & 0xff,
    (ip >>> 8) & 0xff,
    ip & 0xff
  ].join('.');
}

/**
 * 将 MAC 数字转换为字符串格式
 */
export function macNumberToString(mac: number): string {
  const bytes: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const byte = (mac >>> (i * 8)) & 0xff;
    bytes.push(byte.toString(16).padStart(2, '0').toUpperCase());
  }
  return bytes.join(':');
}
