<template>
  <div class="avatar-wrapper">
    <video
      v-show="computedState !== 'speaking'"
      class="avatar-video"
      autoplay
      muted
      loop
      playsinline
      preload="auto"
    >
      <source src="/barbara_idle.mp4" type="video/mp4" />
    </video>
    <video
      v-show="computedState === 'speaking'"
      class="avatar-video"
      autoplay
      muted
      loop
      playsinline
      preload="auto"
    >
      <source src="/barbara_talking.mp4" type="video/mp4" />
    </video>
    <div class="avatar-label">
      <span :class="['status-dot', statusClass]"></span>
      <span class="status-text">{{ statusText }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  state: {
    type: String,
    default: 'idle'
  }
})

const computedState = computed(() => props.state || 'idle')

const statusText = computed(() => {
  switch (computedState.value) {
    case 'speaking':
      return 'Barbara is speaking'
    case 'listening':
      return 'Barbara is listening'
    default:
      return 'Barbara is idle'
  }
})

const statusClass = computed(() => {
  switch (computedState.value) {
    case 'speaking':
      return 'speaking'
    case 'listening':
      return 'listening'
    default:
      return 'idle'
  }
})
</script>

<style scoped>
.avatar-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.avatar-video {
  width: 260px;
  height: 260px;
  border-radius: 18px;
  object-fit: cover;
  box-shadow: 0 15px 45px rgba(16, 24, 40, 0.25);
  background: radial-gradient(circle at center, #ffe7f6 0%, #fdf2ff 60%, #f1e7ff 100%);
}

.avatar-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  color: #5d3d7e;
  font-weight: 500;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  display: inline-flex;
}

.status-dot.idle {
  background: #c4cbd9;
}

.status-dot.listening {
  background: #f5a524;
  box-shadow: 0 0 8px rgba(245, 165, 36, 0.6);
}

.status-dot.speaking {
  background: #8c52ff;
  box-shadow: 0 0 10px rgba(140, 82, 255, 0.8);
}

.status-text {
  letter-spacing: 0.01em;
  text-transform: uppercase;
  font-size: 0.8rem;
}
</style>








