
import { sdkWrapper } from '../lib/sdk-wrapper';
import { parseAddress } from '../utils/url-parser';
import { tokenStore } from '../utils/token-store';

/**
 * Duplicated locally from auth-helper to avoid circular dependencies or structural issues
 * (Ideally should be shared, but keeping changes minimal/safe)
 */
function getProxyAddress(internalAddress: string, proxyHost: string): string {
  const ipMatch = internalAddress.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/);
  if (!ipMatch) return internalAddress;
  const part3 = ipMatch[3];
  const part4 = ipMatch[4];
  const port = parseInt(`${part3}${part4}`, 10);
  if (port > 65535 || port < 1) return internalAddress;
  
  let host = proxyHost.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (host.includes(':')) host = host.split(':')[0];
  
  return `https://${host}:${port}`;
}

export const loginTool = {
  name: 'jpy_login',
  description: 'Login to JPY Boxes (supports batch login via IP range).',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Tenant/User ID (e.g. "Song")' },
      ip: { type: 'string', description: 'Address, IP, or Range. Supports comma-separated list (e.g., "192.168.10.201-210,192.168.11.201-210").' },
      u: { type: 'string', description: 'Username' },
      p: { type: 'string', description: 'Password' },
      proxy: { type: 'string', description: 'Optional: Public Proxy/Tunnel Address (e.g., "129.204.22.176"). If set, connections will be tunneled via this host using derived ports.' }
    },
    required: ['id', 'ip', 'u', 'p']
  },
  handler: async (args: any) => {
    const { id, ip, u, p, proxy } = args;
    const addresses = parseAddress(ip);

    if (addresses.length === 0) {
      return { content: [{ type: 'text', text: 'No valid addresses parsed.' }], isError: true };
    }

    const failures: string[] = [];
    let successCount = 0;

    // Parallel Login
    await Promise.all(addresses.map(async (addr) => {
      const tempOwner = `${id}_${Date.now()}_${Math.random()}`;
      
      // Calculate connection address if proxy is provided
      let connectionAddr = addr;
      if (proxy) {
          connectionAddr = getProxyAddress(addr, proxy);
      }

      try {
          const client = sdkWrapper.initialize({ apiBase: connectionAddr, token: '' }, tempOwner);
          const res = await client.login(u, p);
          
          if (res.success && res.token) {
              // Save to local file store
              // Key: addr (Original Internal IP)
              // Data: Includes proxy info
              tokenStore.saveSession(id, addr, {
                  token: res.token,
                  username: u,
                  password: p, // Storing password for auto-relogin
                  address: addr,
                  proxy: proxy || undefined,
                  updatedAt: new Date().toISOString()
              });
              successCount++;
          } else {
              failures.push(`[${addr}] Login Failed: ${res.error}`);
          }
      } catch (e: any) {
          failures.push(`[${addr}] Error: ${e.message}`);
      }
    }));

    const summary = `Batch Login Summary for '${id}':\nTotal: ${addresses.length}\nSuccess: ${successCount}\nFailed: ${failures.length}`;
    const details = failures.length > 0 ? `\n\nFailure Details:\n${failures.join('\n')}` : '';

    return {
      content: [{ type: 'text', text: summary + details }]
    };
  }
};
