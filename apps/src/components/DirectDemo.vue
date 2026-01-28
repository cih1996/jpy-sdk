<script setup lang="ts">
import DirectMirrorPanel from './middleware/DirectMirrorPanel.vue'

defineProps<{
  addLog: (type: 'info' | 'success' | 'error', message: string) => void
}>()
</script>

<template>
  <div class="demo-container">
      <DirectMirrorPanel :add-log="addLog" />
  </div>
</template>

<style scoped>
.demo-container {
  padding: 20px;
}
</style>
