
import { sdkWrapper } from '../lib/sdk-wrapper';
import { tokenStore } from './token-store';
import { MiddlewareClient } from '../../../packages/jpy-sdk/src/middleware/client';

/**
 * Calculates the proxy URL based on the internal IP and the proxy host.
 * Logic: proxyIP + port derived from last two octets of internal IP.
 * Port = parseInt(part3 + part4)
 * e.g., Internal 192.168.12.201, Proxy 129.204.22.176 -> 129.204.22.176:12201
 */
function getProxyAddress(internalAddress: string, proxyHost: string): string {
    // Extract IP from internal address
    // Matches ipv4 pattern roughly
    const ipMatch = internalAddress.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/);
    if (!ipMatch) {
        // Fallback or just return original if not parseable as IPv4
        return internalAddress;
    }

    const part3 = ipMatch[3];
    const part4 = ipMatch[4];
    
    // Construct port: concatenate part3 and part4
    // e.g. 12 and 201 -> 12201
    const portStr = `${part3}${part4}`;
    const port = parseInt(portStr, 10);

    // Validate port range
    if (port > 65535 || port < 1) {
        console.warn(`Calculated proxy port ${port} is out of range for ${internalAddress}. Using original address.`);
        return internalAddress;
    }

    // Ensure proxyHost doesn't have protocol or path for cleaner construction, or handle if it does
    let host = proxyHost.replace(/^https?:\/\//, '').replace(/\/$/, '');
    // If proxyHost has a port already, we might need to strip it or error? 
    // Assuming proxyHost is just IP or Domain.
    if (host.includes(':')) {
         host = host.split(':')[0];
    }

    return `https://${host}:${port}`;
}

export interface AuthHelperResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * Executes an SDK operation with automatic token management and re-login retry.
 * 
 * @param ownerId The owner context ID (e.g., 'Song')
 * @param address The target server address (e.g., 'https://192.168.1.1:1443')
 * @param operation A callback that performs the SDK action using the provided client.
 *                  Should throw an error if the operation fails.
 */
export async function executeWithAutoLogin<T>(
    ownerId: string,
    address: string,
    operation: (client: MiddlewareClient) => Promise<T>
): Promise<AuthHelperResult<T>> {
    // 1. Load Session
    const session = tokenStore.loadSession(ownerId, address);
    let token = session?.token || '';
    
    // Determine the actual connection address (handle proxy)
    let connectionAddress = address;
    if (session?.proxy) {
        connectionAddress = getProxyAddress(address, session.proxy);
        // console.log(`[Proxy] Using tunnel ${connectionAddress} for ${address}`);
    }

    // Generate a unique owner ID for this specific execution to ensure isolation
    const tempOwner = `${ownerId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Helper to initialize client
    const getClient = (t: string) => sdkWrapper.initialize({ apiBase: connectionAddress, token: t }, tempOwner);

    try {
        // Attempt 1: Use existing token
        const client = getClient(token);
        const result = await operation(client);
        return { success: true, data: result };
    } catch (error: any) {
        const errorMsg = error.message || String(error);

        // Check if we should retry (Auth error)
        // Note: SDK might throw various errors. We broadly catch 401 or token-related messages.
        // Also if the operation failed immediately (e.g. websocket auth fail), we retry.
        const isAuthError = 
            errorMsg.includes('401') || 
            errorMsg.toLowerCase().includes('token') || 
            errorMsg.toLowerCase().includes('auth') ||
            errorMsg.includes('WebSocket'); // WS connection fail often means auth fail or network

        if (isAuthError && session?.username && session?.password) {
            // console.log(`[Auto-Login] Token expired/invalid for ${address}, attempting re-login...`);
            
            try {
                // Attempt Login
                // Login also needs to use the proxy address (already set in getClient via connectionAddress)
                const loginClient = getClient('');
                const loginRes = await loginClient.login(session.username, session.password);

                if (loginRes.success && loginRes.token) {
                    // Update Store
                    // Keep the original address as key, but preserve the proxy info
                    tokenStore.saveSession(ownerId, address, {
                        ...session,
                        token: loginRes.token,
                        updatedAt: new Date().toISOString()
                    });

                    // Attempt 2: Retry operation with new token
                    const retryClient = getClient(loginRes.token);
                    const retryResult = await operation(retryClient);
                    return { success: true, data: retryResult };
                } else {
                    return { success: false, error: `Auto-login failed: ${loginRes.error}` };
                }
            } catch (retryError: any) {
                return { success: false, error: `Retry failed: ${retryError.message}` };
            }
        }

        // If not auth error or no credentials, return original error
        return { success: false, error: errorMsg };
    }
}
