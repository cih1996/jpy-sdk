/**
 * DHCP 管理类型定义
 */

export interface DHCPLoginResult {
    success: boolean;
    token?: string;
    userInfo?: any;
    error?: string;
}

export interface DHCPLease {
    id: number;
    mode: number;
    ip: number;
    mask: number;
    gateway: number;
    dns1: number;
    dns2: number;
    mac: number;
    SN: string;
    before_at: string;
}

export interface DHCPLeaseListResult {
    success: boolean;
    data?: {
        dataList: DHCPLease[];
        pageNum: number;
        pageSize: number;
        total: number;
    };
    error?: string;
}

export interface DHCPDeleteResult {
    success: boolean;
    error?: string;
}
