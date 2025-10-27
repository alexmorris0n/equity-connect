<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-global-style />
    <n-message-provider>
      <router-view />
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { NConfigProvider, NGlobalStyle, NMessageProvider } from 'naive-ui'

const themeOverrides = {
  common: {
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
</script>

