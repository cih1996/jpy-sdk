<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { MirrorClient } from '../../../../packages/jpy-sdk/src'

const props = defineProps<{
  addLog: (type: 'info' | 'success' | 'error', message: string) => void
}>()

const fullUrl = ref('ws://localhost:8080/box/mirror?id=1')
const connected = ref(false)
const client = ref<MirrorClient | null>(null)
const screenshotUrl = ref('')
const commandLogs = ref<string[]>([])
const customF = ref<number | null>(null)

const connect = async () => {
  try {
    if (client.value) {
      client.value.disconnect()
    }

    client.value = new MirrorClient({
      deviceId: 0,
      url: '',
      token: '',
      fullUrl: fullUrl.value
    })

    props.addLog('info', `Connecting to ${fullUrl.value}...`)
    await client.value.connect()
    connected.value = true
    props.addLog('success', 'Connected!')

    // Setup screenshot handler
    // Note: The SDK might not expose setting callback directly if it's protected or handled differently
    // Checking MirrorConnection.ts: public screenshotCallback
    if (client.value) {
        client.value.screenshotCallback = {
            resolve: (blob) => {
                screenshotUrl.value = URL.createObjectURL(blob)
                props.addLog('success', 'Screenshot received')
            },
            reject: (err) => {
                props.addLog('error', `Screenshot failed: ${err.message}`)
            }
        }
    }

  } catch (err: any) {
    props.addLog('error', `Connection failed: ${err.message}`)
    connected.value = false
  }
}

const disconnect = () => {
  if (client.value) {
    client.value.disconnect()
    client.value = null
  }
  connected.value = false
  props.addLog('info', 'Disconnected')
}

const sendCommand = async (f: number, data?: any) => {
    if (!client.value || !connected.value) return;
    try {
        props.addLog('info', `Sending f=${f}...`)
        const res = await client.value.sendCommand({ f, data })
        props.addLog('success', `Response f=${f}: ${JSON.stringify(res)}`)
        commandLogs.value.unshift(`[${new Date().toLocaleTimeString()}] REQ: f=${f} RES: ${JSON.stringify(res)}`)
    } catch (err: any) {
        props.addLog('error', `Command f=${f} failed: ${err.message}`)
        commandLogs.value.unshift(`[${new Date().toLocaleTimeString()}] REQ: f=${f} ERR: ${err.message}`)
    }
}

const sendCustomCommand = () => {
    if (customF.value) {
        sendCommand(customF.value)
    }
}

onUnmounted(() => {
  disconnect()
})
</script>

<template>
  <div class="panel">
    <div class="control-group">
      <h3>{{ $t('directMirror.title') }}</h3>
      <div class="input-row">
        <label>{{ $t('directMirror.fullUrl') }}</label>
        <input v-model="fullUrl" type="text" placeholder="ws://..." class="full-width" />
      </div>
      <div class="btn-row">
        <button v-if="!connected" @click="connect" class="btn btn-primary">{{ $t('directMirror.connect') }}</button>
        <button v-else @click="disconnect" class="btn btn-danger">{{ $t('directMirror.disconnect') }}</button>
      </div>
    </div>

    <div v-if="connected" class="control-group">
        <h3>{{ $t('directMirror.commands') }}</h3>
        <div class="btn-row">
            <button @click="sendCommand(322)" class="btn">iOS Screenshot (f=322)</button>
            <button @click="sendCommand(9)" class="btn">Android Screenshot (f=9)</button>
            <button @click="sendCommand(101)" class="btn">{{ $t('directMirror.home') }} (f=101)</button>
            <button @click="sendCommand(102)" class="btn">{{ $t('directMirror.back') }} (f=102)</button>
            <button @click="sendCommand(82)" class="btn">{{ $t('directMirror.menu') }} (f=82)</button>
        </div>
        
        <div class="input-row" style="margin-top: 10px;">
             <label>Custom f:</label>
             <input v-model="customF" type="number" placeholder="f" style="width: 80px; padding: 5px; background: #0f172a; color: white; border: 1px solid #475569; border-radius: 4px;" />
             <button @click="sendCustomCommand" class="btn">{{ $t('directMirror.send') }}</button>
        </div>
    </div>

    <div v-if="screenshotUrl" class="screenshot-preview">
        <img :src="screenshotUrl" alt="Screenshot" />
    </div>

    <div class="logs-area">
        <div class="logs-header">
            <h4>{{ $t('directMirror.logs') }}</h4>
            <button @click="commandLogs = []" class="btn btn-sm">{{ $t('directMirror.clear') }}</button>
        </div>
        <div class="logs-content">
            <div v-for="(log, idx) in commandLogs" :key="idx" class="log-item">{{ log }}</div>
        </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  padding: 20px;
}
.control-group {
  margin-bottom: 20px;
  background: #1e293b;
  padding: 15px;
  border-radius: 8px;
}
.input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.full-width {
  flex: 1;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #475569;
  background: #0f172a;
  color: white;
}
.btn-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.btn {
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  background: #3b82f6;
  color: white;
}
.btn-danger {
  background: #ef4444;
}
.btn-primary {
    background: #10b981;
}
.btn-sm {
    padding: 4px 8px;
    font-size: 0.8rem;
    background: #64748b;
}
.screenshot-preview img {
    max-width: 100%;
    border: 1px solid #475569;
    margin-top: 10px;
    border-radius: 4px;
}
.logs-area {
    margin-top: 20px;
    background: #0f172a;
    padding: 10px;
    border-radius: 8px;
}
.logs-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}
.logs-content {
    max-height: 200px;
    overflow-y: auto;
    font-family: monospace;
    font-size: 0.9rem;
    color: #94a3b8;
}
.log-item {
    padding: 4px 0;
    border-bottom: 1px solid #334155;
}
</style>
