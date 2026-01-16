import { MirrorConnection } from '../connection';

export class BaseIOSModule {
  constructor(protected connection: MirrorConnection) {}

  protected get deviceId() {
    return this.connection.deviceId;
  }
}
