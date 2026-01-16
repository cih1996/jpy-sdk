<script setup lang="ts">
import { ref, reactive } from 'vue'
import { DeviceModifyClient } from '../../../packages/jpy-sdk/src'

const props = defineProps<{
  addLog: (type: 'info' | 'success' | 'error', message: string) => void
}>()

const form = reactive({
  url: 'ws://localhost:8080'
})

const status = ref<'connected' | 'disconnected' | 'connecting' | 'error'>('disconnected')
const messages = ref<any[]>([])

const client = new DeviceModifyClient({
  url: form.url
})

const connect = async () => {
  try {
    props.addLog('info', 'Connecting to Modification server...')
    status.value = 'connecting'
    
    await client.connect({
      onStatusChange: (s: any) => {
        status.value = s
        props.addLog('info', `Modification status: ${s}`)
      },
      onMessage: (data: any) => {
        messages.value.unshift(data)
        if (messages.value.length > 50) messages.value.pop()
        props.addLog('info', `Received: ${JSON.stringify(data).substring(0, 100)}...`)
      },
      onError: (err: any) => {
        props.addLog('error', `Modification error: ${err}`)
      }
    })
  } catch (error: any) {
    status.value = 'error'
    props.addLog('error', `Connection failed: ${error.message}`)
  }
}

const disconnect = () => {
  client.disconnect()
  status.value = 'disconnected'
  props.addLog('info', 'Disconnected from Modification server')
}
</script>

<template>
  <div class="demo-container">
    <div class="card">
      <h2 class="card-title">Device Modification</h2>
      <div class="form-group">
        <label class="form-label">WebSocket URL</label>
        <div class="input-append">
          <input v-model="form.url" class="form-input" :disabled="status === 'connected'" />
          <button v-if="status !== 'connected'" @click="connect" class="btn btn-primary" :disabled="status === 'connecting'">
            {{ status === 'connecting' ? 'Connecting...' : 'Connect' }}
          </button>
          <button v-else @click="disconnect" class="btn btn-danger">Disconnect</button>
        </div>
      </div>
      <div class="status-summary">
        Status: <span :class="['badge', status === 'connected' ? 'badge-success' : 'badge-warning']">{{ status }}</span>
      </div>
    </div>

    <div v-if="status === 'connected'" class="card">
      <h3 class="card-subtitle">Real-time Messages</h3>
      <div class="message-list">
        <div v-for="(msg, i) in messages" :key="i" class="message-item">
          <pre>{{ JSON.stringify(msg, null, 2) }}</pre>
        </div>
        <div v-if="messages.length === 0" class="empty-state">Waiting for messages...</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.input-append {
  display: flex;
  gap: 8px;
}

.input-append .form-input {
  flex: 1;
}

.status-summary {
  margin-top: 16px;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.card-subtitle {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 20px;
}

.message-list {
  background: #f1f5f9;
  border-radius: 8px;
  padding: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.message-item {
  background: white;
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 8px;
  border: 1px solid var(--border-color);
  font-size: 0.75rem;
}

.message-item pre {
  margin: 0;
  white-space: pre-wrap;
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: var(--text-muted);
}
</style>
