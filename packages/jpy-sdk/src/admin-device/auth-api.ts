/**
 * 管理端设备授权 API 模块
 * 
 * 特性：
 * - 无 DOM 依赖
 * - Token 由用户管理
 * - 跨平台支持
 */

const ADMIN_API_BASE = 'https://admin.htsystem.cn/api/v1';

import {
  AdminCaptchaData,
  AdminLoginResult,
  AuthCodeResult,
  AuthSearchResult,
  DecryptPasswordResult
} from './types';

/**
 * 获取管理端验证码
 */
export async function getAdminCaptcha(): Promise<{ success: boolean; data?: AdminCaptchaData; error?: string }> {
  try {
    const response = await fetch(`${ADMIN_API_BASE}/admin/captcha`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const result = await response.json();

    if (result.status === 200 && result.data) {
      return {
        success: true,
        data: {
          captchaId: result.data.captchaId,
          captchaPic: result.data.captchaPic
        }
      };
    }

    return { success: false, error: result.msg || '获取验证码失败' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '网络错误' };
  }
}

/**
 * 管理端登录
 */
export async function adminLogin(payload: {
  username: string;
  password: string;
  captchaId: string;
  captchaKey: string;
}): Promise<AdminLoginResult> {
  try {
    const response = await fetch(`${ADMIN_API_BASE}/admin/login`, {
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

    if (result.status === 200 && result.data && result.data.token) {
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
 * 生成授权码
 */
export async function generateAuthCode(token: string, name: string): Promise<AuthCodeResult> {
  try {
    const payload = {
      id: 0,
      supervise: true,
      type: 1,
      name: name,
      SerialNumber: '',
      title: name,
      mgtCenter: '',
      limit: 20,
      day: 365,
      desc: ''
    };

    const response = await fetch(`${ADMIN_API_BASE}/partner/auth`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 402 || response.status === 403) {
        return { success: false, error: '权限不足，请重新登录' };
      }
      return { success: false, error: `HTTP ${response.status}` };
    }

    const result = await response.json();

    if (result.status === 200) {
      return { success: true };
    }

    if (result.status === 401 || result.status === 402 || result.status === 403) {
      return { success: false, error: result.msg || '权限不足，请重新登录' };
    }

    return { success: false, error: result.msg || '生成授权码失败' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '网络错误' };
  }
}

/**
 * 解密密码
 */
export async function decryptPassword(token: string, encryptedCode: string): Promise<DecryptPasswordResult> {
  try {
    const response = await fetch(`${ADMIN_API_BASE}/partner/password`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code: encryptedCode })
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 402 || response.status === 403) {
        return { success: false, error: '权限不足，请重新登录' };
      }
      return { success: false, error: `HTTP ${response.status}` };
    }

    const result = await response.json();

    if (result.status === 200 && result.data) {
      return {
        success: true,
        password: result.data
      };
    }

    if (result.status === 401 || result.status === 402 || result.status === 403) {
      return { success: false, error: result.msg || '权限不足，请重新登录' };
    }

    return { success: false, error: result.msg || '解密失败' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '网络错误' };
  }
}

/**
 * 搜索授权码（通过名称匹配获取SerialNumber）
 */
export async function searchAuthCode(token: string, name: string): Promise<AuthSearchResult> {
  try {
    const response = await fetch(`${ADMIN_API_BASE}/partner/auth?did=0&sortOrder=id%20desc&pageNum=1`, {
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

    if (result.status === 200 && result.data && result.data.dataList) {
      const matched = result.data.dataList.find((item: any) => item.name === name);
      if (matched && matched.SerialNumber) {
        return {
          success: true,
          serialNumber: matched.SerialNumber
        };
      }
      return { success: false, error: '未找到匹配的授权码' };
    }

    if (result.status === 401 || result.status === 402 || result.status === 403) {
      return { success: false, error: result.msg || '权限不足，请重新登录' };
    }

    return { success: false, error: result.msg || '搜索授权码失败' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '网络错误' };
  }
}
