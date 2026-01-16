import { DeviceListItem, OnlineStatus } from '../types';

/**
 * 深度序列化对象，处理 BigInt、Uint8Array 等无法直接序列化的类型
 * 将特殊类型转换为可序列化的格式，主要用于日志记录和调试
 */
export function deepSerialize(value: any, visited = new WeakSet()): any {
    // 处理 null 和 undefined
    if (value === null || value === undefined) {
        return value;
    }

    // 处理 BigInt
    if (typeof value === 'bigint') {
        return {
            __type: 'BigInt',
            value: value.toString(),
            number: Number(value),
            hex: '0x' + value.toString(16)
        };
    }

    // 防止循环引用
    if (typeof value === 'object') {
        if (visited.has(value)) {
            return '[循环引用]';
        }
        visited.add(value);
    }

    // 处理基本类型
    if (typeof value !== 'object') {
        return value;
    }

    // 处理 Uint8Array
    if (value instanceof Uint8Array) {
        return {
            __type: 'Uint8Array',
            length: value.length,
            data: Array.from(value).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '),
            preview: value.length > 100
                ? Array.from(value.slice(0, 100)).map(b => b.toString(16).padStart(2, '0')).join('') + '...'
                : Array.from(value).map(b => b.toString(16).padStart(2, '0')).join('')
        };
    }

    // 处理 ArrayBuffer
    if (value instanceof ArrayBuffer) {
        const uint8View = new Uint8Array(value);
        return {
            __type: 'ArrayBuffer',
            byteLength: value.byteLength,
            data: Array.from(uint8View).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '),
            preview: uint8View.length > 100
                ? Array.from(uint8View.slice(0, 100)).map(b => b.toString(16).padStart(2, '0')).join('') + '...'
                : Array.from(uint8View).map(b => b.toString(16).padStart(2, '0')).join('')
        };
    }

    // 处理 Date
    if (value instanceof Date) {
        return {
            __type: 'Date',
            value: value.toISOString(),
            timestamp: value.getTime()
        };
    }

    // 处理 Map
    if (value instanceof Map) {
        return {
            __type: 'Map',
            entries: Array.from(value.entries()).map(([k, v]) => [
                deepSerialize(k, visited),
                deepSerialize(v, visited)
            ])
        };
    }

    // 处理 Set
    if (value instanceof Set) {
        return {
            __type: 'Set',
            values: Array.from(value).map(v => deepSerialize(v, visited))
        };
    }

    // 处理数组
    if (Array.isArray(value)) {
        return value.map(item => deepSerialize(item, visited));
    }

    // 处理普通对象
    try {
        const result: any = {};

        // 检查是否是特殊对象类型（有 constructor 且不是 Object 或 Array）
        if (value.constructor && value.constructor !== Object && value.constructor !== Array) {
            result.__type = value.constructor.name;
        }

        // 遍历所有属性
        for (const key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                try {
                    result[key] = deepSerialize(value[key], visited);
                } catch (e) {
                    result[key] = `[无法访问属性: ${key}]`;
                }
            }
        }

        return result;
    } catch (e) {
        // 如果完全无法序列化，返回类型信息
        return {
            __type: value.constructor?.name || 'Unknown',
            __error: `无法序列化: ${e instanceof Error ? e.message : String(e)}`,
            __toString: String(value)
        };
    }
}

/**
 * 将 BigInt 转换为 Number
 */
export function bigIntToNumber(value: any): number {
    if (typeof value === 'bigint') {
        return Number(value);
    }
    if (typeof value === 'string') {
        const num = parseInt(value, 10);
        return isNaN(num) ? 0 : num;
    }
    if (typeof value === 'number') {
        return value;
    }
    return 0;
}

/**
 * 将对象中所有的 BigInt 转换为 string，确保一致性
 */
export function stringifyBigInt(value: any): any {
    if (value === null || value === undefined) {
        return value;
    }

    if (typeof value === 'bigint') {
        return value.toString();
    }

    if (Array.isArray(value)) {
        return value.map(item => stringifyBigInt(item));
    }

    if (typeof value === 'object' && !(value instanceof Uint8Array) && !(value instanceof ArrayBuffer)) {
        const result: any = {};
        for (const [key, val] of Object.entries(value)) {
            result[key] = stringifyBigInt(val);
        }
        return result;
    }

    return value;
}

/**
 * 转换为安全数字
 * 用于小数值字段（不会超过 JavaScript 安全整数范围）
 */
export function toSafeNumber(value: bigint | number | string | undefined): number {
    if (value === undefined || value === null) return 0;

    if (typeof value === 'bigint') {
        return Number(value);
    }
    if (typeof value === 'string') {
        const num = parseInt(value, 10);
        return isNaN(num) ? 0 : num;
    }
    if (typeof value === 'number') {
        return value;
    }

    return 0;
}

/**
 * 转换大数字为字符串
 * 用于 memory, diskSize 等可能超过安全整数范围的字段
 */
export function bigIntToString(value: bigint | number | string | undefined): string {
    if (value === undefined || value === null) return '0';

    if (typeof value === 'bigint') {
        return value.toString();
    }
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number') {
        return String(value);
    }

    return '0';
}

/**
 * 格式化字节数为人类可读格式
 * @param bytes 字节数（支持 string, number, bigint）
 * @returns 格式化后的字符串，如 "63.9 GB"
 *
 * @example
 * formatBytes(63883563008) // "63.9 GB"
 * formatBytes('2961539072') // "2.8 GB"
 */
export function formatBytes(bytes: string | number | bigint): string {
    let num: number;

    if (typeof bytes === 'bigint') {
        num = Number(bytes);
    } else if (typeof bytes === 'string') {
        num = parseInt(bytes, 10);
        if (isNaN(num)) return '0 B';
    } else {
        num = bytes;
    }

    if (num === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let size = num;
    let unitIdx = 0;

    while (size >= 1024 && unitIdx < units.length - 1) {
        size /= 1024;
        unitIdx++;
    }

    return `${size.toFixed(1)} ${units[unitIdx]}`;
}

/**
 * 标准化设备列表项
 * 将服务器返回的原始数据转换为严格的 DeviceListItem 类型
 */
export function normalizeDeviceListItem(raw: any): DeviceListItem {
    return {
        uuid: String(raw.uuid || ''),
        model: String(raw.model || ''),
        type: toSafeNumber(raw.type),
        osVersion: String(raw.osVersion || ''),
        cpu: toSafeNumber(raw.cpu),
        memory: bigIntToString(raw.memory),
        diskSize: bigIntToString(raw.diskSize),
        width: toSafeNumber(raw.width),
        height: toSafeNumber(raw.height),
        seat: toSafeNumber(raw.seat),
        androidVersion: raw.androidVersion ? String(raw.androidVersion) : undefined
    };
}

/**
 * 处理图片数据，转换为 Blob
 * @param data 图片原始数据（ArrayBuffer 或 Uint8Array）
 * @returns 处理后的 Blob 对象
 * @throws {Error} 如果图片数据无效
 */
export function processImageData(data: any): Blob {
    if (!data) throw new Error('无图片数据');

    let blob: Blob;
    if (data instanceof ArrayBuffer) {
        blob = new Blob([data], { type: 'image/webp' });
    } else if (data instanceof Uint8Array) {
        blob = new Blob([data.slice()], { type: 'image/webp' });
    } else if (data.data) {
        if (data.data instanceof ArrayBuffer) {
            blob = new Blob([data.data], { type: 'image/webp' });
        } else if (data.data instanceof Uint8Array) {
            blob = new Blob([data.data.slice()], { type: 'image/webp' });
        } else {
            throw new Error('无效的图片数据格式');
        }
    } else {
        throw new Error('无效的图片数据');
    }

    return blob;
}

/**
 * 解析设备在线状态
 * @param data 原始在线状态数据
 * @returns 解析后的 OnlineStatus 对象
 */
export function parseOnlineStatus(data: any): OnlineStatus {
  const online = typeof data.online === 'number' ? data.online : 0;
  
  return {
      ...data,
      seat: data.seat,
      online: online,
      ip: data.ip || '',
      isManagementOnline: ((online >> 0) & 1) === 1,
      isBusinessOnline: ((online >> 1) & 1) === 1,
      isControlBoardOnline: ((online >> 3) & 1) === 1,
      isUSBMode: ((online >> 6) & 1) === 1,
      isADBEnabled: ((online >> 8) & 1) === 1
  };
}
