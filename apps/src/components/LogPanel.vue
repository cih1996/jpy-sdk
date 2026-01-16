<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  logs: Array<{ type: 'info' | 'success' | 'error'; message: string; time: string }>
}>()

// Dragging logic
const position = ref({ x: window.innerWidth - 420, y: window.innerHeight - 320 })
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

const startDrag = (e: MouseEvent) => {
  if (e.target instanceof HTMLButtonElement) return
  isDragging.value = true
  dragOffset.value = {
    x: e.clientX - position.value.x,
    y: e.clientY - position.value.y
  }
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

const onDrag = (e: MouseEvent) => {
  if (!isDragging.value) return
  position.value = {
    x: e.clientX - dragOffset.value.x,
    y: e.clientY - dragOffset.value.y
  }
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const constrainPosition = () => {
  position.value.x = Math.min(Math.max(0, position.value.x), window.innerWidth - 100)
  position.value.y = Math.min(Math.max(0, position.value.y), window.innerHeight - 100)
}

onMounted(() => {
  window.addEventListener('resize', constrainPosition)
})

onUnmounted(() => {
  window.removeEventListener('resize', constrainPosition)
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
})

defineEmits(['clear'])
</script>

<template>
  <div 
    class="log-panel floating" 
    ref="panelRef"
    :style="{ left: position.x + 'px', top: position.y + 'px' }"
  >
    <div class="log-header" @mousedown="startDrag">
      <div class="log-title">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
        Activity Logs
      </div>
      <div class="header-actions">
        <button @click="$emit('clear')" class="log-clear-btn">Clear</button>
      </div>
    </div>
    <div class="log-content" ref="logContentRef">
      <div v-for="(log, index) in logs" :key="index" class="log-entry">
        <span class="log-time">[{{ log.time }}]</span>
        <span :class="['log-msg', log.type]">{{ log.message }}</span>
      </div>
      <div v-if="logs.length === 0" class="log-empty">
        No activities yet.
      </div>
    </div>
  </div>
</template>

<style scoped>
.log-panel.floating {
  position: fixed;
  z-index: 10000;
  width: 400px;
  height: 300px;
  background: rgba(15, 23, 42, 0.85); /* Semi-transparent dark blue */
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #f8fafc;
}

.log-header {
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: grab;
  user-select: none;
}

.log-header:active {
  cursor: grabbing;
}

.log-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #94a3b8;
}

.log-clear-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #f8fafc;
  cursor: pointer;
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 4px;
}

.log-clear-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.log-content {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.75rem;
  display: flex;
  flex-direction: column-reverse; /* Newest at bottom, but using unshift? wait... */
}

/* If parent uses unshift, oldest is at bottom index. 
   If we want newest at bottom and auto-scroll, we should use push and scroll.
   The parent uses unshift currently. Let's adjust to common log feel.
*/

.log-entry {
  margin-bottom: 4px;
  line-height: 1.4;
  word-break: break-all;
}

.log-time {
  color: #64748b;
  margin-right: 6px;
}

.log-msg.info { color: #f8fafc; }
.log-msg.success { color: #10b981; }
.log-msg.error { color: #ef4444; }

.log-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  font-style: italic;
}

/* Scrollbar styling */
.log-content::-webkit-scrollbar {
  width: 6px;
}
.log-content::-webkit-scrollbar-track {
  background: transparent;
}
.log-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}
</style>
