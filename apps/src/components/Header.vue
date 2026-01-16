<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <header class="app-header">
    <div class="header-breadcrumb">
      <span class="breadcrumb-item muted">Demos</span>
      <span class="breadcrumb-separator">/</span>
      <span class="breadcrumb-item active">{{ title }}</span>
    </div>

    <div class="header-actions">
      <div class="status-indicator">
        <div class="status-dot"></div>
        <span class="status-text">System Online</span>
      </div>
      
      <div class="user-profile">
        <div class="avatar">A</div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.header-breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
}

.breadcrumb-item.muted { color: var(--text-muted); }
.breadcrumb-item.active { font-weight: 500; color: var(--text-main); }
.breadcrumb-separator { color: var(--border-color); }

.header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 24px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.status-dot {
  width: 8px;
  height: 8px;
  background: var(--success);
  border-radius: 50%;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
}

.user-profile {
  display: flex;
  align-items: center;
}

.avatar {
  width: 32px;
  height: 32px;
  background: #e2e8f0;
  border-radius: 50%;
  border: 2px solid white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: bold;
  color: var(--text-muted);
}
</style>
