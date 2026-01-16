/**
 * 中间件 SDK 类型定义
 */

/**
 * 中间件 SDK 错误类
 * 当 API 返回错误码（code !== 0）时抛出
 */
export class MiddlewareError extends Error {
  constructor(
    public code: number,
    message: string,
    public rawResponse?: any
  ) {
    super(message);
    this.name = 'MiddlewareError';
  }
}

/**
 * 设备列表项（f=5 响应）
 */
export interface DeviceListItem {
  uuid: string;              // 设备唯一标识
  model: string;             // 设备型号（如 iPhone10,3）
  type: number;              // 设备类型（iOS=2, Android=1）
  osVersion: string;         // 系统版本
  androidVersion?: string;   // Android 版本（仅 Android 设备）
  cpu: number;               // CPU 核心数
  memory: string;            // 内存大小（字节，字符串避免精度丢失）
  diskSize: string;          // 磁盘大小（字节，字符串避免精度丢失）
  width: number;             // 屏幕宽度（像素）
  height: number;            // 屏幕高度（像素）
  seat: number;              // 设备位号
}

/**
 * 验证码数据
 */
export interface CaptchaData {
    id: string;
    image: string;
}

/**
 * 授权信息数据
 */
export interface LicenseData {
    I: number;
    IL: number | bigint | string;
    N: string;
    DN: string;
    H: string;
    L: number;
    S: boolean;
    M: number;
    B: number;
    C: string;
    T: number;
    SN: string;
    CT: number;
    VT: number;
    status: number;
    statusTxt: string;
    used: number;
    [key: string]: any;
}

/**
 * 登录结果
 */
export interface LoginResult {
    success: boolean;
    token?: string;
    error?: string;
}

/**
 * 设备在线状态详细信息 (f=6)
 */
export interface OnlineStatus {
    seat: number;
    online: number;
    ip: string;
    time?: number | bigint | string; // 连接时间
    
    // 解析后的状态标志
    isManagementOnline: boolean;   // bit 0: 管理连接在线
    isBusinessOnline: boolean;     // bit 1: 业务连接在线
    isControlBoardOnline: boolean; // bit 3: 控制小板在线
    isUSBMode: boolean;            // bit 6: USB模式 (true=USB, false=OTG)
    isADBEnabled: boolean;         // bit 8: ADB已开启
    
    [key: string]: any;
}

/**
 * Shell 执行结果 (f=289)
 */
export interface ShellResult {
    output: string;
    exitCode?: number;
    error?: string;
}

/**
 * App 信息 (f=290)
 */
export interface AppInfo {
    packageName: string;
    appName: string;
    versionName?: string;
    versionCode?: number;
    installTime?: number | bigint | string;
    size?: number | bigint | string;
    [key: string]: any;
}

/**
 * 设备详细信息 (f=4)
 * 包含设备的完整硬件、系统、屏幕、语言等信息
 */
export interface DeviceDetail {
    // 基础信息
    uuid: string;              // 设备唯一序列号
    seat: number;              // 设备槽位号/盘位号
    model: string;             // 设备型号
    brand: string;             // 设备品牌
    vendor?: string;           // 设备供应商

    // 系统信息
    os: string;                // 操作系统类型（"ios", "android"）
    osVersion: string;         // 操作系统版本
    androidVersion?: string;   // Android 版本号（仅 Android）
    sysVersion?: string;       // 系统版本描述

    // 硬件信息
    cpu: number;               // CPU 核心数
    memory: number | bigint | string;  // 内存大小（字节）
    diskSize: number | bigint | string; // 磁盘大小（字节）
    width: number;             // 屏幕宽度（像素）
    height: number;            // 屏幕高度（像素）
    orientation: number;       // 屏幕方向（0=竖屏, 1=横屏）

    // 地区和语言
    lang: string;              // 语言代码
    country: string;           // 国家/地区
    timezone: string;          // 时区
    location?: string;         // 定位信息（JSON 字符串）

    // 其他信息
    type: number;              // 设备类型
    appVersion?: string;       // 应用版本
    sysPer?: number;           // 系统权限级别
    signalMode?: string;       // 信号模式
    self?: string;             // SDK 版本

    [key: string]: any;
}


/**
 * 授权信息
 */
export interface LicenseInfo {
    valid: boolean;
    expireTime: number | bigint | string;
    maxDevices: number;
    status?: number;
    statusTxt?: string;
    [key: string]: any;
}

/**
 * 网络信息
 */
export interface NetworkInfo {
    ip?: string;
    mac?: string;
    gateway?: string;
    mask?: string;
    dns?: string;
    Speed?: number | string;
    Interface?: string;
    MAC?: string;
    IPv4?: string;
    [key: string]: any;
}

/**
 * Mirror WebSocket 配置
 */
export interface MirrorWSConfig {
    deviceId: number;
    url: string;
    token: string;
    autoReconnect?: boolean;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
}

/**
 * Guard WebSocket 配置
 */
export interface GuardWSConfig {
    deviceId: number;
    url: string;
    token: string;
    autoReconnect?: boolean;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
}

/**
 * ROM 包信息
 */
export interface ROMPackage {
    name: string;
    model: string;
    version: string;
    desc: string;
    [key: string]: any;
}

/**
 * ROM 刷入进度数据 (f=118)
 */
export interface ROMFlashProgressData {
    seat: number;
    status: number; // 1=刷入中, 2=完成, 其他=失败
    progress: number; // 进度 0-100
    step: string; // 当前步骤
    message: string; // 详细信息
    startTime: number | bigint | string;
    endTime?: number | bigint | string;
    lastError?: string;
    [key: string]: any;
}

/**
 * 批量操作结果
 */
export interface BatchOperationResult {
    seat: number;
    success: boolean;
    error?: any;
}

/**
 * 刷机任务状态
 */
export interface FlashTaskStatus {
    taskId: string;
    deviceId: number;
    progress: number;
    status: number; // 1=刷入中, 2=完成, 其他=失败
    session: string;
    image: string;
    queueTime: number | bigint | string;
    startTime: number | bigint | string;
    endTime: number | bigint | string;
    lastError: string;
    [key: string]: any;
}

/**
 * 通用命令执行响应
 *
 * 用于返回结构未明确定义的命令响应。
 * 当看到方法返回此类型且标记了 TODO 时，表示需要补充具体的返回结构。
 *
 * 通过控制台日志 [SDK-Response:*] 查看实际返回数据，然后补充具体的接口定义。
 */
export interface CommandResponse {
    success: boolean;
    data?: any;
    error?: string;
    [key: string]: any;
}

/**
 * 下载任务信息 (f=296)
 */
export interface DownloadTask {
    taskId: string;
    url: string;
    name: string;
    status: number; // 0=准备中, 1=下载中, 2=已完成, 3=已取消, 4=失败
    totalSize: number | bigint | string;
    downloadedSize: number | bigint | string;
    progress: number;
    speed: number;
    sha256?: string;
    error?: string;
    [key: string]: any;
}

/**
 * 界面元素信息 (f=321)
 */
export interface UIElement {
    text: string;
    id: string;
    class: string;
    desc: string;
    package: string;
    bounds: {
        left: number;
        top: number;
        right: number;
        bottom: number;
        // 兼容性字段
        [key: string]: number;
    };
    clickable: boolean;
    scrollable: boolean;
    editable: boolean;
    focused: boolean;
    selected: boolean;
    enabled: boolean;
    depth: number;
    index: number;
    children?: UIElement[];
    [key: string]: any;
}

/**
 * 基础 WebSocket 消息体
 */
export interface WSBaseMessage {
    f?: number;         // 业务功能码
    req?: boolean;      // 是否为请求/推送
    seq?: number;       // 序列号
    code?: number;      // 状态码 (响应)
    msg?: string;       // 错误信息 (响应)
    data?: any;         // 业务数据
    [key: string]: any;
}

/**
 * WebSocket 响应消息
 */
export interface WSResponse extends WSBaseMessage {
    seq?: number;       // 响应序列号
    code?: number;      // 状态码
}

/**
 * WebSocket 推送消息
 */
export interface WSPushMessage extends WSBaseMessage {
    req: true;          // 推送标记
    f: number;          // 业务功能码
}

/**
 * 中间件客户端配置
 */
export interface MiddlewareClientConfig {
    apiBase: string;
    token?: string;
    // 其他配置项
}

/**
 * 按键动作
 */
export interface KeyAction {
    Button: number;
    Action: number;
}

/**
 * 触摸动作
 */
export interface TouchAction {
    t: number;    // 触摸类型: 0=按下, 1=移动, 2=抬起
    x: number;    // X 坐标（像素）
    y: number;    // Y 坐标（像素）
    i?: number;   // 触摸点 ID（多点触控时用于区分不同手指，默认 0）
    d?: number;   // 延迟时间（毫秒，在执行该动作前等待，默认 0）
}

/**
 * 连接状态
 */
export type ConnectionStatus = 'connecting' | 'online' | 'offline';

/**
 * Cluster WebSocket 回调接口
 */
export interface ClusterWSCallbacks {
    onStatusChange?: (status: ConnectionStatus) => void;
    onOperationStatusChange?: (status: string) => void;
    onDeviceListUpdate?: (devices: DeviceListItem[], stats?: { totalSlots: number; snReady: number; snTotal: number; ipReady: number; ipTotal: number }) => void;
    onDeviceOnlineUpdate?: (onlineInfo: OnlineStatus[], stats?: { ipReady: number; ipTotal: number }) => void;
    onLicenseInfoUpdate?: (license: LicenseInfo, authStatus?: 'authorized' | 'unauthorized' | 'pending') => void;
    onSystemVersionUpdate?: (version: any) => void;
    onNetworkInfoUpdate?: (info: NetworkInfo) => void;
    onReconnectAttemptsChange?: (attempts: number) => void;
}

/**
 * 服务器配置
 */
export interface ServerConfig {
    id: string;
    url: string;
    token: string;
    name?: string;
    [key: string]: any;
}
