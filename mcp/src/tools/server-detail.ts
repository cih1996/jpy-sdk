import { executeWithAutoLogin } from '../utils/auth-helper';

export const serverDetailTool = {
  name: 'jpy_get_server_detail',
  description: 'Get detailed device information for a specific server. Returns merged device list and status, or error info.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Tenant/User ID' },
      address: { type: 'string', description: 'Server IP or URL (single address only)' }
    },
    required: ['id', 'address']
  },
  handler: async (args: any) => {
    const { id, address } = args;

    if (!address) {
        return { content: [{ type: 'text', text: 'Address is required.' }], isError: true };
    }

    // Normalize address (add https if missing)
    let targetAddress = address.trim();
    // Simple check if it's likely an IP or domain without protocol
    if (!targetAddress.startsWith('http://') && !targetAddress.startsWith('https://')) {
        targetAddress = `https://${targetAddress}`;
    }

    // Use auth helper to get data
    const res = await executeWithAutoLogin(id, targetAddress, async (client) => {
        await client.subscribe.connect();
        
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

        // Merge logic
        const mergedDevices = deviceList.map((dev: any) => {
            const status = onlineList?.find((s: any) => s.seat === dev.seat);
            return {
                ...dev,
                onlineStatus: status || null
            };
        });

        // Formatted Text Output
        const lines: string[] = [];
        lines.push(`SERVER: ${targetAddress}`);
        lines.push('==================================================');
        
        // License
        const lic = (licenseInfo?.data || {}) as any;
        lines.push(`[License] ${lic.N || 'N/A'} (SN: ${lic.SN || 'N/A'}) - Status: ${lic.statusTxt || 'N/A'}`);
        
        // Network
        const net = (networkInfo?.data || {}) as any;
        lines.push(`[Network] IP: ${net.IPv4 || 'N/A'} | Speed: ${net.Speed || 'N/A'} Mb`);
        
        lines.push('--------------------------------------------------');
        lines.push(`[Devices] Total: ${mergedDevices.length}`);
        
        // Device Table Header
        lines.push(
            'Seat'.padEnd(6) + 
            'Model'.padEnd(15) + 
            'Status'.padEnd(10) + 
            'Mode'.padEnd(8) + 
            'IP'.padEnd(16) + 
            'UUID'
        );
        lines.push('-'.repeat(80));

        mergedDevices.forEach((d: any) => {
            const s = d.onlineStatus;
            
            // Determine Status String
            let statusStr = 'Offline';
            if (s?.isManagementOnline && s?.isBusinessOnline) statusStr = 'Online';
            else if (s?.isManagementOnline) statusStr = 'MgmtOnly';
            
            // Determine Mode
            let modeStr = '-';
            if (s) {
                if (s.isUSBMode === true) modeStr = 'USB';
                else if (s.isUSBMode === false) modeStr = 'OTG';
            }

            const ipStr = s?.ip || '-';
            const uuidStr = d.uuid || '-';
            const seatStr = String(d.seat).padEnd(6);
            const modelStr = (d.model || 'Unknown').padEnd(15);
            
            lines.push(
                `${seatStr}${modelStr}${statusStr.padEnd(10)}${modeStr.padEnd(8)}${ipStr.padEnd(16)}${uuidStr}`
            );
        });

        return {
            content: [{ 
                type: 'text', 
                text: lines.join('\n')
            }]
        };

    } else {
        // Return error details
        return {
            content: [{ 
                type: 'text', 
                text: `SERVER: ${targetAddress}\nSTATUS: FAILED\nERROR: ${res.error || 'Unknown Error'}`
            }]
        };
    }
  }
};
