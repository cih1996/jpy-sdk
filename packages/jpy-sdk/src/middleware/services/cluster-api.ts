import { LicenseData, LoginResult } from '../types';


/**
 * 登录授权
 * @param apiBase 服务器地址
 * @param payload 登录参数，必须包含 username 和 password 字段
 * 示例:
 *   payload = { username: "admin", password: "admin" }
 * @returns LoginResult（success, token, error）
 *
 * 正常响应示例：
 * {
 *   "code": 200,
 *   "data": {
 *     "ip": "192.168.31.81",
 *     "time": 1768389635,
 *     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiYWRtaW4iLCJpc3MiOiJnaHAiLCJleHAiOjE3Njg0NzYwMzUsIm5iZiI6MTc2ODM4OTYyNX0.j3jP3Ecy5BjzHahsef-zOBJ2pNUkEtoGnbXITmAQjJo",
 *     "userInfo": {
 *       "name": "admin"
 *     }
 *   },
 *   "msg": "登陆成功"
 * }
 */
export async function login(
  apiBase: string,
  payload: { username: string; password: string }
): Promise<LoginResult> {
  try {
    // 参数校验
    if (!payload || typeof payload.username !== "string" || typeof payload.password !== "string") {
      return { success: false, error: "参数错误: 必须提供 username 和 password" };
    }

    const response = await fetch(`${apiBase}/login/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.code === 200 && result.data && typeof result.data.token === "string") {
      // 明确取 token from result.data.token
      return { success: true, token: result.data.token };
    }

    return {
      success: false,
      error: (result && (result.msg || result.message)) || '登录失败'
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '网络错误' };
  }
}

/**
 * 验证 Token 有效性
 * @returns {Promise<{valid: boolean, error?: string}>} 返回验证结果和错误信息
 */
export async function validateToken(apiBase: string, token: string): Promise<{ valid: boolean, error?: string }> {
  try {
    const response = await fetch(`${apiBase}/sys/version`, {
      method: 'GET',
      headers: { 'Authorization': token }
    });

    // 先尝试解析响应体，检查 code 字段
    let responseData: any = null;
    try {
      const text = await response.text();
      if (text) {
        responseData = JSON.parse(text);
      }
    } catch {
      // 如果解析失败，继续使用 HTTP 状态码判断
    }

    // 检查响应体中的 code 字段是否为 401
    if (responseData && responseData.code === 401) {
      const errorMsg = responseData.msg || responseData.message || 'token已过期';
      return { valid: false, error: errorMsg };
    }

    // 检查 HTTP 状态码
    if (!response.ok) {
      // 尝试解析错误信息
      let errorMsg = `HTTP ${response.status}`;
      if (responseData) {
        if (responseData.msg) {
          errorMsg = responseData.msg;
        } else if (responseData.message) {
          errorMsg = responseData.message;
        }
      }

      return { valid: false, error: errorMsg };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : '网络错误' };
  }
}

/**
 * 获取授权状态
 * @param apiBase 服务器地址
 * @param token 授权令牌
 * @returns
 * 提取 SN（授权码）、N（授权名称）、statusTxt（状态文本）、status（状态值）
 * 示例: { SN: string, N: string, statusTxt: string, status: number }
 */
export async function getLicenseInfo(apiBase: string, token: string): Promise<{ success: boolean; data?: LicenseData; error?: string }> {
  try {
    const response = await fetch(`${apiBase}/box/license`, {
      method: 'GET',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const result = await response.json();

    if (result.code === 200 && result.data) {
      // Handle BigInt serialization for IL if necessary
      const rawData = result.data as LicenseData;
      if (typeof rawData.IL === 'bigint') {
        rawData.IL = rawData.IL.toString();
      }

      // The destructured variables SN, N, statusTxt, status are not used in the return,
      // as the full rawData is returned. This is consistent with the Promise return type.
      // const { SN, N, statusTxt, status } = rawData;
      return { success: true, data: rawData };
    }

    return { success: false, error: result.msg || '获取授权信息失败' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '网络错误' };
  }
}

/**
 * 重新授权
 */
export async function reauthorize(apiBase: string, token: string, key: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${apiBase}/box/license?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({})
    });

    const result = await response.json();

    if (result.code === 200) {
      return { success: true };
    }

    return { success: false, error: result.msg || '重新授权失败' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '网络错误' };
  }
}


/**
 * 获取系统版本信息
 * @param apiBase 服务器地址
 * @param token 授权令牌
 * @returns 系统版本信息对象
 */
export async function getSystemVersion(
  apiBase: string,
  token: string
): Promise<{
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
  try {
    const response = await fetch(`${apiBase}/sys/version`, {
      method: 'GET',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const result = await response.json();

    if (result.code === 200 && result.data) {
      return {
        success: true,
        data: {
          version: result.data.version || '-',
          project: result.data.project,
          timestamp: result.data.timestamp,
          arch: result.data.arch,
          os: result.data.os,
          info: result.data.info
        }
      };
    }

    return { success: false, error: result.msg || '获取系统版本失败' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '网络错误' };
  }
}

/**
 * 获取网络信息
 * @param apiBase 服务器地址
 * @param token 授权令牌
 * @returns
 * 仅返回主要字段：速率 Speed（Mb），IPv4 主地址（Address）
 * e.g. { Speed: 1000, IPv4: "192.168.31.106" }
 */
export async function getNetworkInfo(apiBase: string, token: string): Promise<{ success: boolean; data?: { Speed: number; IPv4: string }; error?: string }> {
  try {
    const response = await fetch(`${apiBase}/sys/network`, {
      method: 'GET',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const result = await response.json();

    if (result.code === 200 && Array.isArray(result.data) && result.data.length > 0) {
      // 默认取第一个网络接口
      const net = result.data[0];
      const Speed = typeof net.Speed === "number" ? net.Speed : undefined;

      let IPv4: string | undefined = undefined;
      if (
        net.IPv4 &&
        Array.isArray(net.IPv4.Addresses) &&
        net.IPv4.Addresses.length > 0 &&
        typeof net.IPv4.Addresses[0].Address === "string"
      ) {
        IPv4 = net.IPv4.Addresses[0].Address;
      }
      return { success: true, data: { Speed, IPv4: IPv4 || "" } };
    }

    return { success: false, error: result.msg || '获取网络信息失败' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '网络错误' };
  }
}

/**
 * 上传系统包
 * @param apiBase 服务器地址
 * @param token 授权令牌
 * @param file 系统包文件
 * @returns 包ID（packageId），成功时返回 packageId，失败时返回 error
 * e.g. { success: true, packageId: 123456 }
 */
export async function uploadSystemPackage(
  apiBase: string,
  token: string,
  file: File
): Promise<{ success: boolean; packageId?: number; error?: string }> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    // 从 token 中提取用户名（如果 token 是 JWT，可能需要解析）
    // 这里假设 token 格式允许提取用户名，或者使用默认值
    const username = 'admin'; // 可以根据实际情况调整

    const response = await fetch(`${apiBase}/sys/upload`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Cookie': `username=${username};token=${token}`
        // 注意：不要手动设置 Content-Type，让浏览器自动设置 multipart/form-data 的 boundary
      },
      body: formData
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const result = await response.json();

    if (result.code === 200 && result.data !== undefined) {
      return { success: true, packageId: result.data };
    }

    return { success: false, error: result.msg || '上传系统包失败' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '网络错误' };
  }
}

/**
 * 刷入系统包
 */
export async function updateSystemPackage(
  apiBase: string,
  token: string,
  packageId: number,
  required: boolean = true
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `${apiBase}/sys/update?required=${required}&id=${packageId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': token
        // 不设置 Content-Type，让浏览器使用默认值
      }
      // body 为空
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const result = await response.json();

    if (result.code === 200) {
      return { success: true };
    }

    return { success: false, error: result.msg || '刷入系统包失败' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '网络错误' };
  }
}

/**
 * 上传ROM包（带进度回调）
 * @param apiBase 服务器地址
 * @param token 授权令牌
 * @param file ROM包文件
 * @param onProgress 进度回调函数 (progress: number) => void，progress 范围 0-100
 */
export async function uploadROMPackage(
  apiBase: string,
  token: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    // 从 token 中提取用户名（如果 token 是 JWT，可能需要解析）
    // 这里假设 token 格式允许提取用户名，或者使用默认值
    const username = 'admin'; // 可以根据实际情况调整

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();

      // 监听上传进度
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      });

      // 监听完成
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const result = JSON.parse(xhr.responseText);
            if (result.code === 200) {
              resolve({ success: true });
            } else {
              resolve({ success: false, error: result.msg || '上传ROM包失败' });
            }
          } catch {
            resolve({ success: false, error: '解析响应失败' });
          }
        } else {
          resolve({ success: false, error: `HTTP ${xhr.status}` });
        }
      });

      // 监听错误
      xhr.addEventListener('error', () => {
        resolve({ success: false, error: '网络错误' });
      });

      // 监听中止
      xhr.addEventListener('abort', () => {
        resolve({ success: false, error: '上传已取消' });
      });

      // 开始上传
      xhr.open('POST', `${apiBase}/box/upload`);
      xhr.setRequestHeader('Authorization', token);
      xhr.setRequestHeader('Cookie', `username=${username};token=${token}`);
      // 不设置 Content-Type，让浏览器自动设置 multipart/form-data 的 boundary
      xhr.send(formData);
    });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '网络错误' };
  }
}

/**
 * 获取刷机详情日志
 * @param apiBase 服务器地址
 * @param token 授权令牌
 * @param deviceId 设备ID（盘位）
 * @param session 刷机会话ID
 */
export async function getFlashDetail(
  apiBase: string,
  token: string,
  deviceId: number,
  session: string
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const url = new URL(`${apiBase}/box/detail`);
    url.searchParams.set('id', String(deviceId));
    url.searchParams.set('session', session);

    console.log(`[getFlashDetail] 请求URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': token
      }
    });

    console.log(`[getFlashDetail] 响应状态: ${response.status}, Content-Type: ${response.headers.get('content-type')}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[getFlashDetail] HTTP错误 ${response.status}:`, errorText);
      return { success: false, error: `HTTP ${response.status}` };
    }

    // 处理 text/event-stream 格式
    const contentType = response.headers.get('content-type') || '';
    let text = '';

    if (contentType.includes('text/event-stream')) {
      // SSE 格式：每行以 "data: " 开头，需要提取实际内容
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let buffer = '';
      const timeout = 1000; // 1秒超时
      const startTime = Date.now();

      try {
        while (true) {
          // 检查是否超时
          if (Date.now() - startTime > timeout) {
            console.log(`[getFlashDetail] 读取超时(1秒)，返回已获取的数据`);
            break;
          }

          // 使用 Promise.race 实现超时
          const readPromise = reader.read();
          const timeoutPromise = new Promise<{ done: boolean; value?: Uint8Array }>((resolve) => {
            setTimeout(() => resolve({ done: true }), timeout - (Date.now() - startTime));
          });

          const result = await Promise.race([readPromise, timeoutPromise]);

          if (result.done) {
            break;
          }

          if (result.value) {
            buffer += decoder.decode(result.value, { stream: true });
          }
        }

        // 处理 SSE 格式：提取 "data: " 后面的内容
        const lines = buffer.split('\n');
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            // 提取 "data: " 后面的内容
            const content = line.substring(6).trim();
            if (content) {
              dataLines.push(content);
            }
          } else if (line.trim() && !line.startsWith(':') && !line.startsWith('event:') && !line.startsWith('id:')) {
            // 如果不是 SSE 格式的元数据，直接添加
            dataLines.push(line.trim());
          }
        }

        text = dataLines.join('\n');
        console.log(`[getFlashDetail] 解析SSE流完成, 行数: ${dataLines.length}, 总长度: ${text.length}, 耗时: ${Date.now() - startTime}ms`);
      } catch (err) {
        console.error(`[getFlashDetail] 读取流时出错:`, err);
        // 即使出错，也尝试返回已读取的数据
      } finally {
        try {
          reader.releaseLock();
        } catch (e) {
          // 忽略释放锁的错误
        }
      }
    } else {
      // 普通文本响应
      text = await response.text();
      console.log(`[getFlashDetail] 读取普通文本响应, 长度: ${text.length}`);
    }

    if (!text || text.trim().length === 0) {
      console.warn(`[getFlashDetail] 响应内容为空`);
      return { success: false, error: '响应内容为空' };
    }

    return { success: true, data: text };
  } catch (err) {
    console.error(`[getFlashDetail] 异常:`, err);
    return { success: false, error: err instanceof Error ? err.message : '网络错误' };
  }
}
