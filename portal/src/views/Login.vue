<template>
  <div class="login-shell">
    <div class="login-hero">
      <div class="hero-content">
        <h1>Welcome back to Barbara Platform</h1>
        <p>Manage prompts, monitor calls, and keep Barbara performing at her best.</p>
      </div>
    </div>

    <div class="login-panel">
      <n-card class="login-card" size="huge" :bordered="false">
        <div class="card-header">
          <div class="brand-mark">
            <span class="brand-icon">🌀</span>
          </div>
          <div>
            <h2>Equity Connect Portal</h2>
            <p class="subtitle">Sign in with your admin credentials</p>
          </div>
        </div>

        <n-form @submit.prevent="handleLogin" :model="formState" size="large" ref="formRef">
          <n-form-item label="Email" path="email">
            <n-input
              v-model:value="formState.email"
              placeholder="you@equityconnect.com"
              type="email"
              autofocus
              clearable
            />
          </n-form-item>

          <n-form-item label="Password" path="password">
            <n-input
              v-model:value="formState.password"
              placeholder="Enter your password"
              type="password"
              show-password-on="click"
            />
          </n-form-item>

          <transition name="fade-slide">
            <n-alert
              v-if="error"
              type="error"
              class="alert"
              :bordered="false"
            >
              {{ error }}
            </n-alert>
          </transition>

          <n-button type="primary" size="large" attr-type="submit" block :loading="loading">
            Sign In
          </n-button>
        </n-form>
      </n-card>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { NButton, NForm, NFormItem, NInput, NAlert, NCard } from 'naive-ui'

const router = useRouter()
const { signIn, isAdmin } = useAuth()

const formRef = ref(null)
const formState = reactive({
  email: '',
  password: ''
})
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  loading.value = true
  error.value = ''

  const { error: signInError } = await signIn(formState.email, formState.password)

  if (signInError) {
    error.value = signInError.message
    loading.value = false
  } else {
    router.push(isAdmin.value ? '/admin' : '/broker')
  }
}
</script>

<style scoped>
.login-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 520px);
  background: radial-gradient(circle at 15% 20%, rgba(99, 102, 241, 0.25), transparent 45%),
    radial-gradient(circle at 80% 85%, rgba(56, 189, 248, 0.18), transparent 50%),
    linear-gradient(135deg, #2d2a66 0%, #1d1b38 40%, #151527 100%);
  color: var(--text-inverse);
}

.login-hero {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(3rem, 6vw, 6rem);
}

.login-hero::after {
  content: '';
  position: absolute;
  inset: clamp(2rem, 5vw, 4rem);
  border-radius: 32px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  box-shadow: 0 25px 80px rgba(15, 23, 42, 0.25);
  filter: blur(0.3px);
}

.hero-content {
  position: relative;
  max-width: 520px;
  text-align: left;
  z-index: 1;
}

.hero-content h1 {
  font-size: clamp(2.4rem, 3vw, 3.2rem);
  line-height: 1.1;
  margin-bottom: 1rem;
  color: #f9fafc;
}

.hero-content p {
  font-size: clamp(1.05rem, 1.2vw, 1.2rem);
  color: rgba(248, 250, 252, 0.72);
  max-width: 28rem;
}

.login-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(2rem, 6vw, 4rem);
  backdrop-filter: blur(12px);
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.85) 0%, rgba(15, 23, 42, 0.6) 100%);
}

.login-card {
  width: 100%;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 32px 60px -24px rgba(15, 23, 42, 0.45);
  padding: clamp(2.4rem, 5vw, 3rem);
  color: var(--text-primary);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.brand-mark {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: linear-gradient(135deg, #6366f1, #22d3ee);
  display: grid;
  place-items: center;
  box-shadow: 0 12px 30px rgba(79, 70, 229, 0.25);
}

.brand-icon {
  font-size: 1.3rem;
}

h2 {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--text-primary);
}

.subtitle {
  color: var(--text-secondary);
}

.alert {
  margin-bottom: 1rem;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 220ms ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 960px) {
  .login-shell {
    grid-template-columns: 1fr;
  }

  .login-hero {
    display: none;
  }
}
</style>

