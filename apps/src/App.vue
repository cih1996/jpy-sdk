<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Sidebar from './components/Sidebar.vue'
import Header from './components/Header.vue'
import LogPanel from './components/LogPanel.vue'
import MiddlewareDemo from './components/MiddlewareDemo.vue'
import AdminDemo from './components/AdminDemo.vue'
import DHCPDemo from './components/DHCPDemo.vue'
import ModifyDemo from './components/ModifyDemo.vue'
import DirectDemo from './components/DirectDemo.vue'

const { t } = useI18n()
const activeTab = ref('middleware')

const tabs = computed(() => [
  { 
    id: 'middleware', 
    label: t('sidebar.middleware'), 
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>' 
  },
  { 
    id: 'admin', 
    label: t('sidebar.admin'), 
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>' 
  },
  { 
    id: 'dhcp', 
    label: t('sidebar.dhcp'), 
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>' 
  },
  { 
    id: 'modify', 
    label: t('sidebar.modify'), 
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>' 
  },
  {
    id: 'direct',
    label: t('directMirror.title'),
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>'
  }
])

const currentTabLabel = computed(() => {
  return tabs.value.find(t => t.id === activeTab.value)?.label || ''
})

// Global Logs
const logs = ref<Array<{ type: 'info' | 'success' | 'error'; message: string; time: string }>>([])

const addLog = (type: 'info' | 'success' | 'error', message: string) => {
  const time = new Date().toLocaleTimeString()
  logs.value.unshift({ type, message, time })
  if (logs.value.length > 100) {
    logs.value.pop()
  }
}

const clearLogs = () => {
  logs.value = []
}
</script>

<template>
  <div id="app">
    <Sidebar 
      :active-tab="activeTab" 
      :tabs="tabs" 
      @update:active-tab="activeTab = $event" 
    />
    
    <main class="app-main">
      <Header :title="currentTabLabel" />
      
      <div class="app-content">
        <MiddlewareDemo v-show="activeTab === 'middleware'" :add-log="addLog" />
        <AdminDemo v-show="activeTab === 'admin'" :add-log="addLog" />
        <DHCPDemo v-show="activeTab === 'dhcp'" :add-log="addLog" />
        <ModifyDemo v-show="activeTab === 'modify'" :add-log="addLog" />
        <DirectDemo v-show="activeTab === 'direct'" :add-log="addLog" />

        <LogPanel :logs="logs" @clear="clearLogs" />
      </div>
    </main>
  </div>
</template>

<style>
/* Global styles are in style.css */
</style>
