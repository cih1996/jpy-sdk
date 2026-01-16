<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { type MiddlewareClient } from '../../../../packages/jpy-sdk/src'

const props = defineProps<{
  client: MiddlewareClient
  addLog: (type: 'info' | 'success' | 'error', message: string) => void
}>()

const guardConnected = ref(false)
const targetSeat = ref(1)
const batchSeats = ref('1,2,3,4')
const romPackages = ref<any[]>([])
const selectedPackage = ref('')
const terminalInput = ref('')
const terminalOutput = ref('')

const connectGuard = async () => {
  try {
    props.addLog('info', `正在连接 Guard WebSocket (deviceId=${targetSeat.value})...`)
    await props.client.guard.connect(targetSeat.value)
    guardConnected.value = true
    props.addLog('success', `Guard WebSocket 连接成功`)
    
    // Set terminal callback
    props.client.guard.setTerminalOutputCallback((output: string) => {
      terminalOutput.value += output
    })
  } catch (error: any) {
    props.addLog('error', `连接 Guard WebSocket 失败: ${error.message}`)
  }
}

const disconnectGuard = () => {
  props.client.guard.disconnect()
  guardConnected.value = false
  props.addLog('info', 'Guard WebSocket 已断开')
}

const switchUSBMode = async (mode: 0 | 1) => {
  try {
    const seat = targetSeat.value
    const modeStr = mode === 1 ? 'USB' : 'OTG'
    props.addLog('info', `正在切换设备 ${seat} USB模式为 ${modeStr}...`)
    await props.client.guard.switchUSBMode(seat, mode)
    props.addLog('success', `设备 ${seat} USB模式已切换为 ${modeStr}`)
  } catch (error: any) {
    props.addLog('error', `切换USB模式失败: ${error.message}`)
  }
}

const powerControl = async (mode: 0 | 1 | 2) => {
  try {
    const seat = targetSeat.value
    const modeStr = mode === 1 ? '供电' : mode === 2 ? '强制重启' : '断电'
    props.addLog('info', `正在控制设备 ${seat} 电源: ${modeStr}...`)
    await props.client.guard.powerControl(seat, mode)
    props.addLog('success', `设备 ${seat} 电源控制成功: ${modeStr}`)
  } catch (error: any) {
    props.addLog('error', `电源控制失败: ${error.message}`)
  }
}

const enableADB = async () => {
  try {
    const seat = targetSeat.value
    props.addLog('info', `正在开启设备 ${seat} ADB...`)
    await props.client.guard.enableADB(seat)
    props.addLog('success', `设备 ${seat} ADB 已开启`)
  } catch (error: any) {
    props.addLog('error', `开启ADB失败: ${error.message}`)
  }
}

const batchAction = async (type: 'usb' | 'power' | 'adb', value: any) => {
  const seats = batchSeats.value.split(',').map(s => parseInt(s.trim())).filter(s => !isNaN(s))
  if (seats.length === 0) return
  
  try {
    props.addLog('info', `开始批量操作: ${type}, seats: ${seats.join(',')}`)
    let results: any[] = []
    if (type === 'usb') results = await props.client.guard.batchSwitchUSBMode(seats, value)
    else if (type === 'power') results = await props.client.guard.batchPowerControl(seats, value)
    else if (type === 'adb') results = await props.client.guard.batchEnableADB(seats, value)
    
    const successCount = results.filter(r => r.success).length
    props.addLog('success', `批量操作完成: ${successCount}/${results.length} 成功`)
  } catch (error: any) {
    props.addLog('error', `批量操作发生错误: ${error.message}`)
  }
}

const getROMPackages = async () => {
  try {
    props.addLog('info', '正在获取 ROM 包列表...')
    romPackages.value = await props.client.guard.getROMPackages()
    props.addLog('success', `获取到 ${romPackages.value.length} 个 ROM 包`)
  } catch (error: any) {
    props.addLog('error', `获取 ROM 列表失败: ${error.message}`)
  }
}

const flashROM = async () => {
  if (!selectedPackage.value) return
  try {
    const seat = targetSeat.value
    props.addLog('info', `开始向设备 ${seat} 刷入 ROM: ${selectedPackage.value}`)
    await props.client.guard.flashROM(seat, '', selectedPackage.value)
    props.addLog('success', `刷机请求已提交`)
  } catch (error: any) {
    props.addLog('error', `刷机失败: ${error.message}`)
  }
}

const sendTerminalCommand = async () => {
  if (!terminalInput.value.trim()) return
  try {
    const cmd = terminalInput.value
    terminalInput.value = ''
    props.addLog('info', `发送终端命令: ${cmd}`)
    await props.client.guard.sendCommand(cmd)
  } catch (error: any) {
    props.addLog('error', `发送终端命令失败: ${error.message}`)
  }
}

const clearTerminal = () => {
  terminalOutput.value = ''
}

onUnmounted(() => {
  if (guardConnected.value) {
    props.client.guard.disconnect()
  }
})
</script>

<template>
  <div class="card">
    <div class="card-header-flex">
      <h3 class="card-subtitle">Guard 控制</h3>
      <span :class="['status-dot', guardConnected ? 'online' : 'offline']"></span>
    </div>
    
    <div v-if="!guardConnected" class="setup-area mb-6">
      <div class="form-group" style="max-width: 240px">
        <label class="form-label">指定盘位 (Seat)</label>
        <div class="input-append">
          <input v-model.number="targetSeat" type="number" class="form-input" />
          <button @click="connectGuard" class="btn btn-primary">连接</button>
        </div>
      </div>
    </div>

    <div v-else class="active-area">
      <div class="btn-group mb-6">
        <button @click="disconnectGuard" class="btn btn-danger">断开 Guard</button>
        <button class="btn btn-outline" @click="getROMPackages">刷机包列表</button>
      </div>

      <div class="grid-2">
        <!-- Single Device Control -->
        <div class="sub-section">
          <h4 class="section-title">单设备控制 (Seat: {{ targetSeat }})</h4>
          <div class="btn-group">
            <button class="btn btn-outline btn-sm" @click="switchUSBMode(1)">切USB</button>
            <button class="btn btn-outline btn-sm" @click="switchUSBMode(0)">切OTG</button>
            <button class="btn btn-outline btn-sm" @click="powerControl(1)">供电</button>
            <button class="btn btn-outline btn-sm" @click="powerControl(0)">断电</button>
            <button class="btn btn-outline btn-sm" @click="powerControl(2)">强制重启</button>
            <button class="btn btn-outline btn-sm" @click="enableADB">开启ADB</button>
          </div>

          <div class="mt-4">
            <h4 class="section-title">ROM 刷机</h4>
            <div class="form-group">
              <select v-model="selectedPackage" class="form-input mb-2">
                <option value="">选择刷机包</option>
                <option v-for="pkg in romPackages" :key="pkg.name" :value="pkg.name">
                  {{ pkg.model }} - {{ pkg.version }} ({{ pkg.desc }})
                </option>
              </select>
              <button class="btn btn-primary btn-block" @click="flashROM" :disabled="!selectedPackage">开始刷机</button>
            </div>
          </div>
        </div>

        <!-- Batch Control -->
        <div class="sub-section">
          <h4 class="section-title">批量控制 (例: 1,2,3)</h4>
          <input v-model="batchSeats" class="form-input mb-2" placeholder="输入盘位号，以逗号分隔" />
          <div class="btn-group">
            <button class="btn btn-outline btn-sm" @click="batchAction('usb', 1)">批量切USB</button>
            <button class="btn btn-outline btn-sm" @click="batchAction('usb', 0)">批量切OTG</button>
            <button class="btn btn-outline btn-sm" @click="batchAction('power', 1)">批量供电</button>
            <button class="btn btn-outline btn-sm" @click="batchAction('power', 0)">批量断电</button>
            <button class="btn btn-outline btn-sm" @click="batchAction('adb', 2)">批量ADB</button>
          </div>
        </div>
      </div>

      <!-- Terminal / Shell -->
      <div class="mt-6 terminal-area">
        <div class="card-header-flex">
          <h4 class="section-title">终端 (Shell)</h4>
          <button @click="clearTerminal" class="btn btn-outline btn-xs">清除</button>
        </div>
        <div class="terminal-view" ref="terminalViewRef">
          <pre>{{ terminalOutput }}</pre>
        </div>
        <div class="input-append mt-2">
          <input 
            v-model="terminalInput" 
            @keyup.enter="sendTerminalCommand" 
            class="form-input terminal-input" 
            placeholder="输入 shell 命令..." 
          />
          <button @click="sendTerminalCommand" class="btn btn-primary">发送</button>
        </div>
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
.card-header-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.card-subtitle {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}
.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.status-dot.online { background: #10b981; }
.status-dot.offline { background: #cbd5e1; }

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 8px;
}

.form-group {
  margin-bottom: 1rem;
}
.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #475569;
  margin-bottom: 4px;
}
.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.875rem;
  background: #f8fafc;
}
.input-append {
  display: flex;
  gap: 8px;
}
.btn-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.btn-sm { padding: 4px 8px; font-size: 0.75rem; }
.btn-xs { padding: 2px 6px; font-size: 0.7rem; }
.btn-block { width: 100%; }

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.mb-2 { margin-bottom: 8px; }
.mb-6 { margin-bottom: 24px; }
.mt-2 { margin-top: 8px; }
.mt-4 { margin-top: 16px; }
.mt-6 { margin-top: 24px; }

.terminal-area {
  background: #0f172a;
  padding: 12px;
  border-radius: 8px;
  color: #f8fafc;
}
.terminal-area .section-title { color: #94a3b8; }
.terminal-view {
  height: 200px;
  overflow-y: auto;
  background: rgba(0,0,0,0.3);
  padding: 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.8125rem;
}
.terminal-view pre { margin: 0; white-space: pre-wrap; word-break: break-all; }
.terminal-input {
  background: #1e293b;
  border-color: #334155;
  color: #f8fafc;
}
</style>
