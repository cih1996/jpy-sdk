/**
 * 改机测试类型定义
 */

export interface ModifyWebSocketConfig {
    url: string;
    autoRequestDeviceList?: boolean; // 连接成功后自动请求设备列表
    heartbeatInterval?: number; // 心跳间隔（毫秒），默认 30000
}

export interface ModifyWSCallbacks {
    onMessage?: (data: any) => void;
    onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
    onError?: (error: string) => void;
}
