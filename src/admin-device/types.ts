/**
 * 管理端设备授权类型定义
 */

export interface AdminCaptchaData {
    captchaId: string;
    captchaPic: string;
}

export interface AdminLoginResult {
    success: boolean;
    token?: string;
    userInfo?: any;
    error?: string;
}

export interface AuthCodeResult {
    success: boolean;
    error?: string;
}

export interface AuthSearchResult {
    success: boolean;
    serialNumber?: string;
    error?: string;
}

export interface DecryptPasswordResult {
    success: boolean;
    password?: string;
    error?: string;
}
