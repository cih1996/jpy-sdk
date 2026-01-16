<script setup lang="ts">
import { ref, reactive } from 'vue'
import { DHCPClient } from '../../../packages/jpy-sdk/src'

const props = defineProps<{
  addLog: (type: 'info' | 'success' | 'error', message: string) => void
}>()

const form = reactive({
  username: 'admin',
  password: 'admin'
})

const loggedIn = ref(false)
const leases = ref<any[]>([])

const client = new DHCPClient()

const login = async () => {
  try {
    props.addLog('info', 'Logging into DHCP management...')
    const result = await client.login({
      username: form.username,
      password: form.password
    })

    if (result.success) {
      loggedIn.value = true
      props.addLog('success', 'DHCP login successful')
      fetchLeases()
    } else {
      props.addLog('error', `DHCP login failed: ${result.error}`)
    }
  } catch (error: any) {
    props.addLog('error', `Error: ${error.message}`)
  }
}

const fetchLeases = async () => {
  try {
    props.addLog('info', 'Fetching DHCP leases...')
    const result = await client.getLeases({
      pageNum: 1,
      pageSize: 20
    })
    if (result.success && result.data) {
      leases.value = result.data.dataList
      props.addLog('success', `Fetched ${leases.value.length} leases`)
    } else {
      props.addLog('error', `Failed to fetch leases: ${result.error}`)
    }
  } catch (error: any) {
    props.addLog('error', `Error: ${error.message}`)
  }
}
</script>

<template>
  <div class="demo-container">
    <div class="card">
      <h2 class="card-title">DHCP Management</h2>
      <div v-if="!loggedIn" class="grid-2">
        <div class="form-group">
          <label class="form-label">Username</label>
          <input v-model="form.username" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input v-model="form.password" type="password" class="form-input" />
        </div>
        <button @click="login" class="btn btn-primary">Connect to DHCP</button>
      </div>
      <div v-else class="header-actions">
        <span class="badge badge-success">Connected</span>
        <button @click="fetchLeases" class="btn btn-outline" style="margin-left: 12px">Refresh Leases</button>
      </div>
    </div>

    <div v-if="loggedIn" class="card">
      <h3 class="card-subtitle">Active Leases</h3>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>IP Address</th>
              <th>MAC Address</th>
              <th>Serial Number</th>
              <th>Expiry Time</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(lease, i) in leases" :key="i">
              <td>{{ client.ipNumberToString(lease.ip) }}</td>
              <td class="mono">{{ client.macNumberToString(lease.mac) }}</td>
              <td>{{ lease.SN || '-' }}</td>
              <td>
                <span :class="['status-pill', 'online']">
                  {{ lease.before_at }}
                </span>
              </td>
            </tr>
            <tr v-if="leases.length === 0">
              <td colspan="4" class="empty-state">No leases found</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header-actions {
  display: flex;
  align-items: center;
}

.card-subtitle {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 20px;
}

.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.data-table th {
  text-align: left;
  padding: 12px;
  border-bottom: 2px solid var(--border-color);
  color: var(--text-muted);
  font-weight: 600;
}

.data-table td {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
}

.mono { font-family: monospace; }

.status-pill {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-pill.online { background: #dcfce7; color: #166534; }
.status-pill.offline { background: #f1f5f9; color: #475569; }

.empty-state {
  text-align: center;
  padding: 32px;
  color: var(--text-muted);
}
</style>
