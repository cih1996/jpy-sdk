<script setup lang="ts">
defineProps<{
  activeTab: string
  tabs: Array<{ id: string; label: string; icon: string }>
}>()

defineEmits(['update:activeTab'])
</script>

<template>
  <aside class="app-sidebar">
    <div class="sidebar-logo">
      <div class="logo-icon">J</div>
      <span class="logo-text">JPY SDK</span>
    </div>
    
    <nav class="sidebar-nav">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        :class="['nav-item', { active: activeTab === tab.id }]"
        @click="$emit('update:activeTab', tab.id)"
      >
        <span class="nav-icon" v-html="tab.icon"></span>
        <span class="nav-label">{{ tab.label }}</span>
      </button>
    </nav>

    <div class="sidebar-footer">
      <div class="version">v1.2.0-beta</div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar-logo {
  height: var(--header-height);
  display: flex;
  align-items: center;
  padding: 0 24px;
  gap: 12px;
  border-bottom: 1px solid #334155;
}

.logo-icon {
  width: 32px;
  height: 32px;
  background: var(--primary);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 1.2rem;
  color: white;
}

.logo-text {
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: -0.02em;
}

.sidebar-nav {
  flex: 1;
  padding: 24px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  width: 100%;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #f8fafc;
}

.nav-item.active {
  background: var(--primary);
  color: white;
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

.sidebar-footer {
  padding: 24px;
  border-top: 1px solid #334155;
}

.version {
  font-size: 0.75rem;
  color: #64748b;
}
</style>
