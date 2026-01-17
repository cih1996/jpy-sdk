
import { parseAddress } from '../utils/url-parser';
import { executeWithAutoLogin } from '../utils/auth-helper';
import { tokenStore } from '../utils/token-store';

export const deviceInfoTool = {
  name: 'jpy_get_device_info',
  description: 'Get device list and status from JPY Boxes (supports batch). If ip is omitted, scans all saved servers for the user.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Tenant/User ID' },
      ip: { type: 'string', description: 'Address, IP, or Range. Optional.' }
    },
    required: ['id']
  },
  handler: async (args: any) => {
    const { id, ip } = args;
    let addresses: string[] = [];

    if (ip) {
      addresses = parseAddress(ip);
      if (addresses.length === 0) {
        return { content: [{ type: 'text', text: 'No valid addresses parsed from provided IP.' }], isError: true };
      }
    } else {
      // Scan all sessions if IP is not provided
      const sessions = tokenStore.getAllSessions(id);
      if (sessions.length === 0) {
        return { content: [{ type: 'text', text: `No saved sessions found for user '${id}'. Please login first.` }], isError: true };
      }
      addresses = sessions.map(s => s.address);
    }

    const report: any[] = [];

    // Clear previous errors for this user before new full scan
    if (!ip) {
        tokenStore.clearErrors(id);
    }

    await Promise.all(addresses.map(async (addr) => {
        // Use the auth helper to handle token management and retries
        const res = await executeWithAutoLogin(id, addr, async (client) => {
            // Validate token first by simple call or just try connect
            await client.subscribe.connect();
            
            // Fetch lists and extra info (License, Network)
            const [deviceList, onlineList, licenseInfo, networkInfo] = await Promise.all([
                client.subscribe.fetchDeviceList(),
                client.subscribe.fetchDeviceOnlineInfo(),
                client.cluster.getLicenseInfo(),
                client.cluster.getNetworkInfo()
            ]);
            client.subscribe.disconnect();
            
            return { deviceList, onlineList, licenseInfo, networkInfo };
        });

        if (res.success && res.data) {
            const { deviceList, onlineList, licenseInfo, networkInfo } = res.data;
            
            // Stats for this server
            let fullyOnline = 0;
            let offline = 0;
            let hasIPCount = 0;
            let hasUUIDCount = 0;
            let usbModeCount = 0;
            let adbModeCount = 0;
            let otgModeCount = 0;
            let connNormalNoIPCount = 0;
            
            // For error logging
            const problematicDevices: any[] = [];

            const devices = deviceList.map((dev) => {
                const status = onlineList!.find(s => s.seat === dev.seat);
                
                // Extract raw status flags (default to false/empty if no status)
                const ip = status?.ip || '';
                const uuid = dev.uuid || '';
                const isMgmtOnline = status?.isManagementOnline || false;
                const isBizOnline = status?.isBusinessOnline || false;
                const isUSB = status?.isUSBMode || false;
                const isADB = status?.isADBEnabled || false;
                
                // Derived states based on user rules
                // 1. Fully Online: All online states met (Management AND Business)
                const isFullyOnline = isMgmtOnline && isBizOnline;

                // 2. Offline: IP missing OR Business/Management offline
                const isOffline = (ip === '') || (!isBizOnline || !isMgmtOnline);

                // 3. IP Online (Count of existing IPs)
                const hasIP = ip !== '';

                // 4. Serial Number (Count of existing UUIDs)
                const hasUUID = uuid !== '';

                // 5. USB Mode
                const isUSBMode = isUSB === true;

                // 6. ADB Mode
                const isADBEnabled = isADB === true;

                // 7. OTG Mode (isUSBMode is false)
                const isOTGMode = status ? (isUSB === false) : false;

                // 8. Connection Normal but No IP
                const isConnNormalNoIP = isFullyOnline && (ip === '');

                // Increment counters
                if (isFullyOnline) fullyOnline++;
                if (isOffline) offline++;
                if (hasIP) hasIPCount++;
                if (hasUUID) hasUUIDCount++;
                if (isUSBMode) usbModeCount++;
                if (isADBEnabled) adbModeCount++;
                if (isOTGMode) otgModeCount++;
                if (isConnNormalNoIP) connNormalNoIPCount++;

                const deviceData = {
                    seat: dev.seat,
                    uuid: uuid,
                    model: dev.model,
                    ip: ip,
                    isFullyOnline,
                    isOffline,
                    details: status || {}
                };

                // If not fully online, add to problematic list
                if (!isFullyOnline) {
                    problematicDevices.push(deviceData);
                }

                return deviceData;
            });
            
            // If full scan and there are problematic devices, save to error-server
            if (!ip) {
                if (problematicDevices.length > 0) {
                    tokenStore.saveError(id, addr, {
                        ip: addr,
                        isConnectionError: false,
                        devices: problematicDevices
                    });
                }
                
                // Save Snapshot for Query Tool
                tokenStore.saveSnapshot(id, addr, {
                    address: addr,
                    stats: {
                        fullyOnline,
                        offline,
                        hasIPCount,
                        hasUUIDCount,
                        usbModeCount,
                        adbModeCount,
                        otgModeCount,
                        connNormalNoIPCount
                    },
                    extra: {
                        license: licenseInfo,
                        network: networkInfo
                    },
                    devices: devices,
                    timestamp: new Date().toISOString()
                });
            }
            
            report.push({
                address: addr,
                status: 'Success',
                totalDevices: devices.length,
                stats: {
                    fullyOnline,
                    offline,
                    hasIPCount,
                    hasUUIDCount,
                    usbModeCount,
                    adbModeCount,
                    otgModeCount,
                    connNormalNoIPCount
                },
                extra: {
                    license: licenseInfo,
                    network: networkInfo
                },
                devices: devices
            });
        } else {
            // If server connection fails, log it as an error too
            if (!ip) {
                tokenStore.saveError(id, addr, {
                    ip: addr,
                    isConnectionError: true,
                    error: res.error || 'Unknown Connection Error'
                });
            }
            
            report.push({
                address: addr,
                status: 'Failed',
                error: res.error
            });
        }
    }));

    // Summarize for Output (Chinese)
    const successful = report.filter(r => r.status === 'Success');
    const failed = report.filter(r => r.status !== 'Success');
    
    // Global Stats
    const totalServers = addresses.length;
    const successServers = successful.length;
    const failedServers = failed.length;

    let totalDevices = 0;
    let globalStats = {
        fullyOnline: 0,
        offline: 0,
        hasIPCount: 0,
        hasUUIDCount: 0,
        usbModeCount: 0,
        adbModeCount: 0,
        otgModeCount: 0,
        connNormalNoIPCount: 0
    };

    const abnormalServers: string[] = [];

    successful.forEach(r => {
        totalDevices += r.totalDevices;
        globalStats.fullyOnline += r.stats.fullyOnline;
        globalStats.offline += r.stats.offline;
        globalStats.hasIPCount += r.stats.hasIPCount;
        globalStats.hasUUIDCount += r.stats.hasUUIDCount;
        globalStats.usbModeCount += r.stats.usbModeCount;
        globalStats.adbModeCount += r.stats.adbModeCount;
        globalStats.otgModeCount += r.stats.otgModeCount;
        globalStats.connNormalNoIPCount += r.stats.connNormalNoIPCount;

        // Check for server abnormalities
        const issues: string[] = [];
        const missingUUID = r.totalDevices - r.stats.hasUUIDCount;
        const missingIP = r.totalDevices - r.stats.hasIPCount;

        if (r.stats.offline > 0) issues.push(`${r.stats.offline}台离线`);
        if (missingUUID > 0) issues.push(`${missingUUID}台无序列号`);
        if (missingIP > 0) issues.push(`${missingIP}台无IP`);
        
        // License Checks
        const lic = r.extra?.license;
        if (lic && lic.success && lic.data) {
             const data = lic.data;
             if (!data.valid) {
                 issues.push(`授权无效(Status:${data.status})`);
             }
        } else if (lic && !lic.success) {
             issues.push(`授权获取失败`);
        }

        // Network Checks
        const net = r.extra?.network;
        if (net && net.success && net.data) {
             const speed = net.data.Speed;
             if (typeof speed === 'number' && speed < 1000) {
                 issues.push(`网络速率异常(${speed}Mbps)`);
             }
        } else if (net && !net.success) {
             issues.push(`网络信息获取失败`);
        }

        if (issues.length > 0) {
            abnormalServers.push(`[${r.address}] 异常: ${issues.join(', ')}`);
        }
    });
    
    let summaryText = `设备信息概览 - 用户: '${id}'${ip ? '' : ' (全量扫描)'}\n\n`;
    
    summaryText += `1. 服务器统计:\n`;
    summaryText += `   服务器总数: ${totalServers}\n`;
    summaryText += `   连接成功:   ${successServers}\n`;
    summaryText += `   连接失败:   ${failedServers}\n\n`;

    summaryText += `2. 设备详细统计:\n`;
    summaryText += `   设备总数:          ${totalDevices}\n`;
    summaryText += `   完全在线:          ${globalStats.fullyOnline}\n`;
    summaryText += `   离线:              ${globalStats.offline}\n`;
    summaryText += `   IP在线:            ${globalStats.hasIPCount} (无IP: ${totalDevices - globalStats.hasIPCount})\n`;
    summaryText += `   序列号:            ${globalStats.hasUUIDCount} (无序列号: ${totalDevices - globalStats.hasUUIDCount})\n`;
    summaryText += `   USB模式:           ${globalStats.usbModeCount}\n`;
    summaryText += `   ADB模式:           ${globalStats.adbModeCount}\n`;
    summaryText += `   OTG模式:           ${globalStats.otgModeCount}\n`;
    summaryText += `   连接正常但无IP:     ${globalStats.connNormalNoIPCount}\n\n`;

    if (abnormalServers.length > 0) {
        summaryText += `3. 异常服务器明细 (仅列出存在问题的服务器):\n`;
        // Limit output if too many, but user wants to know specific servers
        // Given typical batch sizes (e.g. 10-50 servers), listing all is usually fine.
        // If > 50, maybe we should group or truncate? 
        // User said "avoid output huge token", so maybe limit to 50 lines?
        const limit = 50;
        if (abnormalServers.length > limit) {
             summaryText += abnormalServers.slice(0, limit).join('\n');
             summaryText += `\n... (还有 ${abnormalServers.length - limit} 个服务器存在异常，请缩小范围查询)`;
        } else {
             summaryText += abnormalServers.join('\n');
        }
        summaryText += `\n\n`;
    }

    if (failed.length > 0) {
        summaryText += `\n--- 错误日志 ---\n`;
        failed.forEach(r => {
            summaryText += `[${r.address}]: ${r.error}\n`;
        });
    }

    return {
      content: [{ type: 'text', text: summaryText }]
    };
  }
};
