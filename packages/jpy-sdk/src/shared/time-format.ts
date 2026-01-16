/**
 * 时间格式化工具
 * 
 * 特性：
 * - 无 DOM 依赖
 * - 跨平台支持
 */

/**
 * 格式化时间显示（刚刚、5分钟前等）
 */
export function formatTimeAgo(timestamp: number | undefined): string {
  if (!timestamp) {
    return '-';
  }

  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return '刚刚';
  } else if (minutes < 60) {
    return `${minutes}分钟前`;
  } else if (hours < 24) {
    return `${hours}小时前`;
  } else if (days < 7) {
    return `${days}天前`;
  } else {
    // 超过7天，显示具体日期
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
  }
}

/**
 * 格式化服务器地址显示（去掉 https:// 或 http:// 前缀）
 */
export function formatServerUrl(url: string | undefined | null): string {
  if (!url) {
    return '-';
  }
  
  // 去掉 https:// 或 http:// 前缀
  return url.replace(/^https?:\/\//, '');
}

/**
 * 格式化时间戳为可读的日期时间字符串
 */
export function formatDateTime(timestamp: number | undefined): string {
  if (!timestamp) {
    return '-';
  }

  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 格式化时间戳为简短日期字符串
 */
export function formatDate(timestamp: number | undefined): string {
  if (!timestamp) {
    return '-';
  }

  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * 格式化时间戳为时间字符串
 */
export function formatTime(timestamp: number | undefined): string {
  if (!timestamp) {
    return '-';
  }

  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${hours}:${minutes}:${seconds}`;
}
