<template>
  <div class="login-shell">
    <n-card class="login-card" size="huge" :bordered="false">
        <div class="card-header">
          <img :src="logoSrc" alt="Barbara" class="card-logo" />
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
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useTheme } from '@/composables/useTheme'
import { NButton, NForm, NFormItem, NInput, NAlert, NCard } from 'naive-ui'
import barbaraLogoDark from '@/assets/barbara-logo-dark.svg'
import barbaraLogoLight from '@/assets/barbara-logo-light.svg'

const router = useRouter()
const { signIn, isAdmin } = useAuth()
const { isDark } = useTheme()

// Switch logo based on theme
const logoSrc = computed(() => isDark.value ? barbaraLogoDark : barbaraLogoLight)

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
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 15% 20%, rgba(99, 102, 241, 0.25), transparent 45%),
    radial-gradient(circle at 80% 85%, rgba(56, 189, 248, 0.18), transparent 50%),
    linear-gradient(135deg, #2d2a66 0%, #1d1b38 40%, #151527 100%);
  color: var(--text-inverse);
}

.login-card {
  width: 100%;
  max-width: 520px;
  border-radius: 24px;
  background: rgba(17, 24, 39, 0.85);
  backdrop-filter: blur(12px);
  box-shadow: 0 32px 60px -24px rgba(15, 23, 42, 0.45);
  padding: clamp(1.4rem, 4vw, 2rem);
  color: var(--text-inverse);
}

.login-card :deep(.n-card__content) {
  padding-top: 0;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.75rem;
  padding-top: 0;
}

.card-logo {
  max-width: 240px;
  width: 100%;
  height: auto;
  margin-top: 20px;
}

.subtitle {
  color: var(--text-secondary);
}

:deep(.n-input__input-el:focus) {
  box-shadow: none !important;
  outline: none !important;
}

:deep(.n-input__input-el) {
  box-shadow: none !important;
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
    padding: 1rem;
  }

  .login-card {
    max-width: 100%;
  }
}
</style>

