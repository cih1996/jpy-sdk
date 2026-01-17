
import { tokenStore } from '../utils/token-store';
import { parseAddress } from '../utils/url-parser';

export const deviceQueryTool = {
  name: 'jpy_query_devices',
  description: 'Query and filter devices from the latest snapshot. Use this to find target devices for batch operations (e.g., "all USB devices", "offline devices") without rescanning.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Tenant/User ID' },
      filter: {
        type: 'object',
        properties: {
          status: { 
            type: 'string', 
            enum: ['usb', 'otg', 'offline', 'online', 'adb', 'no_ip', 'no_uuid'],
            description: 'Filter by device status' 
          },
          include_ip_range: { type: 'string', description: 'Only include these IPs/Ranges' },
          exclude_ip_range: { type: 'string', description: 'Exclude these IPs/Ranges' },
          model: { type: 'string', description: 'Filter by device model' }
        }
      },
      returnType: { 
        type: 'string', 
        enum: ['summary', 'target_map', 'detail'],
        description: 'Output format: summary (counts only), target_map (for batch control), detail (full info)'
      }
    },
    required: ['id', 'returnType']
  },
  handler: async (args: any) => {
    const { id, filter, returnType } = args;
    
    // 1. Load Snapshots
    const snapshots = tokenStore.getAllSnapshots(id);
    if (snapshots.length === 0) {
      return { 
        content: [{ type: 'text', text: 'No snapshots found. Please run jpy_get_device_info (without IP) first to scan and create a snapshot.' }],
        isError: true 
      };
    }

    // 2. Prepare Filters
    let includeIps: Set<string> | null = null;
    let excludeIps: Set<string> | null = null;

    if (filter?.include_ip_range) {
      includeIps = new Set(parseAddress(filter.include_ip_range).map(u => {
          try { return new URL(u).hostname; } catch { return u; }
      }));
    }
    if (filter?.exclude_ip_range) {
      excludeIps = new Set(parseAddress(filter.exclude_ip_range).map(u => {
          try { return new URL(u).hostname; } catch { return u; }
      }));
    }

    // 3. Iterate and Filter
    let matchedDevices: any[] = [];
    let matchedServers = new Set<string>();

    for (const snap of snapshots) {
      // Server Level Filter
      const serverIp = snap.address.replace(/^https?:\/\//, '').split(':')[0]; // Simple hostname extraction
      
      if (includeIps && !includeIps.has(serverIp) && !includeIps.has(snap.address)) {
        continue;
      }
      if (excludeIps && (excludeIps.has(serverIp) || excludeIps.has(snap.address))) {
        continue;
      }

      // Device Level Filter
      if (snap.devices && Array.isArray(snap.devices)) {
        for (const dev of snap.devices) {
          let match = true;

          if (filter?.status) {
            switch (filter.status) {
              case 'usb': if (!dev.details?.isUSBMode) match = false; break;
              case 'otg': if (dev.details?.isUSBMode !== false) match = false; break; // Strict OTG check
              case 'offline': if (!dev.isOffline) match = false; break;
              case 'online': if (!dev.isFullyOnline) match = false; break;
              case 'adb': if (!dev.details?.isADBEnabled) match = false; break;
              case 'no_ip': if (dev.ip) match = false; break;
              case 'no_uuid': if (dev.uuid) match = false; break;
            }
          }
          
          if (filter?.model && dev.model !== filter.model) {
            match = false;
          }

          if (match) {
            matchedDevices.push({ ...dev, server_ip: snap.address });
            matchedServers.add(snap.address);
          }
        }
      }
    }

    // 4. Format Output
    const totalMatched = matchedDevices.length;
    const serverList = Array.from(matchedServers);

    if (returnType === 'summary') {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            total_matched_devices: totalMatched,
            total_matched_servers: serverList.length,
            server_ips: serverList
          }, null, 2)
        }]
      };
    }

    if (returnType === 'target_map') {
      const targetMap: Record<string, number[]> = {};
      for (const dev of matchedDevices) {
        if (!targetMap[dev.server_ip]) {
          targetMap[dev.server_ip] = [];
        }
        targetMap[dev.server_ip].push(dev.seat);
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            targets: targetMap,
            total_devices: totalMatched
          }, null, 2)
        }]
      };
    }

    if (returnType === 'detail') {
      // Limit detail output to avoid token explosion
      const limit = 50;
      const limitedDevices = matchedDevices.slice(0, limit);
      const remaining = Math.max(0, matchedDevices.length - limit);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            devices: limitedDevices,
            remaining_count: remaining,
            note: remaining > 0 ? 'Output truncated. Use filters to narrow down.' : undefined
          }, null, 2)
        }]
      };
    }

    return { content: [{ type: 'text', text: 'Invalid returnType' }], isError: true };
  }
};
