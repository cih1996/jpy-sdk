<script setup lang="ts">
import { ref, reactive } from 'vue'
import { MiddlewareClient, type DeviceListItem } from '../../../packages/jpy-sdk/src'
import RestApiPanel from './middleware/RestApiPanel.vue'
import SubscribePanel from './middleware/SubscribePanel.vue'
import GuardPanel from './middleware/GuardPanel.vue'
import MirrorPanel from './middleware/MirrorPanel.vue'

const props = defineProps<{
  addLog: (type: 'info' | 'success' | 'error', message: string) => void
}>()

const form = reactive({
  apiBase: 'https://ht.htsystem.cn:1443',
  username: 'admin',
  password: 'admin'
})

const activeTab = ref<'rest' | 'subscribe' | 'guard' | 'mirror'>('rest')
const status = ref<'connected' | 'disconnected' | 'connecting'>('disconnected')
const loggedIn = ref(false)
const devices = ref<DeviceListItem[]>([])
const stats = reactive({
  totalSlots: 0,
  snReady: 0,
  snTotal: 0,
  ipReady: 0,
  ipTotal: 0
})

const client = ref<MiddlewareClient | null>(null)

const login = async () => {
  try {
    client.value = new MiddlewareClient({
      apiBase: form.apiBase
    })
    props.addLog('info', '正在登录中间件...')
    status.value = 'connecting'

    const result = await client.value.login(form.username, form.password)

    if (result.success) {
      loggedIn.value = true
      props.addLog('success', `登录成功！Token: ${result.token?.substring(0, 20)}...`)

      await client.value.subscribe.connect({
        onStatusChange: (s) => {
          status.value = s as any
          props.addLog('info', `连接状态: ${s}`)
        },
        onDeviceListUpdate: (deviceList, deviceStats) => {
          devices.value = deviceList
          Object.assign(stats, deviceStats)
          props.addLog('success', `设备列表更新: ${deviceList.length} 台设备`)
        },
        onDeviceOnlineUpdate: (_, deviceStats) => {
          if (deviceStats) {
            props.addLog('info', `在线状态更新: ${deviceStats.ipReady}/${deviceStats.ipTotal} 在线`)
          }
        },
        onLicenseInfoUpdate: (licenseInfo, authStatus) => {
          props.addLog('info', `授权状态: ${authStatus}, SN: ${licenseInfo.SN}`)
        }
      })
    } else {
      status.value = 'disconnected'
      props.addLog('error', `登录失败: ${result.error}`)
    }
  } catch (error: any) {
    status.value = 'disconnected'
    props.addLog('error', `错误: ${error.message}`)
  }
}

const disconnect = () => {
  client.value?.disconnectAll()
  status.value = 'disconnected'
  loggedIn.value = false
  devices.value = []
  props.addLog('info', '已断开中间件连接')
}
</script>

<template>
  <div class="demo-container">
    <!-- Connection Card -->
    <div class="card mb-6">
      <div class="card-header-flex">
        <h2 class="card-title">连接配置</h2>
        <span :class="['badge', status === 'connected' ? 'badge-success' : status === 'connecting' ? 'badge-warning' : 'badge-danger']">
          {{ status }}
        </span>
      </div>

      <div v-if="!loggedIn" class="grid-3">
        <div class="form-group">
          <label class="form-label">API Base URL</label>
          <input v-model="form.apiBase" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">用户名</label>
          <input v-model="form.username" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">密码</label>
          <input v-model="form.password" type="password" class="form-input" />
        </div>
      </div>
      
      <div class="btn-group">
        <button v-if="!loggedIn" @click="login" class="btn btn-primary" :disabled="status === 'connecting'">
          {{ status === 'connecting' ? '正在连接...' : '登录并连接' }}
        </button>
        <button v-else @click="disconnect" class="btn btn-danger">退出登录</button>
      </div>
    </div>

    <div v-if="loggedIn && client" class="demo-content">
      <!-- Tabs Navigation -->
      <div class="tabs">
        <button 
          :class="['tab-btn', activeTab === 'rest' ? 'active' : '']" 
          @click="activeTab = 'rest'"
        >
          REST API
        </button>
        <button 
          :class="['tab-btn', activeTab === 'subscribe' ? 'active' : '']" 
          @click="activeTab = 'subscribe'"
        >
          Subscribe
        </button>
        <button 
          :class="['tab-btn', activeTab === 'guard' ? 'active' : '']" 
          @click="activeTab = 'guard'"
        >
          Guard
        </button>
        <button 
          :class="['tab-btn', activeTab === 'mirror' ? 'active' : '']" 
          @click="activeTab = 'mirror'"
        >
          Mirror
        </button>
      </div>

      <!-- Tab Content -->
      <div class="tab-content mt-4">
        <RestApiPanel 
          v-show="activeTab === 'rest'" 
          :client="(client as MiddlewareClient)" 
          :add-log="addLog" 
        />
        <SubscribePanel 
          v-show="activeTab === 'subscribe'" 
          :client="(client as MiddlewareClient)" 
          :devices="devices"
          @update:devices="devices = $event"
          :add-log="addLog" 
        />
        <GuardPanel 
          v-show="activeTab === 'guard'" 
          :client="(client as MiddlewareClient)" 
          :add-log="addLog" 
        />
        <MirrorPanel 
          v-show="activeTab === 'mirror'" 
          :client="(client as MiddlewareClient)" 
          :add-log="addLog" 
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.demo-container {
  padding: 20px;
}

.card {
  background: white;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
}

.card-header-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.card-title { margin: 0; font-size: 1.25rem; font-weight: 700; }

.badge {
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}
.badge-success { background: #dcfce7; color: #166534; }
.badge-warning { background: #fef9c3; color: #854d0e; }
.badge-danger { background: #fee2e2; color: #991b1b; }

.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.form-group { margin-bottom: 1rem; }
.form-label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 4px; color: #475569; }
.form-input { width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; }

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.btn-primary { background: #3b82f6; color: white; }
.btn-primary:hover { background: #2563eb; }
.btn-danger { background: #ef4444; color: white; }
.btn-danger:hover { background: #dc2626; }
.btn-outline { background: white; border-color: #cbd5e1; color: #475569; }
.btn-outline:hover { background: #f8fafc; border-color: #94a3b8; }

.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-group { display: flex; flex-wrap: wrap; gap: 8px; }

.tabs {
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 16px;
}

.tab-btn {
  padding: 12px 24px;
  border: none;
  background: none;
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  position: relative;
  transition: color 0.2s;
}

.tab-btn:hover { color: #3b82f6; }

.tab-btn.active {
  color: #3b82f6;
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: #3b82f6;
}

.mt-4 { margin-top: 16px; }
.mb-6 { margin-bottom: 24px; }

@media (max-width: 768px) {
  .grid-3 { grid-template-columns: 1fr; }
}
</style>
