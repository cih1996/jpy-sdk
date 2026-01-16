<script setup lang="ts">
import { ref, computed } from 'vue'
import { type MiddlewareClient, type DeviceListItem, type OnlineStatus } from '../../../../packages/jpy-sdk/src'

const props = defineProps<{
  client: MiddlewareClient
  devices: DeviceListItem[]
  addLog: (type: 'info' | 'success' | 'error', message: string) => void
}>()

const emit = defineEmits<{
  (e: 'update:devices', devices: DeviceListItem[]): void
}>()

// 本地存储在线状态 Map <seat, status>
const onlineStatusMap = ref<Map<number, OnlineStatus>>(new Map())
// 融合后的设备列表（按 seat 升序）
const mergedDevices = computed(() => {
  return props.devices
    .map(device => {
      const status = onlineStatusMap.value.get(device.seat)
      return {
        ...device,
        onlineStatus: status,
        isOnline: status ? (status.isManagementOnline && status.isBusinessOnline) : false,
        ip: status?.ip || ''
      }
    })
    .sort((a, b) => a.seat - b.seat)
})
// 计算统计信息
const stats = computed(() => {
  let ipOnlineCount = 0
  
  // 遍历 map 统计在线数 (以 mergedDevices 为准，确保只统计列表中的设备)
  mergedDevices.value.forEach(d => {
    if (d.isOnline) ipOnlineCount++
  })

  // 统计 SN 就绪设备数
  const snReadyCount = mergedDevices.value.filter(d => d.uuid != '').length
  
  return {
    total: props.devices.length,
    ipOnline: ipOnlineCount,
    snReady: snReadyCount
  }
})

const refreshDeviceList = async () => {
  try {
    const devices = await props.client.subscribe.fetchDeviceList()
    emit('update:devices', devices)
    props.addLog('success', `设备列表已刷新: ${devices.length} 台设备`)
  } catch (error: any) {
    props.addLog('error', `刷新设备列表失败: ${error.message}`)
  }
}

const fetchDeviceOnlineInfo = async () => {
  try {
    const statuses = await props.client.subscribe.fetchDeviceOnlineInfo()
    
    // 更新本地 Map
    statuses.forEach(status => {
      if (status.seat !== undefined) {
        onlineStatusMap.value.set(status.seat, status)
      }
    })
    
    props.addLog('success', `设备在线信息已刷新: ${statuses.length} 条记录`)
  } catch (error: any) {
    props.addLog('error', `获取设备在线信息失败: ${error.message}`)
  }
}

const requestSnapshot = async () => {
  try {
    const id = prompt('输入设备ID进行截图请求:')
    if (!id) return
    await props.client.subscribe.requestDeviceImage(parseInt(id))
    props.addLog('success', `截图请求已发送 (设备 ${id})`)
  } catch (error: any) {
    props.addLog('error', `截图请求失败: ${error.message}`)
  }
}

</script>

<template>
  <div class="subscribe-panel">
    <!-- Stats -->
    <div class="stats-overview grid-3">
      <div class="stat-card">
        <div class="stat-label">总槽位</div>
        <div class="stat-value">{{ stats.total }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">SN就绪</div>
        <div class="stat-value"> {{ stats.snReady }} </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">IP在线</div>
        <div class="stat-value">{{ stats.ipOnline }}</div>
      </div>
    </div>

    <div class="grid-2 mt-6">
      <div class="card">
        <h3 class="card-subtitle">Subscribe 控制</h3>
        <div class="btn-group">
          <button class="btn btn-outline" @click="refreshDeviceList">刷新设备列表</button>
          <button class="btn btn-outline" @click="fetchDeviceOnlineInfo">获取设备在线信息</button>
          <button class="btn btn-outline" @click="requestSnapshot">请求截图</button>
        </div>
      </div>

      <!-- Device List (Brief) -->
      <div class="card">
        <div class="card-header-flex">
          <h3 class="card-subtitle">实时设备列表 (前24)</h3>
        </div>
        <div class="device-mini-grid">
           <div v-for="device in mergedDevices.slice(0, 24)" :key="device.seat" class="mini-device-card" :title="device.ip">
              <div class="mini-dot" :class="{ online: device.isOnline, offline: !device.isOnline }"></div>
              <span>设备 {{ device.seat }}</span>
           </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-overview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  text-align: center;
}

.stat-label {
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #3b82f6;
}

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

.btn-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.device-mini-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 8px;
}

.mini-device-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
}

.mini-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.mini-dot.online { background: #10b981; }
.mini-dot.offline { background: #cbd5e1; }

.mt-6 { margin-top: 24px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
@media (max-width: 768px) {
  .grid-3, .grid-2 { grid-template-columns: 1fr; }
}
</style>
