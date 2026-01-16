import { MirrorConnection } from './connection';
import { MirrorWSConfig } from '../types';
import { IOSClient } from './ios';
import { AndroidClient } from './android';

/**
 * Mirror Client - Unified interface for device operations
 * 
 * Strictly separated by platform:
 * - ios: iOS specific features and standard commands
 * - android: Android specific features and standard commands
 */
export class MirrorClient extends MirrorConnection {
  public readonly ios: IOSClient;
  public readonly android: AndroidClient;

  constructor(config: MirrorWSConfig) {
    super(config);
    this.ios = new IOSClient(this);
    this.android = new AndroidClient(this);
  }
}

export { MirrorClient as MirrorWebSocket };

// 导出各平台模块和类型
export * from './ios';
export * from './android';
