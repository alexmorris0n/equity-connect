<template>
  <nav class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex">
          <div class="flex-shrink-0 flex items-center">
            <h1 class="text-xl font-bold text-gray-900">Equity Connect</h1>
          </div>
          <div class="hidden sm:ml-6 sm:flex sm:space-x-8">
            <router-link
              v-for="item in navigation"
              :key="item.name"
              :to="item.href"
              :class="[
                $route.path === item.href
                  ? 'border-primary-500 text-gray-900'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
              ]"
            >
              {{ item.name }}
            </router-link>
          </div>
        </div>
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <span class="text-sm text-gray-500">{{ brokerName }}</span>
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const brokerName = ref('Smith Real Estate')

const navigation = [
  { name: 'Dashboard', href: '/' },
  { name: 'Leads', href: '/leads' },
  { name: 'Analytics', href: '/analytics' },
  { name: 'Billing', href: '/billing' },
  { name: 'Settings', href: '/settings' },
]
</script>
