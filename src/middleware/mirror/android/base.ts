import { MirrorConnection } from '../connection';

export class BaseAndroidModule {
  constructor(protected connection: MirrorConnection) {}

  protected get deviceId() {
    return this.connection.deviceId;
  }
}
