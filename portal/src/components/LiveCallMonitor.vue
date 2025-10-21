<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">Live Call Monitor</h2>
        <p class="text-muted-foreground">Real-time call intelligence</p>
      </div>
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <div class="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
          <span class="text-sm text-muted-foreground">{{ activeCalls.length }} active calls</span>
        </div>
        <Button @click="refreshCalls" variant="outline" size="sm">
          <RefreshCw :class="{ 'animate-spin': loading }" class="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    </div>

    <!-- Active Calls List -->
    <div v-if="activeCalls.length === 0" class="text-center py-12">
      <Phone class="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <p class="text-muted-foreground">No active calls</p>
      <p class="text-sm text-muted-foreground mt-1">Calls will appear here when Barbara is talking to leads</p>
    </div>

    <div v-else class="grid gap-4">
      <Card v-for="call in activeCalls" :key="call.call_id">
        <CardHeader class="pb-3">
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                <div class="h-3 w-3 rounded-full bg-red-500 animate-pulse"></div>
              </div>
              <div>
                <CardTitle class="text-lg">{{ call.lead_name }}</CardTitle>
                <div class="flex items-center gap-2 mt-1">
                  <span class="text-sm text-muted-foreground">{{ formatDuration(call.duration) }}</span>
                  <span class="text-muted-foreground">•</span>
                  <span class="text-sm text-muted-foreground">{{ call.broker_name }}</span>
                </div>
              </div>
            </div>
            <Badge :variant="getPhaseVariant(call.phase)">
              {{ call.phase_display }}
            </Badge>
          </div>
        </CardHeader>

        <CardContent class="space-y-4">
          <!-- Sentiment & Interest -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="text-sm font-medium mb-2 flex items-center gap-2">
                <span>Sentiment</span>
                <span class="text-2xl">{{ call.sentiment_emoji }}</span>
              </div>
              <p class="text-sm text-muted-foreground capitalize">{{ call.sentiment }}</p>
            </div>
            <div>
              <div class="text-sm font-medium mb-2">Interest Level</div>
              <div class="flex items-center gap-2">
                <div class="text-sm font-mono">{{ call.interest_bar }}</div>
                <span class="text-sm text-muted-foreground">{{ call.interest_level }}%</span>
              </div>
            </div>
          </div>

          <!-- Key Topics -->
          <div v-if="call.key_topics.length > 0">
            <div class="text-sm font-medium mb-2">Key Topics</div>
            <div class="flex flex-wrap gap-2">
              <Badge v-for="topic in call.key_topics" :key="topic" variant="secondary">
                {{ topic }}
              </Badge>
            </div>
          </div>

          <!-- Buying Signals -->
          <div v-if="call.buying_signals.length > 0" class="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 p-3">
            <div class="flex items-center gap-2 mb-2">
              <TrendingUp class="h-4 w-4 text-green-600 dark:text-green-400" />
              <span class="text-sm font-medium text-green-900 dark:text-green-100">Buying Signal Detected</span>
            </div>
            <div class="flex flex-wrap gap-2 mb-2">
              <Badge v-for="signal in call.buying_signals" :key="signal" variant="outline" class="text-green-700 dark:text-green-300">
                {{ signal }}
              </Badge>
            </div>
            <p v-if="call.latest_signal" class="text-sm text-green-700 dark:text-green-300 italic">
              "{{ call.latest_signal }}"
            </p>
          </div>

          <!-- Objections -->
          <div v-if="call.objections.length > 0" class="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 p-3">
            <div class="flex items-center gap-2 mb-2">
              <AlertCircle class="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <span class="text-sm font-medium text-yellow-900 dark:text-yellow-100">Objections</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <Badge v-for="objection in call.objections" :key="objection" variant="outline" class="text-yellow-700 dark:text-yellow-300">
                {{ objection.replace('_', ' ') }}
              </Badge>
            </div>
          </div>

          <!-- Talk Time Ratio -->
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <User class="h-4 w-4" />
            <span>Lead {{ call.talk_ratio.user }}%</span>
            <span>•</span>
            <Bot class="h-4 w-4" />
            <span>Barbara {{ call.talk_ratio.assistant }}%</span>
            <span>•</span>
            <span>{{ call.utterance_count }} exchanges</span>
          </div>

          <!-- Appointment Status -->
          <div v-if="call.appointment_scheduled" class="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-3">
            <div class="flex items-center gap-2">
              <Calendar class="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span class="text-sm font-medium text-blue-900 dark:text-blue-100">Appointment Scheduled</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, RefreshCw, TrendingUp, AlertCircle, User, Bot, Calendar } from 'lucide-vue-next';

const activeCalls = ref([]);
const loading = ref(false);
let pollInterval = null;

const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL || 'http://localhost:3001';

async function refreshCalls() {
  loading.value = true;
  try {
    const response = await fetch(`${BRIDGE_URL}/api/active-calls`);
    const data = await response.json();
    
    if (data.success) {
      activeCalls.value = data.calls;
    }
  } catch (error) {
    console.error('Error fetching active calls:', error);
  } finally {
    loading.value = false;
  }
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getPhaseVariant(phase) {
  const variants = {
    'greeting': 'default',
    'qualifying': 'secondary',
    'presenting': 'outline',
    'objection_handling': 'destructive',
    'booking': 'default',
    'closing': 'default'
  };
  return variants[phase] || 'default';
}

onMounted(() => {
  // Initial load
  refreshCalls();
  
  // Poll every 5 seconds
  pollInterval = setInterval(refreshCalls, 5000);
});

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval);
  }
});
</script>

