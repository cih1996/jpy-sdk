<script setup lang="ts">
import { ref, reactive } from 'vue'
import { AdminDeviceClient } from '../../../packages/jpy-sdk/src'

const props = defineProps<{
  addLog: (type: 'info' | 'success' | 'error', message: string) => void
}>()

const form = reactive({
  username: 'admin',
  password: 'admin'
})

const loggedIn = ref(false)
const authNameInput = ref('')
const encryptedCodeInput = ref('')
const authCodeResult = ref<any>(null)

const client = new AdminDeviceClient()

const login = async () => {
  try {
    props.addLog('info', 'Logging into Admin panel...')
    const result = await client.login(form.username, form.password)

    if (result.success) {
      loggedIn.value = true
      props.addLog('success', 'Admin login successful')
    } else {
      props.addLog('error', `Login failed: ${result.error}`)
    }
  } catch (error: any) {
    props.addLog('error', `Error: ${error.message}`)
  }
}

const generateCode = async () => {
  if (!authNameInput.value) return
  try {
    props.addLog('info', `Generating auth code for: ${authNameInput.value}`)
    const result = await client.generateAuthCode(authNameInput.value)
    if (result.success) {
      props.addLog('success', 'Auth code generated successfully')
    } else {
      props.addLog('error', `Generation failed: ${result.error}`)
    }
  } catch (error: any) {
    props.addLog('error', `Error: ${error.message}`)
  }
}

const decrypt = async () => {
  if (!encryptedCodeInput.value) return
  try {
    props.addLog('info', 'Decrypting password...')
    const result = await client.decryptPassword(encryptedCodeInput.value)
    if (result.success) {
      authCodeResult.value = result
      props.addLog('success', `Decryption successful: ${result.password}`)
    } else {
      props.addLog('error', `Decryption failed: ${result.error}`)
    }
  } catch (error: any) {
    props.addLog('error', `Error: ${error.message}`)
  }
}
</script>

<template>
  <div class="demo-container">
    <div class="card">
      <h2 class="card-title">Admin Console</h2>
      <div v-if="!loggedIn" class="grid-2">
        <div class="form-group">
          <label class="form-label">Admin Username</label>
          <input v-model="form.username" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">Admin Password</label>
          <input v-model="form.password" type="password" class="form-input" />
        </div>
        <button @click="login" class="btn btn-primary">Login Admin</button>
      </div>
      <div v-else>
        <span class="badge badge-success">Authenticated</span>
        <button @click="loggedIn = false" class="btn btn-outline" style="margin-left: 12px">Logout</button>
      </div>
    </div>

    <div v-if="loggedIn" class="grid-2">
      <div class="card">
        <h3 class="card-subtitle">Authorization Management</h3>
        <div class="form-group">
          <label class="form-label">Auth Name</label>
          <div class="input-append">
            <input v-model="authNameInput" class="form-input" placeholder="Enter name" />
            <button @click="generateCode" class="btn btn-primary">Generate</button>
          </div>
        </div>
        
        <div class="form-group mt-6">
          <label class="form-label">Decrypt Code</label>
          <div class="input-append">
            <input v-model="encryptedCodeInput" class="form-input" placeholder="Paste encrypted code" />
            <button @click="decrypt" class="btn btn-primary">Decrypt</button>
          </div>
        </div>

        <div v-if="authCodeResult" class="result-box mt-4">
          <div class="result-label">Decrypted Password</div>
          <div class="result-value">{{ authCodeResult.password }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-subtitle {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 20px;
}

.input-append {
  display: flex;
  gap: 8px;
}

.input-append .form-input {
  flex: 1;
}

.mt-6 { margin-top: 24px; }
.mt-4 { margin-top: 16px; }

.result-box {
  background: #f8fafc;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.result-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.result-value {
  font-family: monospace;
  font-weight: 600;
  color: var(--primary);
}
</style>
