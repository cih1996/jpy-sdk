/**
 * 视频解码 Worker
 * 
 * ⚠️ 注意：此文件仅适用于浏览器环境
 * 
 * 使用方法：
 * ```typescript
 * // 方式 1: 直接引用（需要打包工具支持）
 * const worker = new Worker(new URL('./video-decoder.worker.ts', import.meta.url), { type: 'module' })
 * 
 * // 方式 2: 打包为独立文件后引用
 * const worker = new Worker('/path/to/video-decoder.worker.js')
 * ```
 * 
 * 参考官方实现：docs/worker.js
 * 
 * 关键点：
 * 1. VideoDecoder 在 init 时就创建和配置好
 * 2. P 帧（NAL type=1）直接解码，不需要等key frame
 * 3. 第一次关键帧到来时，组合 SPS+PPS+IDR，然后改变组合状态
 * 4. combineState 用来标记是否需要组合（对应官方的 l 变量）
 * 5. isLoading 控制是否允许解码
 */

let offscreenCanvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let videoDecoder: VideoDecoder | null = null;
let spsData: Uint8Array = new Uint8Array();
let ppsData: Uint8Array = new Uint8Array();
let decoderLastDesc: Uint8Array = new Uint8Array([]);  // 上一次配置的 description
let combineState = 1;  // 组合状态：1=需要在IDR时组合，0=不需要（对应官方的 l 变量）
let isLoading = true;  // 是否在加载状态（对应官方的 o 变量，true表示加载中不解码）
let videoDecoderSupported = true;  // VideoDecoder 是否支持

/**
 * 检查浏览器是否支持 VideoDecoder API
 */
function checkVideoDecoderSupport(): boolean {
  if (typeof VideoDecoder === 'undefined') {
    console.error('[VideoDecoderWorker] VideoDecoder API 不支持');
    return false;
  }
  return true;
}

/**
 * 处理解码后的视频帧
 */
function handleDecodedFrame(frame: VideoFrame) {
  if (!offscreenCanvas || !ctx) {
    console.error('[VideoDecoderWorker] Canvas 未初始化');
    frame.close();
    return;
  }

  try {
    // 调整 Canvas 大小以匹配视频帧（关键：使用 displayWidth/displayHeight）
    if (offscreenCanvas.width !== frame.displayWidth || offscreenCanvas.height !== frame.displayHeight) {
      offscreenCanvas.width = frame.displayWidth;
      offscreenCanvas.height = frame.displayHeight;
      
      // 报告视频尺寸给主线程，让其调整容器大小
      self.postMessage({
        show: false,
        msg: '',
        videoSize: { width: frame.displayWidth, height: frame.displayHeight },
      });
    }

    // 直接绘制 VideoFrame 到 Canvas（高性能）
    ctx.drawImage(frame, 0, 0);

    // 关闭视频帧（释放资源）
    frame.close();
  } catch (error) {
    console.error('[VideoDecoderWorker] 处理视频帧失败:', error);
    frame.close();
    self.postMessage({
      show: true,
      msg: '处理视频帧失败: ' + String(error),
    });
  }
}

/**
 * 合并 NAL 单元（用于 SPS+PPS+IDR）
 * 与官方实现中的 A() 函数对应
 */
function concatUint8Array(a: Uint8Array, b: Uint8Array, c: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length + c.length);
  result.set(a, 0);
  result.set(b, a.length);
  result.set(c, a.length + b.length);
  return result;
}

/**
 * 比较两个 Uint8Array 是否相等
 * 与官方实现中的 b() 函数对应
 */
function uint8ArrayEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * 处理接收到的 H.264 NAL 单元
 * 与官方实现中的 u() 函数对应
 */
async function processH264NAL(data: ArrayBuffer) {
  let uint8Data = new Uint8Array(data);

  // 提取 NAL 类型（第5字节的低5位，对应官方的 t[4] & 31）
  const nalType = uint8Data[4] & 31;
  let frameType = 'delta';  // 默认是 P 帧

  try {
    switch (nalType) {
      case 1: // SLICE - P 帧
        break;

      case 5: // IDR_SLICE - 关键帧
        frameType = 'key';
        
        // 与官方实现保持一致：当 combineState === 1 时，组合 SPS+PPS+IDR
        if (combineState === 1) {
          uint8Data = concatUint8Array(spsData, ppsData, uint8Data) as any;
        }

        // 关键帧到达时，清除加载状态（允许解码）
        if (isLoading) {
          self.postMessage({
            show: false,
            msg: '',
          });
          isLoading = false;
        }
        break;

      case 7: // SPS
        if (uint8Data.length < 1000) {
          // 官方实现：SPS 大小小于 1000 时保存
          combineState = 1;  // 标记需要在IDR时组合（对应官方的 l = 1）
          spsData = uint8Data;
          return;  // 不解码，返回
        }
        // 官方实现中，大 SPS 也会清除加载状态
        if (isLoading) {
          self.postMessage({
            show: false,
            msg: '',
          });
          isLoading = false;
        }
        break;

      case 8: // PPS
        combineState = 1;  // 标记需要在IDR时组合（对应官方的 l = 1）
        ppsData = uint8Data;
        return;  // 不解码，返回

      case 31: // SEI 或其他特殊类型
        // 官方实现中的特殊处理：检查 SEI 的第 8 字节
        if (uint8Data[8] === 39) {
          if (!uint8ArrayEqual(uint8Data, decoderLastDesc)) {
            const config: any = {
              codec: 'avc1.64001E',
              optimizeForLatency: true,
              description: uint8Data,
            };
            if (videoDecoder && videoDecoder.state === 'configured') {
              videoDecoder.configure(config);
            }
            decoderLastDesc = uint8Data;
          }
        }
        return;

      default:
        return;
    }

    // 官方实现中的最后一步：如果不在加载状态，就解码
    if (!isLoading && videoDecoder) {
      try {
        const chunk = new EncodedVideoChunk({
          type: frameType as any,
          timestamp: 0,
          duration: 0,
          data: uint8Data,
        });
        videoDecoder.decode(chunk);
      } catch (error) {
        console.error('[VideoDecoderWorker] 解码失败:', error);
      }
    }
  } catch (error) {
    console.error('[VideoDecoderWorker] 处理 H.264 NAL 失败:', error);
    self.postMessage({
      show: true,
      msg: '处理 H.264 NAL 失败: ' + String(error),
    });
  }
}

/**
 * 处理来自主线程的消息
 * 与官方实现保持一致：
 * - Blob: 视频数据
 * - ArrayBuffer: 视频数据
 * - 对象 with canvas: 初始化请求
 */
self.onmessage = async (event: MessageEvent) => {
  const messageData = event.data;

  try {
    // 与官方实现保持一致的判断顺序
    if (messageData instanceof Blob) {
      const arrayBuffer = await messageData.arrayBuffer();
      await processH264NAL(arrayBuffer);
    } else if (messageData instanceof ArrayBuffer) {
      // 如果还没初始化 Canvas，说明出问题了
      if (!offscreenCanvas || !ctx) {
        console.error('[VideoDecoderWorker] Canvas 未初始化，无法处理视频数据');
        self.postMessage({
          show: true,
          msg: 'Canvas 未初始化',
        });
        return;
      }

      // 直接处理 H.264 NAL 单元
      await processH264NAL(messageData);
    } else if (messageData && typeof messageData === 'object' && messageData.canvas) {
      // 初始化：接收 OffscreenCanvas
      offscreenCanvas = messageData.canvas;

      if (!offscreenCanvas) {
        console.error('[VideoDecoderWorker] OffscreenCanvas 为 null');
        self.postMessage({
          show: true,
          msg: 'OffscreenCanvas 为 null',
        });
        return;
      }

      ctx = offscreenCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D;

      if (!ctx) {
        console.error('[VideoDecoderWorker] 无法获取 2D 上下文');
        self.postMessage({
          show: true,
          msg: '无法获取 OffscreenCanvas 2D 上下文',
        });
        return;
      }

      // 与官方实现保持一致：初始化 VideoDecoder
      if (!videoDecoder && videoDecoderSupported) {
        // 检查 VideoDecoder 是否可用
        if (!checkVideoDecoderSupport()) {
          videoDecoderSupported = false;
          self.postMessage({
            show: true,
            msg: 'VideoDecoder API 不支持，请使用最新版本的 Chrome 或 Edge 浏览器（140+）',
          });
          return;
        }

        try {
          videoDecoder = new VideoDecoder({
            output: handleDecodedFrame,
            error: (error) => {
              console.error('[VideoDecoderWorker] VideoDecoder 错误:', error);
              self.postMessage({
                show: true,
                msg: 'VideoDecoder 错误: ' + String(error),
              });
            },
          });

          // 与官方实现保持一致：预先配置好
          const config: any = {
            codec: 'avc1.64001E', // H.264 基线配置
            optimizeForLatency: true,
          };

          videoDecoder.configure(config);
        } catch (error) {
          videoDecoderSupported = false;
          console.error('[VideoDecoderWorker] 初始化 VideoDecoder 失败:', error);
          self.postMessage({
            show: true,
            msg: 'VideoDecoder 初始化失败: ' + String(error),
          });
          return;
        }
      }

      // Canvas 初始化完成
      self.postMessage({
        show: true,
        msg: '等待视频数据',
      });
    } else {
      console.warn('[VideoDecoderWorker] 未知的消息格式:', messageData);
    }
  } catch (error) {
    console.error('[VideoDecoderWorker] 处理消息失败:', error);
    self.postMessage({
      show: true,
      msg: '处理消息失败: ' + String(error),
    });
  }
};
