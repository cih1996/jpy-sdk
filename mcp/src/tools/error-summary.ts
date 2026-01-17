import { tokenStore } from '../utils/token-store';

export const errorSummaryTool = {
  name: 'jpy_get_error_summary',
  description: 'Aggregate error statistics from previous full scan (jpy_get_device_info without ip)',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Tenant/User ID' }
    },
    required: ['id']
  },
  handler: async (args: any) => {
    const { id } = args;
    const errors = tokenStore.getAllErrors(id);

    if (errors.length === 0) {
      return {
        content: [{ type: 'text', text: `没有找到用户 '${id}' 的错误记录。请先执行全量设备扫描 (jpy_get_device_info 不带 IP)。` }]
      };
    }

    // Aggregation Logic
    const connectionErrors: Record<string, number> = {};
    let deviceErrorServerCount = 0;
    let totalProblematicDevices = 0;

    errors.forEach(err => {
        if (err.isConnectionError) {
            const msg = err.error || 'Unknown Error';
            // Simplify error message (e.g. "fetch failed" -> "连接失败")
            let simplifiedMsg = msg;
            if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')) {
                simplifiedMsg = '连接超时/失败';
            } else if (msg.includes('401') || msg.includes('auth') || msg.includes('token')) {
                simplifiedMsg = '认证失败';
            }
            
            connectionErrors[simplifiedMsg] = (connectionErrors[simplifiedMsg] || 0) + 1;
        } else {
            deviceErrorServerCount++;
            if (Array.isArray(err.devices)) {
                totalProblematicDevices += err.devices.length;
            }
        }
    });

    let summaryText = `错误聚合报告 - 用户: '${id}'\n\n`;

    const connErrorKeys = Object.keys(connectionErrors);
    if (connErrorKeys.length > 0) {
        summaryText += `1. 服务器连接错误:\n`;
        connErrorKeys.forEach(key => {
            summaryText += `   - ${key}: ${connectionErrors[key]} 个服务器\n`;
        });
        summaryText += `\n`;
    } else {
        summaryText += `1. 服务器连接错误: 无\n\n`;
    }

    if (deviceErrorServerCount > 0) {
        summaryText += `2. 设备异常服务器:\n`;
        summaryText += `   - ${deviceErrorServerCount} 个服务器存在离线/异常设备\n`;
        summaryText += `   - 共计 ${totalProblematicDevices} 台设备未完全在线\n`;
    } else {
        summaryText += `2. 设备异常服务器: 无\n`;
    }

    return {
      content: [{ type: 'text', text: summaryText }]
    };
  }
};
