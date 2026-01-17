"use strict";
/**
 * 协议处理工具
 * 处理二进制协议的编码和解码
 *
 * 特性：
 * - 无 DOM 依赖
 * - 跨平台支持
 * - 支持 MessagePack 和 JSON 编码
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageType = void 0;
exports.encodeProtocolMessage = encodeProtocolMessage;
exports.decodeProtocolMessage = decodeProtocolMessage;
const msgpackr = __importStar(require("msgpackr"));
var MessageType;
(function (MessageType) {
    MessageType[MessageType["PING"] = 1] = "PING";
    MessageType[MessageType["PONG"] = 2] = "PONG";
    MessageType[MessageType["BYTES"] = 5] = "BYTES";
    MessageType[MessageType["MSGPACK"] = 6] = "MSGPACK";
    MessageType[MessageType["JSON"] = 7] = "JSON";
    MessageType[MessageType["VIDEO"] = 9] = "VIDEO";
    MessageType[MessageType["TERMINAL"] = 13] = "TERMINAL";
})(MessageType || (exports.MessageType = MessageType = {}));
/**
 * 编码协议消息为二进制
 *
 * WebSocket协议格式：
 * - 1 byte: type (6=msgpack, 7=json)
 * - 1 byte: header length (头长度，以字节计)
 * - N bytes: header content (uint64设备ID数组，每个8字节，小端序)
 * - remaining: body (正文，msgpack或json编码的数据)
 */
function encodeProtocolMessage(data, type, deviceIds = [0]) {
    // 1. 编码消息体
    let bodyBuffer;
    if (type === MessageType.MSGPACK) {
        // msgpack 编码
        try {
            const encoded = msgpackr.encode(data);
            bodyBuffer = encoded instanceof Uint8Array ? encoded : new Uint8Array(encoded);
        }
        catch (err) {
            console.error('msgpackr 编码失败，降级为 JSON:', err);
            const jsonStr = JSON.stringify(data);
            bodyBuffer = new TextEncoder().encode(jsonStr);
        }
    }
    else if (type === MessageType.JSON) {
        // json 编码
        const jsonStr = JSON.stringify(data);
        bodyBuffer = new TextEncoder().encode(jsonStr);
    }
    else {
        throw new Error(`不支持的消息类型: ${type}`);
    }
    // 2. 构建头内容 (每个设备ID占8字节，小端序)
    const headerLength = deviceIds.length * 8;
    if (headerLength > 240) {
        throw new Error('设备ID数量超过限制(最多30个)');
    }
    // 3. 组装完整消息 (type + headerLen + header + body)
    const totalLength = 1 + 1 + headerLength + bodyBuffer.length;
    const buffer = new ArrayBuffer(totalLength);
    const view = new DataView(buffer);
    const uint8View = new Uint8Array(buffer);
    let offset = 0;
    // 写入 type (1 byte)
    view.setUint8(offset, type);
    offset += 1;
    // 写入 header length (1 byte)
    view.setUint8(offset, headerLength);
    offset += 1;
    // 写入 header content (每个设备ID 8 bytes, 小端序)
    for (const deviceId of deviceIds) {
        view.setBigUint64(offset, BigInt(deviceId), true); // true = 小端序
        offset += 8;
    }
    // 写入 body (剩余字节)
    uint8View.set(bodyBuffer, offset);
    return buffer;
}
/**
 * 解码二进制协议消息
 */
function decodeProtocolMessage(buffer) {
    try {
        const view = new DataView(buffer);
        const uint8View = new Uint8Array(buffer);
        let offset = 0;
        // 1. 读取 type (1 byte)
        const type = view.getUint8(offset);
        offset += 1;
        // 如果是心跳类型且没有更多数据
        if ((type === MessageType.PING || type === MessageType.PONG) && offset >= buffer.byteLength) {
            return null; // 心跳消息，无需解码
        }
        // 2. 读取 header length (1 byte)
        const headerLength = view.getUint8(offset);
        offset += 1;
        // 3. 读取 header content (设备ID数组，每个8字节，小端序)
        const deviceIds = [];
        const deviceCount = headerLength / 8;
        for (let i = 0; i < deviceCount; i++) {
            const deviceId = view.getBigUint64(offset, true); // true = 小端序
            deviceIds.push(Number(deviceId));
            offset += 8;
        }
        // 4. 读取 body (剩余所有字节)
        if (offset >= buffer.byteLength) {
            return null; // 没有body数据
        }
        const bodyBuffer = uint8View.slice(offset);
        let data;
        // 特殊处理：视频流消息（type=9）
        if (type === MessageType.VIDEO) {
            data = {
                f: 9,
                req: false,
                seq: 0,
                code: 0,
                msg: '',
                t: Date.now(),
                data: bodyBuffer,
            };
            return { deviceIds, data };
        }
        // 特殊处理：纯二进制消息（type=5）
        if (type === MessageType.BYTES) {
            data = {
                f: 299, // FunctionCode.GET_IMAGE
                req: false,
                seq: 0,
                code: 0,
                msg: '',
                t: Date.now(),
                data: bodyBuffer,
            };
            return { deviceIds, data };
        }
        // 特殊处理：终端数据（type=13）
        if (type === MessageType.TERMINAL) {
            // 终端数据直接返回原始字节流
            return { deviceIds, data: bodyBuffer };
        }
        if (type === MessageType.MSGPACK) {
            // msgpack 解码
            try {
                data = msgpackr.decode(bodyBuffer);
            }
            catch (err) {
                // 如果 msgpack 解码失败，尝试 JSON 解码（兼容旧数据）
                console.warn('msgpackr 解码失败，尝试 JSON 解码:', err);
                const jsonStr = new TextDecoder().decode(bodyBuffer);
                data = JSON.parse(jsonStr);
            }
        }
        else if (type === MessageType.JSON) {
            // json 解码
            const jsonStr = new TextDecoder().decode(bodyBuffer);
            data = JSON.parse(jsonStr);
        }
        else {
            console.warn('未知的消息类型:', type);
            return null;
        }
        return { deviceIds, data };
    }
    catch (error) {
        console.error('解码协议消息失败:', error);
        return null;
    }
}
