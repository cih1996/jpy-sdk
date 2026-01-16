<script setup lang="ts">
import { type MiddlewareClient } from '../../../../packages/jpy-sdk/src'

const props = defineProps<{
  client: MiddlewareClient
  addLog: (type: 'info' | 'success' | 'error', message: string) => void
}>()

const validateToken = async () => {
  try {
    const result = await props.client.validateToken()
    if (result.valid) {
      props.addLog('success', 'Token 验证通过')
    } else {
      props.addLog('error', `Token 无效: ${result.error}`)
    }
  } catch (error: any) {
    props.addLog('error', `验证Token失败: ${error.message}`)
  }
}

const getLicenseInfo = async () => {
  try {
    const result = await props.client.cluster.getLicenseInfo()
    if (result.success) {
      props.addLog('success', `授权信息: ${JSON.stringify(result.data)}`)
    } else {
      props.addLog('error', `获取授权信息失败: ${result.error}`)
    }
  } catch (error: any) {
    props.addLog('error', `获取授权信息失败: ${error.message}`)
  }
}

const getNetworkInfo = async () => {
  try {
    const result = await props.client.cluster.getNetworkInfo()
    if (result.success) {
      props.addLog('success', `网络信息: ${JSON.stringify(result.data)}`)
    } else {
      props.addLog('error', `获取网络信息失败: ${result.error}`)
    }
  } catch (error: any) {
    props.addLog('error', `获取网络信息失败: ${error.message}`)
  }
}

const reauthorize = async () => {
  const key = prompt('请输入新的授权码(Key):')
  if (!key) return
  try {
    props.addLog('info', '正在重新授权...')
    const result = await props.client.cluster.reauthorize(key)
    if (result.success) {
      props.addLog('success', '重新授权成功')
    } else {
      props.addLog('error', `重新授权失败: ${result.error}`)
    }
  } catch (error: any) {
    props.addLog('error', `重新授权失败: ${error.message}`)
  }
}
</script>

<template>
  <div class="card">
    <h3 class="card-subtitle">Cluster REST API</h3>
    <div class="btn-group">
      <button class="btn btn-outline" @click="validateToken">验证 Token</button>
      <button class="btn btn-outline" @click="getLicenseInfo">授权信息</button>
      <button class="btn btn-outline" @click="getNetworkInfo">网络信息</button>
      <button class="btn btn-outline" @click="reauthorize">重新授权</button>
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
.btn-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
