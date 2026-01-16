import { BaseAndroidModule } from './base';
import { BusinessFunction } from '../../constants';
import { CommandResponse } from '../../types';

export class AndroidAudioModule extends BaseAndroidModule {
  /**
   * 253 开启音频流
   */
  async startAudioStream(sampleRate: number = 48000, audioBitRate: number = 128000): Promise<CommandResponse> {
    return this.connection.sendCommand({
      f: BusinessFunction.AUDIO_STREAM_START,
      data: { sampleRate, audioBitRate },
      req: true
    });
  }

  /**
   * 254 关闭音频流
   */
  async stopAudioStream(): Promise<CommandResponse> {
    return this.connection.sendCommand({ f: BusinessFunction.AUDIO_STREAM_STOP, data: null, req: true });
  }
}
