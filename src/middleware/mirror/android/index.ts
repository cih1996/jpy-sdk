import { MirrorConnection } from '../connection';
import { AndroidDeviceModule } from './device';
import { AndroidAppModule } from './app';
import { AndroidInputModule } from './input';
import { AndroidScreenModule } from './screen';
import { AndroidAudioModule } from './audio';
import { AndroidFileModule } from './file';

export class AndroidClient {
  public readonly device: AndroidDeviceModule;
  public readonly app: AndroidAppModule;
  public readonly input: AndroidInputModule;
  public readonly screen: AndroidScreenModule;
  public readonly audio: AndroidAudioModule;
  public readonly file: AndroidFileModule;

  constructor(private connection: MirrorConnection) {
    this.device = new AndroidDeviceModule(this.connection);
    this.app = new AndroidAppModule(this.connection);
    this.input = new AndroidInputModule(this.connection);
    this.screen = new AndroidScreenModule(this.connection);
    this.audio = new AndroidAudioModule(this.connection);
    this.file = new AndroidFileModule(this.connection);
  }
}

// 导出相关模块
export { AndroidDeviceModule } from './device';
export { AndroidAppModule } from './app';
export { AndroidInputModule } from './input';
export { AndroidScreenModule } from './screen';
export { AndroidAudioModule } from './audio';
export { AndroidFileModule } from './file';
