
import { MiddlewareClient } from '../../../packages/jpy-sdk/src/middleware/client';
import { MiddlewareClientConfig } from '../../../packages/jpy-sdk/src/middleware/types';

class SDKWrapper {
  private clients: Map<string, MiddlewareClient> = new Map();
  private defaultOwner: string = 'default';

  public initialize(config: MiddlewareClientConfig, owner: string = 'default') {
    const client = new MiddlewareClient(config);
    this.clients.set(owner, client);
    return client;
  }

  public getClient(owner: string = 'default'): MiddlewareClient | null {
    // If specific owner requested, return it (or undefined if not found)
    // If not found, return null to let the caller handle auto-login logic
    return this.clients.get(owner) || null;
  }

  public isInitialized(owner: string = 'default'): boolean {
    return this.clients.has(owner);
  }
}

export const sdkWrapper = new SDKWrapper();
