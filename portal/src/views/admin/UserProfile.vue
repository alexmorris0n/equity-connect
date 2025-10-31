<template>
  <div class="profile-container">
    <div class="profile-content">
      <n-card title="Account Information" class="profile-card">
        <div class="profile-section">
          <div class="profile-item">
            <label>Profile Avatar</label>
            <div class="avatar-section">
              <div class="current-avatar">
                <img v-if="profileData.avatarUrl" :src="profileData.avatarUrl" alt="Profile" class="avatar-preview" />
                <div v-else class="avatar-placeholder">{{ initials }}</div>
              </div>
              <div class="avatar-actions">
                <n-upload
                  :custom-request="handleAvatarUpload"
                  :show-file-list="false"
                  accept="image/*"
                >
                  <n-button size="small">Upload Photo</n-button>
                </n-upload>
                <n-button 
                  v-if="profileData.avatarUrl" 
                  size="small" 
                  @click="removeAvatar"
                >
                  Remove
                </n-button>
              </div>
            </div>
            <p class="help-text">Recommended: Square image, at least 200x200px</p>
          </div>

          <div class="profile-item">
            <label>Email Address</label>
            <n-input 
              v-model:value="profileData.email" 
              disabled
              placeholder="Your email address"
            />
            <p class="help-text">Email cannot be changed. Contact support if needed.</p>
          </div>

          <div class="profile-item">
            <label>Display Name</label>
            <n-input 
              v-model:value="profileData.displayName" 
              placeholder="Enter your display name"
              :loading="loading"
            />
          </div>

          <div class="profile-item">
            <label>User Role</label>
            <n-input 
              :value="userRole" 
              disabled
              placeholder="Your role"
            />
          </div>

          <div class="profile-item">
            <label>Account Created</label>
            <n-input 
              :value="formatDate(profileData.createdAt)" 
              disabled
              placeholder="Account creation date"
            />
          </div>
        </div>

        <template #footer>
          <div class="card-actions">
            <n-button 
              type="primary" 
              @click="updateProfile"
              :loading="saving"
              :disabled="!hasChanges"
            >
              Save Changes
            </n-button>
            <n-button @click="resetForm">
              Reset
            </n-button>
          </div>
        </template>
      </n-card>

      <n-card title="Security" class="profile-card">
        <div class="profile-section">
          <div class="profile-item">
            <label>Password</label>
            <div class="password-section">
              <n-button @click="showPasswordModal = true">
                Change Password
              </n-button>
            </div>
          </div>

          <div class="profile-item">
            <label>Two-Factor Authentication</label>
            <div class="security-section">
              <n-switch 
                v-model:value="profileData.twoFactorEnabled"
                :loading="loading"
                @update:value="updateTwoFactor"
              />
              <span class="security-label">
                {{ profileData.twoFactorEnabled ? 'Enabled' : 'Disabled' }}
              </span>
            </div>
          </div>
        </div>
      </n-card>

      <!-- Calendar Integration (Brokers Only) -->
      <n-card v-if="isBroker" title="Calendar Integration" class="profile-card" style="margin-top: 1rem;">
        <div class="calendar-status">
          <div class="status-info">
            <n-icon size="24" :color="broker?.nylas_grant_id ? '#10b981' : '#6b7280'">
              <CalendarOutline />
            </n-icon>
            <div>
              <div class="status-label">
                {{ broker?.nylas_grant_id ? 'Calendar Connected' : 'No Calendar Connected' }}
              </div>
              <div class="status-detail">
                {{ broker?.calendar_provider !== 'none' ? broker?.calendar_provider : 'Not configured' }}
                {{ broker?.calendar_synced_at ? `• Last synced ${formatCalendarDate(broker.calendar_synced_at)}` : '' }}
              </div>
            </div>
          </div>
          <div class="calendar-actions">
            <n-button 
              v-if="!broker?.nylas_grant_id" 
              type="primary" 
              @click="connectCalendar"
              :loading="connectingCalendar"
            >
              <template #icon>
                <n-icon><LinkOutline /></n-icon>
              </template>
              Connect Calendar
            </n-button>
            <n-button 
              v-else 
              type="warning" 
              @click="disconnectCalendar"
              :loading="disconnectingCalendar"
            >
              <template #icon>
                <n-icon><UnlinkOutline /></n-icon>
              </template>
              Disconnect Calendar
            </n-button>
            <n-button 
              v-if="broker?.nylas_grant_id" 
              @click="syncCalendar"
              :loading="syncingCalendar"
            >
              <template #icon>
                <n-icon><SyncOutline /></n-icon>
              </template>
              Sync Now
            </n-button>
          </div>
        </div>
        <p class="help-text" style="margin-top: 1rem;">
          Connect your Google or Outlook calendar to enable automatic appointment scheduling.
        </p>
      </n-card>

      <n-card title="Preferences" class="profile-card">
        <div class="profile-section">
          <div class="profile-item">
            <label>Email Notifications</label>
            <n-switch 
              v-model:value="profileData.emailNotifications"
              :loading="preferenceBusy"
              @update:value="handleEmailNotifications"
            />
          </div>

          <div class="profile-item">
            <label>Theme</label>
            <n-select 
              v-model:value="profileData.theme"
              :options="themeOptions"
              :loading="preferenceBusy"
              @update:value="handleThemeChange"
            />
          </div>
        </div>
      </n-card>
    </div>

    <!-- Password Change Modal -->
    <n-modal v-model:show="showPasswordModal">
      <n-card
        style="width: 400px"
        class="password-modal-card"
        title="Change Password"
        :bordered="false"
        size="huge"
        role="dialog"
        aria-modal="true"
      >
        <n-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules">
          <n-form-item label="Current Password" path="currentPassword">
            <n-input
              v-model:value="passwordForm.currentPassword"
              type="password"
              placeholder="Enter current password"
              show-password-on="click"
            />
          </n-form-item>
          <n-form-item label="New Password" path="newPassword">
            <n-input
              v-model:value="passwordForm.newPassword"
              type="password"
              placeholder="Enter new password"
              show-password-on="click"
            />
          </n-form-item>
          <n-form-item label="Confirm Password" path="confirmPassword">
            <n-input
              v-model:value="passwordForm.confirmPassword"
              type="password"
              placeholder="Confirm new password"
              show-password-on="click"
            />
          </n-form-item>
        </n-form>
        <template #footer>
          <div class="modal-actions">
            <n-button @click="showPasswordModal = false">
              Cancel
            </n-button>
            <n-button 
              type="primary" 
              @click="changePassword"
              :loading="changingPassword"
            >
              Change Password
            </n-button>
          </div>
        </template>
      </n-card>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useTheme } from '@/composables/useTheme'
import { supabase } from '@/lib/supabase'
import { 
  NButton, 
  NCard, 
  NInput, 
  NForm, 
  NFormItem, 
  NModal, 
  NSelect, 
  NSwitch,
  NUpload,
  NIcon,
  useMessage 
} from 'naive-ui'
import {
  CalendarOutline,
  LinkOutline,
  UnlinkOutline,
  SyncOutline
} from '@vicons/ionicons5'

const { user, broker, isAdmin, isBroker } = useAuth()
const { themeMode, setTheme, loadingPreferences: themeLoading } = useTheme()
const message = useMessage()

// Calendar integration states
const connectingCalendar = ref(false)
const disconnectingCalendar = ref(false)
const syncingCalendar = ref(false)

// Profile data
const profileData = reactive({
  email: '',
  displayName: '',
  avatarUrl: '',
  twoFactorEnabled: false,
  emailNotifications: true,
  theme: themeMode.value || 'light',
  createdAt: null
})

const originalData = ref({})
const loading = ref(false)
const saving = ref(false)
const showPasswordModal = ref(false)
const changingPassword = ref(false)
const preferenceBusy = computed(() => loading.value || themeLoading.value)

// Password form
const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const passwordFormRef = ref(null)

// Computed properties
const userRole = computed(() => {
  if (isAdmin.value) return 'Administrator'
  if (isBroker.value) return 'Broker'
  return 'User'
})

const hasChanges = computed(() => {
  return JSON.stringify(profileData) !== JSON.stringify(originalData.value)
})

const initials = computed(() => {
  if (profileData.displayName) {
    return profileData.displayName
      .split(' ')
      .map(part => part[0]?.toUpperCase())
      .slice(0, 2)
      .join('')
  }
  return 'U'
})

// Theme options
const THEME_VALUES = ['light', 'dark', 'auto']
const themeOptions = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'Auto', value: 'auto' }
]

// Password validation rules
const passwordRules = {
  currentPassword: [
    { required: true, message: 'Current password is required', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: 'New password is required', trigger: 'blur' },
    { min: 8, message: 'Password must be at least 8 characters', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: 'Please confirm your password', trigger: 'blur' },
    {
      validator: (rule, value) => {
        return value === passwordForm.newPassword
      },
      message: 'Passwords do not match',
      trigger: 'blur'
    }
  ]
}

async function loadPreferenceRecord() {
  if (!user.value) return

  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('theme, email_notifications')
      .eq('user_id', user.value.id)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (typeof data?.email_notifications === 'boolean') {
      profileData.emailNotifications = data.email_notifications
    }

    const fallbackTheme = THEME_VALUES.includes(profileData.theme)
      ? profileData.theme
      : (themeMode.value || 'light')

    const resolvedTheme = data?.theme && THEME_VALUES.includes(data.theme)
      ? data.theme
      : fallbackTheme

    profileData.theme = resolvedTheme

    await setTheme(resolvedTheme, {
      persist: false,
      emailNotifications: profileData.emailNotifications
    })
  } catch (error) {
    console.error('Error loading user preferences:', error)

    const fallbackTheme = THEME_VALUES.includes(profileData.theme)
      ? profileData.theme
      : (themeMode.value || 'light')

    profileData.theme = fallbackTheme

    await setTheme(fallbackTheme, {
      persist: false,
      emailNotifications: profileData.emailNotifications
    }).catch(() => {})
  }
}

// Load profile data
async function loadProfile() {
  loading.value = true
  try {
    if (user.value) {
      profileData.email = user.value.email || ''
      profileData.displayName = user.value.user_metadata?.display_name || 
                               broker.value?.contact_name || 
                               user.value.email?.split('@')[0] || ''
      profileData.createdAt = user.value.created_at
      
      // Load additional profile data from user_metadata
      const metadata = user.value.user_metadata || {}
      profileData.avatarUrl = metadata.avatar_url || ''
      profileData.twoFactorEnabled = metadata.two_factor_enabled || false
      profileData.emailNotifications = metadata.email_notifications !== false
      profileData.theme = metadata.theme && THEME_VALUES.includes(metadata.theme)
        ? metadata.theme
        : (themeMode.value || 'light')

      await loadPreferenceRecord()

      // Store original data for change detection
      originalData.value = JSON.parse(JSON.stringify(profileData))
    }
  } catch (error) {
    console.error('Error loading profile:', error)
    message.error('Failed to load profile data')
  } finally {
    loading.value = false
  }
}

// Update profile
async function updateProfile() {
  saving.value = true
  try {
    // Get current user metadata to merge with updates
    const currentMetadata = user.value?.user_metadata || {}
    
    const updates = {
      data: {
        ...currentMetadata,
        display_name: profileData.displayName,
        avatar_url: profileData.avatarUrl,
        two_factor_enabled: profileData.twoFactorEnabled,
        email_notifications: profileData.emailNotifications,
        theme: profileData.theme
      }
    }

    console.log('Updating user with:', updates)
    const { data, error } = await supabase.auth.updateUser(updates)
    
    if (error) {
      console.error('Update error:', error)
      throw error
    }
    
    console.log('Update response:', data)

    // Refresh the session to update user data in useAuth
    const { data: sessionData, error: refreshError } = await supabase.auth.refreshSession()
    
    if (refreshError) {
      console.error('Refresh error:', refreshError)
    } else {
      console.log('Session refreshed:', sessionData)
      // Force reload the user in useAuth
      if (sessionData?.session?.user) {
        user.value = sessionData.session.user
      }
    }
    
    message.success('Profile updated successfully')
    originalData.value = JSON.parse(JSON.stringify(profileData))
  } catch (error) {
    console.error('Error updating profile:', error)
    message.error('Failed to update profile: ' + error.message)
  } finally {
    saving.value = false
  }
}

async function handleEmailNotifications(value) {
  const previous = profileData.emailNotifications
  profileData.emailNotifications = value

  if (!user.value) {
    message.error('You must be signed in to update preferences')
    profileData.emailNotifications = previous
    return
  }

  try {
    const payload = {
      user_id: user.value.id,
      email_notifications: profileData.emailNotifications,
      theme: profileData.theme,
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('user_preferences')
      .upsert(payload, { onConflict: 'user_id' })

    if (error) {
      throw error
    }

    await supabase.auth.updateUser({
      data: {
        email_notifications: profileData.emailNotifications
      }
    })

    originalData.value = JSON.parse(JSON.stringify(profileData))
    message.success(`Email notifications ${profileData.emailNotifications ? 'enabled' : 'disabled'}`)
  } catch (error) {
    console.error('Error updating email notifications:', error)
    profileData.emailNotifications = previous
    message.error('Failed to update email notification preference')
  }
}

async function handleThemeChange(value) {
  if (!THEME_VALUES.includes(value)) {
    return
  }

  if (!user.value) {
    message.error('You must be signed in to change theme')
    profileData.theme = themeMode.value || 'light'
    return
  }

  const previousTheme = profileData.theme
  profileData.theme = value

  try {
    await setTheme(value, {
      emailNotifications: profileData.emailNotifications
    })

    await supabase.auth.updateUser({
      data: {
        theme: value,
        email_notifications: profileData.emailNotifications
      }
    })

    originalData.value = JSON.parse(JSON.stringify(profileData))

    const label = themeOptions.find(option => option.value === value)?.label || 'Theme'
    message.success(`${label} theme applied`)
  } catch (error) {
    console.error('Error updating theme preference:', error)
    profileData.theme = previousTheme

    await setTheme(previousTheme, {
      persist: false,
      emailNotifications: profileData.emailNotifications
    }).catch(() => {})

    message.error('Failed to update theme preference')
  }
}

// Update two-factor authentication
async function updateTwoFactor() {
  try {
    const updates = {
      user_metadata: {
        two_factor_enabled: profileData.twoFactorEnabled
      }
    }

    await supabase.auth.updateUser(updates)
    message.success('Two-factor authentication updated')
  } catch (error) {
    console.error('Error updating two-factor:', error)
    message.error('Failed to update two-factor authentication')
  }
}

// Change password
async function changePassword() {
  try {
    await passwordFormRef.value?.validate()
    
    changingPassword.value = true
    
    const { error } = await supabase.auth.updateUser({
      password: passwordForm.newPassword
    })
    
    if (error) {
      throw error
    }
    
    message.success('Password changed successfully')
    showPasswordModal.value = false
    
    // Reset form
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
  } catch (error) {
    console.error('Error changing password:', error)
    message.error('Failed to change password: ' + error.message)
  } finally {
    changingPassword.value = false
  }
}

// Reset form
function resetForm() {
  Object.assign(profileData, originalData.value)
}

// Handle avatar upload
async function handleAvatarUpload({ file }) {
  try {
    // Convert file to base64 data URL
    const reader = new FileReader()
    reader.onload = async (e) => {
      profileData.avatarUrl = e.target.result
      // Auto-save the avatar (will show success message)
      await updateProfile()
    }
    reader.readAsDataURL(file.file)
  } catch (error) {
    console.error('Error uploading avatar:', error)
    message.error('Failed to upload avatar')
  }
}

// Remove avatar
async function removeAvatar() {
  try {
    profileData.avatarUrl = ''
    await updateProfile()
    message.success('Avatar removed')
  } catch (error) {
    console.error('Error removing avatar:', error)
    message.error('Failed to remove avatar')
  }
}

// Calendar integration functions
async function connectCalendar() {
  connectingCalendar.value = true
  try {
    const NYLAS_CLIENT_ID = import.meta.env.VITE_NYLAS_CLIENT_ID
    const REDIRECT_URI = `${window.location.origin}/profile/calendar-callback`
    
    const authUrl = new URL('https://api.us.nylas.com/v3/connect/auth')
    authUrl.searchParams.append('client_id', NYLAS_CLIENT_ID)
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('scopes', 'calendar.read_only,calendar.read_write')
    authUrl.searchParams.append('state', broker.value?.id || user.value?.id)
    
    sessionStorage.setItem('nylas_user_email', profileData.email)
    
    window.location.href = authUrl.toString()
  } catch (error) {
    console.error('Error connecting calendar:', error)
    message.error('Failed to connect calendar')
    connectingCalendar.value = false
  }
}

async function disconnectCalendar() {
  disconnectingCalendar.value = true
  try {
    if (!broker.value?.id) {
      throw new Error('Broker ID not found')
    }
    
    const { error } = await supabase
      .from('brokers')
      .update({
        nylas_grant_id: null,
        calendar_provider: 'none',
        calendar_synced_at: null
      })
      .eq('id', broker.value.id)
    
    if (error) throw error
    
    message.success('Calendar disconnected successfully')
    // Refresh broker data
    window.location.reload()
  } catch (error) {
    console.error('Error disconnecting calendar:', error)
    message.error('Failed to disconnect calendar')
  } finally {
    disconnectingCalendar.value = false
  }
}

async function syncCalendar() {
  syncingCalendar.value = true
  try {
    if (!broker.value?.id) {
      throw new Error('Broker ID not found')
    }
    
    const { error } = await supabase
      .from('brokers')
      .update({ calendar_synced_at: new Date().toISOString() })
      .eq('id', broker.value.id)
    
    if (error) throw error
    
    message.success('Calendar synced successfully')
    window.location.reload()
  } catch (error) {
    console.error('Error syncing calendar:', error)
    message.error('Failed to sync calendar')
  } finally {
    syncingCalendar.value = false
  }
}

function formatCalendarDate(dateString) {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleDateString()
}

// Format date
function formatDate(dateString) {
  if (!dateString) return 'Unknown'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Load profile on mount
onMounted(() => {
  loadProfile()
})
</script>

<style scoped>
.profile-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.profile-header {
  margin-bottom: 2rem;
}

.profile-header h1 {
  font-size: 2rem;
  font-weight: 600;
  color: var(--text-inverse);
  margin-bottom: 0.5rem;
}

.profile-header p {
  color: rgba(255, 255, 255, 0.7);
  font-size: 1rem;
}

.profile-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Dark mode profile cards */
:root[data-theme='dark'] .profile-card {
  border-radius: 12px;
  background: rgba(17, 24, 39, 0.6) !important;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
}

:root[data-theme='dark'] .profile-card label {
  color: white !important;
}

:root[data-theme='dark'] .profile-card :deep(.n-card-header) {
  color: var(--text-inverse);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

:root[data-theme='dark'] .profile-card :deep(.n-card__content) {
  color: var(--text-inverse);
}

:root[data-theme='dark'] .profile-card :deep(.n-card__footer) {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

:root[data-theme='dark'] .profile-card :deep(.n-form-item-label__text),
:root[data-theme='dark'] .profile-card :deep(.n-input__input),
:root[data-theme='dark'] .profile-card :deep(.n-input__input-el),
:root[data-theme='dark'] .profile-card :deep(.n-base-selection-label),
:root[data-theme='dark'] .profile-card :deep(.n-base-selection-placeholder),
:root[data-theme='dark'] .profile-card :deep(.n-base-selection-input__content),
:root[data-theme='dark'] .profile-card :deep(input),
:root[data-theme='dark'] .profile-card :deep(label) {
  color: var(--text-inverse) !important;
}

:root[data-theme='dark'] .profile-card :deep(.n-input),
:root[data-theme='dark'] .profile-card :deep(.n-input__input-el),
:root[data-theme='dark'] .profile-card :deep(.n-base-selection),
:root[data-theme='dark'] .profile-card :deep(.n-base-selection-input) {
  background-color: rgba(0, 0, 0, 0.3) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
  color: white !important;
}

:root[data-theme='dark'] .profile-card :deep(.n-input--disabled) {
  background-color: rgba(0, 0, 0, 0.5) !important;
  opacity: 0.7;
}

:root[data-theme='dark'] .profile-card :deep(.n-input--disabled .n-input__input-el) {
  color: rgba(255, 255, 255, 0.6) !important;
  -webkit-text-fill-color: rgba(255, 255, 255, 0.6) !important;
}

:root[data-theme='dark'] .profile-card :deep(.n-input .n-input__input-el) {
  color: white !important;
  -webkit-text-fill-color: white !important;
}

:root[data-theme='dark'] .profile-card :deep(.n-base-selection .n-base-selection-label) {
  color: white !important;
}

:root[data-theme='dark'] .profile-card :deep(.n-base-selection-label__render-label) {
  color: white !important;
}

:root[data-theme='dark'] .profile-card :deep(.n-base-selection-input__content) {
  color: white !important;
}

/* Light mode profile cards - use default Naive UI styling */
:root[data-theme='light'] .profile-card {
  border-radius: 12px;
}

.profile-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

:root[data-theme='dark'] .profile-section label {
  color: white !important;
}

:root[data-theme='light'] .profile-section label {
  color: var(--text-color);
}

.profile-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

:root[data-theme='dark'] .profile-item label {
  font-weight: 500;
  color: white !important;
  font-size: 0.9rem;
}

:root[data-theme='light'] .profile-item label {
  font-weight: 500;
  color: var(--text-color);
  font-size: 0.9rem;
}

:root[data-theme='dark'] .help-text {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 0.25rem;
}

:root[data-theme='light'] .help-text {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

.password-section,
.security-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.security-label {
  font-size: 0.9rem;
  color: var(--text-inverse);
}

.avatar-section {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.current-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(99, 102, 241, 0.2);
  border: 2px solid rgba(99, 102, 241, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  font-size: 2rem;
  font-weight: 600;
  color: rgb(99, 102, 241);
}

.avatar-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.calendar-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.status-label {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-inverse);
}

.status-detail {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
  text-transform: capitalize;
}

.calendar-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.card-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.password-modal-card {
  background: rgba(17, 24, 39, 0.95) !important;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
}

.password-modal-card :deep(.n-card-header) {
  color: var(--text-inverse);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.password-modal-card :deep(.n-card__content) {
  color: var(--text-inverse);
}

.password-modal-card :deep(.n-form-item-label),
.password-modal-card :deep(.n-form-item-label__text),
.password-modal-card :deep(.n-input__input),
.password-modal-card :deep(.n-input__input-el),
.password-modal-card :deep(input),
.password-modal-card :deep(label) {
  color: var(--text-inverse) !important;
}

:root[data-theme='dark'] .password-modal-card :deep(.n-input),
:root[data-theme='dark'] .password-modal-card :deep(.n-input__input-el) {
  background-color: rgba(0, 0, 0, 0.3) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
  color: white !important;
}

:root[data-theme='dark'] .password-modal-card :deep(.n-input .n-input__input-el) {
  color: white !important;
  -webkit-text-fill-color: white !important;
}

/* Light mode - use default Naive UI styling for password modal */
:root[data-theme='light'] .password-modal-card :deep(.n-input),
:root[data-theme='light'] .password-modal-card :deep(.n-input__input-el) {
  color: var(--text-color);
}

@media (max-width: 768px) {
  .profile-container {
    padding: 1rem;
  }
  
  .card-actions,
  .modal-actions {
    flex-direction: column;
  }
}
</style>
