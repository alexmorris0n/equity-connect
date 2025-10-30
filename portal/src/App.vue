<template>
  <n-config-provider :theme="naiveTheme" :theme-overrides="themeOverrides">
    <n-global-style />
    <n-message-provider>
      <router-view />
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { NConfigProvider, NGlobalStyle, NMessageProvider } from 'naive-ui'
import { useTheme } from '@/composables/useTheme'

const { naiveTheme, themeOverrides } = useTheme()
</script>

