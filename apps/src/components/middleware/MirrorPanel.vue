<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { type MiddlewareClient, processImageData, type TouchPoint } from '../../../../packages/jpy-sdk/src'

const props = defineProps<{
  client: MiddlewareClient
  addLog: (type: 'info' | 'success' | 'error', message: string) => void
}>()

const mirrorConnected = ref(false)
const mirrorDeviceId = ref(1)
const platform = ref<'ios' | 'android'>('ios')
const mirrorDeviceInfo = ref<any>(null)
const mirrorOnlineStatus = ref<any>(null)
const appList = ref<any[]>([])
const shellResult = ref('')
const screenshotUrl = ref('')

const shellCommand = ref('')
const textInput = ref('')
const latInput = ref(39.9042)
const lngInput = ref(116.4074)

const tapX = ref(500)
const tapY = ref(1000)
const swipeStartX = ref(500)
const swipeStartY = ref(1500)
const swipeEndX = ref(500)
const swipeEndY = ref(500)
const scrollX = ref(500)
const scrollY = ref(1000)
const scrollDX = ref(0)
const scrollDY = ref(-500)
const customKeyCode = ref(64)

const connectMirror = async () => {
  try {
    props.addLog('info', `正在连接设备 ${mirrorDeviceId.value} 的 Mirror WebSocket...`)
    await props.client.mirror.connect(mirrorDeviceId.value)
    mirrorConnected.value = true
    props.addLog('success', `设备 ${mirrorDeviceId.value} Mirror WebSocket 连接成功`)
  } catch (error: any) {
    props.addLog('error', `连接Mirror WebSocket失败: ${error.message}`)
  }
}

const disconnectMirror = () => {
  if (props.client.mirror) {
    props.client.mirror.disconnect()
    mirrorConnected.value = false
    props.addLog('info', '已断开 Mirror WebSocket 连接')
  }
}

const getDeviceDetail = async () => {
  try {
    props.addLog('info', `正在获取设备详情 (${platform.value})...`)
    if (!props.client.mirror.instance) throw new Error('Mirror 未连接')
    
    if (platform.value === 'ios') {
      mirrorDeviceInfo.value = await props.client.mirror.instance.ios.device.getDetail()
    } else {
      mirrorDeviceInfo.value = await props.client.mirror.instance.android.device.getDetail()
    }
    props.addLog('success', `设备详情已获取`)
  } catch (error: any) {
    props.addLog('error', `获取设备详情失败: ${error.message}`)
  }
}

const getOnlineStatus = async () => {
  try {
    props.addLog('info', '正在获取在线状态...')
    if (!props.client.mirror.instance) throw new Error('Mirror 未连接')

    if (platform.value === 'android') {
      mirrorOnlineStatus.value = await props.client.mirror.instance.android.device.getOnlineStatus()
      props.addLog('success', `在线状态已获取`)
    } else {
      props.addLog('info', 'iOS暂不支持获取在线状态指令 (Cmd 6)')
    }
  } catch (error: any) {
    props.addLog('error', `获取在线状态失败: ${error.message}`)
  }
}

const executeShell = async () => {
  if (!shellCommand.value.trim()) return
  try {
    props.addLog('info', `执行Shell命令: ${shellCommand.value}`)
    if (!props.client.mirror.instance) throw new Error('Mirror 未连接')

    if (platform.value === 'android') {
      const result = await props.client.mirror.instance.android.device.executeShell(shellCommand.value)
      shellResult.value = JSON.stringify(result)
      props.addLog('success', `Shell执行成功`)
    } else {
      props.addLog('error', 'iOS不支持直接执行Shell命令')
    }
  } catch (error: any) {
    props.addLog('error', `执行Shell失败: ${error.message}`)
  }
}

const simulateLocation = async () => {
  try {
    props.addLog('info', `模拟定位: ${latInput.value}, ${lngInput.value}`)
    if (!props.client.mirror.instance) throw new Error('Mirror 未连接')

    if (platform.value === 'ios') {
      await props.client.mirror.instance.ios.device.simulateLocation(latInput.value, lngInput.value, 0)
      props.addLog('success', '模拟定位成功')
    } else {
      props.addLog('error', 'Android模拟定位暂未实现')
    }
  } catch (error: any) {
    props.addLog('error', `模拟定位失败: ${error.message}`)
  }
}

const stopSimulateLocation = async () => {
  try {
    if (!props.client.mirror.instance) throw new Error('Mirror 未连接')
    
    if (platform.value === 'ios') {
      await props.client.mirror.instance.ios.device.stopSimulateLocation()
      props.addLog('success', '已停止模拟定位')
    } else {
      props.addLog('error', 'Android模拟定位暂未实现')
    }
  } catch (error: any) {
    props.addLog('error', `停止模拟定位失败: ${error.message}`)
  }
}

const mirrorPowerControl = async (mode: 0 | 1 | 2) => {
  try {
    if (!props.client.mirror.instance) throw new Error('Mirror 未连接')

    if (platform.value === 'ios') {
      if (mode === 2) {
        await props.client.mirror.instance.ios.device.reboot()
        props.addLog('success', '设备重启中...')
      } else {
        props.addLog('info', 'iOS 仅支持重启操作 (mode=2)')
      }
    } else {
      // Android
      if (mode === 0) {
        await props.client.mirror.instance.android.device.screenOff()
        props.addLog('success', '屏幕已关闭')
      } else if (mode === 1) {
        await props.client.mirror.instance.android.device.screenOn()
        props.addLog('success', '屏幕已开启')
      } else {
        props.addLog('info', 'Android Mirror暂不支持重启，请使用 Guard')
      }
    }
  } catch (error: any) {
    props.addLog('error', `电源控制失败: ${error.message}`)
  }
}

const mirrorSwitchUSB = async (mode: 0 | 1) => {
  try {
    if (!props.client.mirror.instance) throw new Error('Mirror 未连接')
    const modeStr = mode === 1 ? 'USB' : 'OTG'
    
    if (platform.value === 'android') {
      await props.client.mirror.instance.android.device.switchUSBMode(mode)
      props.addLog('success', `USB模式已切换为${modeStr}`)
    } else {
      props.addLog('error', 'iOS不支持切换USB模式')
    }
  } catch (error: any) {
    props.addLog('error', `切换USB模式失败: ${error.message}`)
  }
}

const mirrorControlADB = async (mode: 0 | 1) => {
  try {
    if (!props.client.mirror.instance) throw new Error('Mirror 未连接')
    const modeStr = mode === 1 ? '开启' : '关闭'
    
    if (platform.value === 'android') {
      await props.client.mirror.instance.android.device.controlADB(mode)
      props.addLog('success', `ADB已${modeStr}`)
    } else {
      props.addLog('error', 'iOS不支持控制ADB')
    }
  } catch (error: any) {
    props.addLog('error', `控制ADB失败: ${error.message}`)
  }
}

const getAppList = async (type: string) => {
  try {
    props.addLog('info', `获取应用列表 (${type})...`)
    if (!props.client.mirror.instance) throw new Error('Mirror 未连接')

    if (platform.value === 'ios') {
      // iOS usually takes 'user' or 'system'
      const iosType = type === '' ? 'any' : (type as any)
      appList.value = await props.client.mirror.instance.ios.app.getList(iosType)
    } else {
      // Android
      appList.value = await props.client.mirror.instance.android.app.getList()
    }
    props.addLog('success', `获取到 ${appList.value.length} 个应用`)
  } catch (error: any) {
    props.addLog('error', `获取应用列表失败: ${error.message}`)
  }
}

const pressHome = async () => {
  try {
    if (!props.client.mirror.instance) throw new Error('Mirror 未连接')

    if (platform.value === 'ios') {
      await props.client.mirror.instance.ios.input.pressKey(64)
    } else {
      await props.client.mirror.instance.android.input.pressKey(3, 3) // HOME keycode=3, action=3 (click)
    }
    props.addLog('success', 'Home键按下')
  } catch (error: any) {
    props.addLog('error', `按键失败: ${error.message}`)
  }
}

const inputText = async () => {
  if (!textInput.value.trim()) return
  try {
    if (!props.client.mirror.instance) throw new Error('Mirror 未连接')

    if (platform.value === 'android') {
      await props.client.mirror.instance.android.input.inputText(textInput.value)
      props.addLog('success', `文本输入成功: ${textInput.value}`)
    } else {
      await props.client.mirror.instance.ios.input.inputText(textInput.value)
      props.addLog('success', `文本输入成功: ${textInput.value}`)
    }
  } catch (error: any) {
    props.addLog('error', `输入文本失败: ${error.message}`)
  }
}

const doTap = async () => {
  try {
    const instance = props.client.mirror.instance
    if (!instance) throw new Error('Mirror 未连接')
    
    if (platform.value === 'ios') {
      // iOS: Down then Up
      const points: TouchPoint[] = [
        { id: 1, type: 0, x: tapX.value, y: tapY.value, offset: 0, pressure: 1 },
        { id: 1, type: 1, x: tapX.value, y: tapY.value, offset: 50, pressure: 1 }
      ]
      await instance.ios.input.touchAbsolute(points)
    } else {
      // Android: Down then Up
      await instance.android.input.touch(0, tapX.value, tapY.value)
      await instance.android.input.touch(1, tapX.value, tapY.value)
    }
    props.addLog('success', `点击 (${tapX.value}, ${tapY.value})`)
  } catch (error: any) {
    props.addLog('error', `点击失败: ${error.message}`)
  }
}

const doSwipe = async () => {
  try {
    const instance = props.client.mirror.instance
    if (!instance) throw new Error('Mirror 未连接')
    
    if (platform.value === 'ios') {
      const points: TouchPoint[] = [
        { id: 1, type: 0, x: swipeStartX.value, y: swipeStartY.value, offset: 0, pressure: 1 },
        { id: 1, type: 2, x: swipeEndX.value, y: swipeEndY.value, offset: 200, pressure: 1 },
        { id: 1, type: 1, x: swipeEndX.value, y: swipeEndY.value, offset: 0, pressure: 1 }
      ]
      await instance.ios.input.touchAbsolute(points)
    } else {
      await instance.android.input.touch(0, swipeStartX.value, swipeStartY.value)
      await instance.android.input.touch(2, swipeEndX.value, swipeEndY.value) // Move?
      await instance.android.input.touch(1, swipeEndX.value, swipeEndY.value)
    }
    props.addLog('success', `滑动 (${swipeStartX.value},${swipeStartY.value}) -> (${swipeEndX.value},${swipeEndY.value})`)
  } catch (error: any) {
    props.addLog('error', `滑动失败: ${error.message}`)
  }
}

const doScroll = async () => {
  try {
    if (!props.client.mirror.instance) throw new Error('Mirror 未连接')

    if (platform.value === 'android') {
      // Simple scroll logic: up or down
      const direction = scrollDY.value > 0 ? -1 : 1
      await props.client.mirror.instance.android.input.scroll(direction, scrollX.value, scrollY.value)
      props.addLog('success', `滚动 (${scrollX.value},${scrollY.value}) d(${scrollDX.value},${scrollDY.value})`)
    } else {
      props.addLog('error', 'iOS不支持滚动指令')
    }
  } catch (error: any) {
    props.addLog('error', `滚动失败: ${error.message}`)
  }
}

const doPressKey = async () => {
  try {
    if (!props.client.mirror.instance) throw new Error('Mirror 未连接')

    if (platform.value === 'ios') {
      await props.client.mirror.instance.ios.input.pressKey(customKeyCode.value)
    } else {
      await props.client.mirror.instance.android.input.pressKey(customKeyCode.value)
    }
    props.addLog('success', `按键 ${customKeyCode.value}`)
  } catch (error: any) {
    props.addLog('error', `按键失败: ${error.message}`)
  }
}

const takeScreenshot = async () => {
  try {
    props.addLog('info', '正在截图...')
    if (!props.client.mirror.instance) throw new Error('Mirror 未连接')
    
    let rawData: any;
    if (platform.value === 'ios') {
      rawData = await props.client.mirror.instance.ios.screen.screenshot()
    } else {
      rawData = await props.client.mirror.instance.android.screen.screenshot()
    }
    
    const blob = processImageData(rawData)

    if (screenshotUrl.value) {
      URL.revokeObjectURL(screenshotUrl.value)
    }
    screenshotUrl.value = URL.createObjectURL(blob)
    props.addLog('success', `截图成功`)
  } catch (error: any) {
    props.addLog('error', `截图失败: ${error.message}`)
  }
}

const mirrorReboot = async () => {
  try {
    if (!props.client.mirror.instance) throw new Error('Mirror 未连接')

    if (platform.value === 'ios') {
      await props.client.mirror.instance.ios.device.reboot()
      props.addLog('success', '设备重启中...')
    } else {
      props.addLog('error', 'Android Mirror暂不支持重启')
    }
  } catch (error: any) {
    props.addLog('error', `重启失败: ${error.message}`)
  }
}

const getUIElements = async () => {
  try {
    props.addLog('info', '获取界面元素...')
    if (!props.client.mirror.instance) throw new Error('Mirror 未连接')

    if (platform.value === 'ios') {
      const elements = await props.client.mirror.instance.ios.automation.getUIElement()
      props.addLog('success', `获取 UI 元素成功`)
      console.log('UI Elements:', elements)
    } else {
      props.addLog('error', 'Android暂不支持获取UI元素')
    }
  } catch (error: any) {
    props.addLog('error', `获取 UI 元素失败: ${error.message}`)
  }
}

const siriCommand = async () => {
  const text = prompt('输入 Siri 指令:')
  if (!text) return
  try {
    if (!props.client.mirror.instance) throw new Error('Mirror 未连接')

    if (platform.value === 'ios') {
      await props.client.mirror.instance.ios.system.siri(text)
      props.addLog('success', `Siri 指令已发送: ${text}`)
    } else {
      props.addLog('error', 'Android不支持Siri指令')
    }
  } catch (error: any) {
    props.addLog('error', `Siri 指令失败: ${error.message}`)
  }
}

onUnmounted(() => {
  if (screenshotUrl.value) {
    URL.revokeObjectURL(screenshotUrl.value)
  }
})
</script>

<template>
  <div class="card">
    <h3 class="card-subtitle">Mirror WebSocket 操作</h3>
    
    <div v-if="!mirrorConnected" class="mirror-setup">
      <div class="form-group" style="max-width: 200px">
        <label class="form-label">指定设备 ID</label>
        <div class="input-append">
          <input v-model.number="mirrorDeviceId" type="number" class="form-input" />
        </div>
      </div>
      <div class="form-group" style="max-width: 200px">
        <label class="form-label">平台模式</label>
        <select v-model="platform" class="form-input">
          <option value="ios">iOS</option>
          <option value="android">Android</option>
        </select>
      </div>
      <button @click="connectMirror" class="btn btn-primary mt-4">连接</button>
    </div>

    <div v-else class="mirror-active-area">
      <div class="btn-group mb-6">
        <button class="btn btn-danger" @click="disconnectMirror">断开 Mirror</button>
        <button class="btn btn-outline" @click="getDeviceDetail">设备详情</button>
        <button class="btn btn-outline" @click="getOnlineStatus">在线状态</button>
        <button class="btn btn-outline" @click="takeScreenshot">截图</button>
        <button class="btn btn-outline" @click="pressHome">Home 键</button>
        <button class="btn btn-outline" @click="getUIElements">获取 UI</button>
        <button class="btn btn-outline" @click="siriCommand">Siri 指令</button>
        <button class="btn btn-outline" @click="mirrorReboot">重启设备</button>
      </div>

      <div class="grid-2">
        <!-- Shell & Input -->
        <div class="sub-section">
          <div class="form-group">
            <label class="form-label">Shell 命令</label>
            <div class="input-append">
              <input v-model="shellCommand" class="form-input" placeholder="e.g. getprop" />
              <button @click="executeShell" class="btn btn-primary">执行</button>
            </div>
          </div>

          <div class="form-group mt-4">
            <label class="form-label">输入文本</label>
            <div class="input-append">
              <input v-model="textInput" class="form-input" placeholder="发送到设备" />
              <button @click="inputText" class="btn btn-primary">发送</button>
            </div>
          </div>
        </div>

        <!-- Location -->
        <div class="sub-section">
          <div class="form-group">
            <label class="form-label">模拟定位 (纬度, 经度)</label>
            <div class="input-append">
              <input v-model.number="latInput" type="number" step="0.0001" class="form-input" placeholder="纬度" />
              <input v-model.number="lngInput" type="number" step="0.0001" class="form-input" placeholder="经度" />
              <button @click="simulateLocation" class="btn btn-primary">模拟</button>
              <button @click="stopSimulateLocation" class="btn btn-outline">停止</button>
            </div>
          </div>
        </div>
      </div>

      <div class="grid-2 mt-6">
        <div class="sub-section">
            <h4 class="form-label">触控操作</h4>
            <div class="form-group">
                <label class="form-label small">点击 (x, y)</label>
                <div class="input-append">
                    <input v-model.number="tapX" type="number" class="form-input" placeholder="X" />
                    <input v-model.number="tapY" type="number" class="form-input" placeholder="Y" />
                    <button @click="doTap" class="btn btn-primary">Tap</button>
                </div>
            </div>
             <div class="form-group">
                <label class="form-label small">滑动 (x1,y1 -> x2,y2)</label>
                <div class="input-append">
                    <input v-model.number="swipeStartX" type="number" class="form-input" placeholder="X1" style="width: 60px" />
                    <input v-model.number="swipeStartY" type="number" class="form-input" placeholder="Y1" style="width: 60px" />
                    <span>-></span>
                    <input v-model.number="swipeEndX" type="number" class="form-input" placeholder="X2" style="width: 60px" />
                    <input v-model.number="swipeEndY" type="number" class="form-input" placeholder="Y2" style="width: 60px" />
                    <button @click="doSwipe" class="btn btn-primary">Swipe</button>
                </div>
            </div>
             <div class="form-group">
                <label class="form-label small">滚动 (x,y, dx,dy)</label>
                 <div class="input-append">
                    <input v-model.number="scrollX" type="number" class="form-input" placeholder="X" style="width: 60px" />
                    <input v-model.number="scrollY" type="number" class="form-input" placeholder="Y" style="width: 60px" />
                    <input v-model.number="scrollDX" type="number" class="form-input" placeholder="DX" style="width: 60px" />
                    <input v-model.number="scrollDY" type="number" class="form-input" placeholder="DY" style="width: 60px" />
                    <button @click="doScroll" class="btn btn-primary">Scroll</button>
                </div>
            </div>
        </div>

         <div class="sub-section">
            <h4 class="form-label">按键测试</h4>
             <div class="form-group">
                <label class="form-label">Key Code</label>
                <div class="input-append">
                    <input v-model.number="customKeyCode" type="number" class="form-input" placeholder="Key Code" />
                    <button @click="doPressKey" class="btn btn-primary">发送按键</button>
                </div>
                <div class="small-text mt-2">
                    常见键值: Home(64), Vol+(233), Vol-(234), Back(4), Power(26)
                </div>
            </div>
        </div>
      </div>

      <div class="mt-6">
        <h4 class="card-subtitle small">应用与硬控</h4>
        <div class="btn-group">
          <button class="btn btn-outline btn-sm" @click="getAppList('user')">用户应用</button>
          <button class="btn btn-outline btn-sm" @click="getAppList('system')">系统应用</button>
          <button class="btn btn-outline btn-sm" @click="getAppList('')">全部应用</button>
          <div class="divider"></div>
          <button class="btn btn-outline btn-sm" @click="mirrorPowerControl(1)">开机</button>
          <button class="btn btn-outline btn-sm" @click="mirrorPowerControl(0)">关机</button>
          <button class="btn btn-outline btn-sm" @click="mirrorPowerControl(2)">重启</button>
          <button class="btn btn-outline btn-sm" @click="mirrorSwitchUSB(1)">USB 模式</button>
          <button class="btn btn-outline btn-sm" @click="mirrorSwitchUSB(0)">OTG 模式</button>
          <button class="btn btn-outline btn-sm" @click="mirrorControlADB(1)">开启 ADB</button>
          <button class="btn btn-outline btn-sm" @click="mirrorControlADB(0)">关闭 ADB</button>
        </div>
      </div>

      <div class="result-grids mt-6">
        <div v-if="screenshotUrl" class="screenshot-box">
          <h5>屏幕截图:</h5>
          <img :src="screenshotUrl" class="screenshot-img" />
        </div>

        <div v-if="mirrorDeviceInfo" class="result-pre">
          <h5>设备详情:</h5>
          <pre>{{ JSON.stringify(mirrorDeviceInfo, null, 2) }}</pre>
        </div>
      </div>

      <div v-if="appList.length > 0" class="mt-4 app-list-box">
         <h5>应用列表 (前 10 个):</h5>
         <ul>
           <li v-for="app in appList.slice(0, 10)" :key="app.packageName">{{ app.appName || app.packageName }}</li>
         </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  padding: 20px;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}
.card-subtitle {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 16px;
}
.card-subtitle.small {
  font-size: 0.875rem;
  color: #64748b;
}
.form-group { margin-bottom: 1rem; }
.form-label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 4px; }
.form-input { width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; }
.input-append { display: flex; gap: 8px; }
.btn-group { display: flex; flex-wrap: wrap; gap: 8px; }
.mb-6 { margin-bottom: 24px; }
.mt-4 { margin-top: 16px; }
.mt-6 { margin-top: 24px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.divider { width: 1px; background: #e2e8f0; margin: 0 4px; }
.btn-sm { padding: 4px 8px; font-size: 0.75rem; }

.result-grids {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.screenshot-box { border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; text-align: center; }
.screenshot-img { max-width: 100%; max-height: 400px; border-radius: 4px; }
.result-pre { background: #f1f5f9; padding: 12px; border-radius: 8px; font-size: 0.75rem; max-height: 400px; overflow: auto; }
.app-list-box { background: #f8fafc; padding: 12px; border-radius: 8px; font-size: 0.875rem; }
.app-list-box ul { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; padding: 0; }
</style>