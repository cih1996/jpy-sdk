import { MirrorConnection } from '../connection';
import { IOSDeviceModule } from './device';
import { IOSAppModule } from './app';
import { IOSInputModule } from './input';
import { IOSFileModule } from './file';
import { IOSScreenModule } from './screen';
import { IOSAutomationModule } from './automation';
import { IOSSystemModule } from './system';

// 显式导出模块
export { IOSDeviceModule } from './device';
export { IOSAppModule } from './app';
export { IOSInputModule } from './input';
export { IOSFileModule } from './file';
export { IOSScreenModule } from './screen';
export { IOSAutomationModule } from './automation';
export { IOSSystemModule } from './system';

// 导出相关类型
export type { TouchPoint } from './input';
export type { ScreenshotOptions } from './screen';
export type { 
  GetImageFromCacheOptions, 
  FindColorOptions, 
  FindImageOptions, 
  OCROptions 
} from './automation';
export type { HttpRequestOptions } from './system';

export class IOSClient {
  public readonly device: IOSDeviceModule;
  public readonly app: IOSAppModule;
  public readonly input: IOSInputModule;
  public readonly file: IOSFileModule;
  public readonly screen: IOSScreenModule;
  public readonly automation: IOSAutomationModule;
  public readonly system: IOSSystemModule;

  constructor(private connection: MirrorConnection) {
    this.device = new IOSDeviceModule(this.connection);
    this.app = new IOSAppModule(this.connection);
    this.input = new IOSInputModule(this.connection);
    this.file = new IOSFileModule(this.connection);
    this.screen = new IOSScreenModule(this.connection);
    this.automation = new IOSAutomationModule(this.connection);
    this.system = new IOSSystemModule(this.connection);
  }
}
