import { computed, onBeforeUnmount, onMounted, readonly, ref, watch } from 'vue'
import { darkTheme } from 'naive-ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/composables/useAuth'

const STORAGE_KEY = 'ec-portal-theme'
const VALID_THEMES = ['light', 'dark', 'auto']

const themeMode = ref('light')
const systemTheme = ref('light')
const loadingPreferences = ref(false)
const initialized = ref(false)

let mediaQuery = null
let hasMountedEffects = false
let hasSetup = false

const sharedCommon = {
  primaryColor: '#4f46e5',
  primaryColorHover: '#6366f1',
  primaryColorPressed: '#4338ca',
  primaryColorSuppl: '#818cf8',
  infoColor: '#3b82f6',
  successColor: '#16a34a',
  warningColor: '#f59e0b',
  errorColor: '#ef4444',
  fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  fontWeightStrong: '600',
  borderRadius: '12px',
  boxShadow1: '0 4px 12px rgba(15, 23, 42, 0.08)',
  boxShadow2: '0 18px 40px rgba(79, 70, 229, 0.08)'
}

const lightThemeOverrides = {
  common: {
    ...sharedCommon,
    baseColor: '#f6f7fb',
    bodyColor: '#f6f7fb',
    cardColor: '#ffffff',
    modalColor: '#ffffff',
    popoverColor: '#ffffff',
    tableColor: '#ffffff',
    inputColor: '#ffffff',
    textColorBase: '#111827',
    textColor1: '#111827',
    textColor2: '#4b5563',
    textColor3: '#6b7280',
    borderColor: '#e2e8f0',
    borderColorStrong: '#d0d7e8'
  },
  Button: {
    borderRadiusMedium: '999px',
    heightMedium: '42px',
    fontWeight: '500'
  },
  Tabs: {
    tabGapMedium: '0.5rem',
    tabFontSizeMedium: '0.95rem',
    barColor: 'rgba(99, 102, 241, 0.2)',
    tabTextColorBarActive: '#4f46e5',
    tabTextColorBarHover: '#6366f1'
  },
  Card: {
    borderRadius: '18px',
    paddingSmall: '1.25rem'
  },
  Menu: {
    itemColorActive: 'transparent',
    itemColorActiveHover: 'transparent'
  }
}

const darkThemeOverrides = {
  common: {
    ...sharedCommon,
    baseColor: '#0f172a',
    bodyColor: '#0b1220',
    cardColor: '#111c34',
    modalColor: '#111c34',
    popoverColor: '#13203d',
    tableColor: '#111c34',
    inputColor: '#0f172a',
    textColorBase: '#e2e8f0',
    textColor1: '#f8fafc',
    textColor2: '#cbd5f5',
    textColor3: '#94a3b8',
    borderColor: '#1e293b',
    borderColorStrong: '#334155',
    boxShadow1: '0 6px 20px rgba(2, 6, 23, 0.42)',
    boxShadow2: '0 30px 60px rgba(79, 70, 229, 0.14)'
  },
  Button: {
    borderRadiusMedium: '999px',
    heightMedium: '42px',
    fontWeight: '500',
    textColor: '#f8fafc'
  },
  Tabs: {
    tabGapMedium: '0.5rem',
    tabFontSizeMedium: '0.95rem',
    barColor: 'rgba(99, 102, 241, 0.35)',
    tabTextColorBarActive: '#c7d2fe',
    tabTextColorBarHover: '#e0e7ff'
  },
  Card: {
    borderRadius: '18px',
    paddingSmall: '1.25rem',
    color: '#f1f5f9'
  },
  Menu: {
    itemColorActive: 'rgba(76, 81, 191, 0.22)',
    itemColorActiveHover: 'rgba(99, 102, 241, 0.28)',
    itemColorHover: 'rgba(76, 81, 191, 0.16)',
    itemTextColorActive: '#c7d2fe'
  }
}

function getSystemPreference() {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readStoredTheme() {
  if (typeof window === 'undefined') return null
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return VALID_THEMES.includes(value) ? value : null
  } catch (error) {
    console.warn('Unable to access theme storage:', error)
    return null
  }
}

function writeStoredTheme(mode) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch (error) {
    console.warn('Unable to persist theme preference:', error)
  }
}

function applyDomTheme(theme) {
  if (typeof document === 'undefined') return

  document.documentElement.dataset.theme = theme
  document.body.dataset.theme = theme
  document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light'
}

async function persistThemePreference(userId, mode, extra = {}) {
  const payload = {
    user_id: userId,
    theme: mode,
    updated_at: new Date().toISOString()
  }

  if (typeof extra.emailNotifications === 'boolean') {
    payload.email_notifications = extra.emailNotifications
  }

  const { error } = await supabase
    .from('user_preferences')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) {
    throw error
  }
}

async function fetchRemotePreference(userId) {
  loadingPreferences.value = true
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('theme, email_notifications')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      throw error
    }

    return data ?? null
  } finally {
    loadingPreferences.value = false
  }
}

export function useTheme() {
  const { user } = useAuth()

  const resolvedTheme = computed(() => {
    const mode = themeMode.value
    return mode === 'auto' ? systemTheme.value : mode
  })

  const isDark = computed(() => resolvedTheme.value === 'dark')
  const naiveTheme = computed(() => (isDark.value ? darkTheme : null))
  const themeOverrides = computed(() => (isDark.value ? darkThemeOverrides : lightThemeOverrides))

  if (!hasSetup) {
    hasSetup = true

    systemTheme.value = getSystemPreference()

    if (typeof window !== 'undefined') {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

      const handleSystemThemeChange = (event) => {
        systemTheme.value = event.matches ? 'dark' : 'light'
      }

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleSystemThemeChange)
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleSystemThemeChange)
      }

      onBeforeUnmount(() => {
        if (!mediaQuery) return
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', handleSystemThemeChange)
        } else if (mediaQuery.removeListener) {
          mediaQuery.removeListener(handleSystemThemeChange)
        }
      })
    }

    const stored = readStoredTheme()
    if (stored) {
      themeMode.value = stored
    } else if (typeof window !== 'undefined') {
      const fallback = systemTheme.value === 'dark' ? 'dark' : 'light'
      themeMode.value = fallback
    }

    watch(
      resolvedTheme,
      (theme) => {
        applyDomTheme(theme)
        initialized.value = true
      },
      { immediate: true }
    )
  }

  if (!hasMountedEffects) {
    hasMountedEffects = true

    onMounted(() => {
      applyDomTheme(resolvedTheme.value)
    })
  }

  watch(
    user,
    async (currentUser) => {
      if (!currentUser) {
        const stored = readStoredTheme()
        if (stored) {
          themeMode.value = stored
        }
        return
      }

      try {
        const preference = await fetchRemotePreference(currentUser.id)
        const remoteTheme = preference?.theme

        if (remoteTheme && VALID_THEMES.includes(remoteTheme)) {
          await setTheme(remoteTheme, { persist: false, emailNotifications: preference?.email_notifications })
        } else if (!readStoredTheme()) {
          await setTheme('auto', { persist: false })
        }
      } catch (error) {
        console.error('Failed to load theme preference:', error)
      }
    },
    { immediate: true }
  )

  async function setTheme(mode, options = {}) {
    const { persist = true, emailNotifications } = options
    const nextMode = VALID_THEMES.includes(mode) ? mode : 'light'

    if (themeMode.value !== nextMode) {
      themeMode.value = nextMode
    }

    writeStoredTheme(nextMode)

    const currentUser = user.value

    if (persist && currentUser) {
      try {
        await persistThemePreference(currentUser.id, nextMode, { emailNotifications })
      } catch (error) {
        console.error('Failed to persist theme preference:', error)
        throw error
      }
    }
  }

  return {
    themeMode: readonly(themeMode),
    resolvedTheme: readonly(resolvedTheme),
    isDark,
    naiveTheme,
    themeOverrides,
    setTheme,
    loadingPreferences: readonly(loadingPreferences),
    initialized: readonly(initialized)
  }
}


