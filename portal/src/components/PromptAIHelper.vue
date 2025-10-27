<script setup>
import { ref, computed } from 'vue'
import { NCollapse, NCollapseItem, NInput, NButton, NIcon, NSpace, NTag } from 'naive-ui'
import { SparklesOutline, SendOutline, RefreshOutline } from '@vicons/ionicons5'

const props = defineProps({
  sectionKey: String,
  sectionLabel: String,
  currentContent: String
})

const emit = defineEmits(['apply-suggestion'])

const isOpen = ref(false)
const userMessage = ref('')
const chatHistory = ref([])
const isLoading = ref(false)

// Quick action suggestions based on section type
const quickActions = computed(() => {
  const actions = {
    role: [
      'Make tone warmer and friendlier',
      'Add clarity about Barbara\'s purpose',
      'Optimize for elderly callers'
    ],
    personality: [
      'Add more conversational fillers',
      'Improve interruption handling',
      'Make responses more concise'
    ],
    instructions: [
      'Add error handling',
      'Improve qualification logic',
      'Add compliance guardrails'
    ],
    conversation_flow: [
      'Expand greeting section',
      'Add transition between steps',
      'Improve booking flow'
    ],
    tools: [
      'Add tool usage examples',
      'Explain when to use each tool',
      'Add error handling for tools'
    ],
    context: [
      'List all available variables',
      'Add variable usage examples',
      'Explain missing variable handling'
    ]
  }
  
  return actions[props.sectionKey] || [
    'Improve clarity',
    'Make more concise',
    'Add examples'
  ]
})

async function sendMessage(message = userMessage.value) {
  if (!message.trim()) return
  
  isLoading.value = true
  
  // Add user message to chat
  chatHistory.value.push({
    role: 'user',
    content: message
  })
  
  try {
    // Call your AI API (OpenAI, Anthropic, etc.)
    const response = await callAIAPI({
      sectionKey: props.sectionKey,
      sectionLabel: props.sectionLabel,
      currentContent: props.currentContent,
      userRequest: message
    })
    
    // Add AI response to chat
    chatHistory.value.push({
      role: 'assistant',
      content: response.content,
      suggestion: response.suggestion // Updated content if AI rewrote it
    })
    
  } catch (error) {
    console.error('AI helper error:', error)
    chatHistory.value.push({
      role: 'error',
      content: 'Sorry, I encountered an error. Please try again.'
    })
  } finally {
    isLoading.value = false
    userMessage.value = ''
  }
}

async function callAIAPI({ sectionKey, sectionLabel, currentContent, userRequest }) {
  // TODO: Implement your AI API call
  // This could use OpenAI GPT-4, Anthropic Claude, or your own backend
  
  const systemPrompt = `You are an expert prompt engineer helping to write voice AI prompts for Barbara, a reverse mortgage lead assistant using OpenAI's Realtime API.

Current section: ${sectionLabel} (${sectionKey})
Current content:
${currentContent || '(empty)'}

User request: ${userRequest}

Provide helpful suggestions to improve this section. If the user asks you to rewrite it, provide the complete updated content.`

  // Example OpenAI call:
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userRequest }
      ],
      temperature: 0.7
    })
  })
  
  const data = await response.json()
  
  return {
    content: data.choices[0].message.content,
    suggestion: null // Or parse if AI provided a rewrite
  }
}

function applySuggestion(suggestion) {
  emit('apply-suggestion', suggestion)
  isOpen.value = false
}

function clearChat() {
  chatHistory.value = []
  userMessage.value = ''
}
</script>

<template>
  <div class="ai-helper">
    <n-button
      text
      circle
      size="tiny"
      class="ai-trigger"
      @click="isOpen = !isOpen"
      :type="isOpen ? 'primary' : 'default'"
    >
      <template #icon>
        <n-icon size="16">
          <SparklesOutline />
        </n-icon>
      </template>
    </n-button>
    
    <div v-if="isOpen" class="ai-panel">
      <div class="ai-header">
        <n-icon size="18" color="#6366f1">
          <SparklesOutline />
        </n-icon>
        <span class="ai-title">AI Assistant for {{ sectionLabel }}</span>
        <n-button text size="tiny" @click="clearChat">
          <template #icon>
            <n-icon><RefreshOutline /></n-icon>
          </template>
        </n-button>
      </div>
      
      <div class="quick-actions">
        <span class="quick-label">Quick actions:</span>
        <n-space>
          <n-tag
            v-for="action in quickActions"
            :key="action"
            size="small"
            :bordered="false"
            style="cursor: pointer;"
            @click="sendMessage(action)"
          >
            {{ action }}
          </n-tag>
        </n-space>
      </div>
      
      <div v-if="chatHistory.length > 0" class="chat-history">
        <div
          v-for="(msg, idx) in chatHistory"
          :key="idx"
          :class="['chat-message', msg.role]"
        >
          <div class="message-content">{{ msg.content }}</div>
          <n-button
            v-if="msg.suggestion"
            size="small"
            type="primary"
            @click="applySuggestion(msg.suggestion)"
          >
            Apply Suggestion
          </n-button>
        </div>
      </div>
      
      <div class="ai-input">
        <n-input
          v-model:value="userMessage"
          type="textarea"
          placeholder="Describe what you want..."
          :autosize="{ minRows: 2, maxRows: 4 }"
          @keydown.enter.meta="sendMessage()"
          @keydown.enter.ctrl="sendMessage()"
        />
        <n-button
          type="primary"
          :loading="isLoading"
          :disabled="!userMessage.trim()"
          @click="sendMessage()"
        >
          <template #icon>
            <n-icon><SendOutline /></n-icon>
          </template>
          Send
        </n-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-helper {
  position: relative;
}

.ai-trigger {
  color: #6366f1;
}

.ai-trigger:hover {
  color: #4f46e5;
}

.ai-panel {
  position: absolute;
  top: 30px;
  right: 0;
  width: 400px;
  max-height: 500px;
  background: white;
  border: 1px solid rgba(148, 163, 184, 0.32);
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(79, 70, 229, 0.15);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ai-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05));
}

.ai-title {
  flex: 1;
  font-weight: 600;
  font-size: 0.9rem;
  color: #1f2937;
}

.quick-actions {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(248, 250, 255, 0.5);
}

.quick-label {
  display: block;
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.chat-history {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  max-height: 300px;
}

.chat-message {
  margin-bottom: 1rem;
  padding: 0.75rem;
  border-radius: 8px;
}

.chat-message.user {
  background: rgba(99, 102, 241, 0.08);
  margin-left: 2rem;
}

.chat-message.assistant {
  background: rgba(248, 250, 255, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.18);
  margin-right: 2rem;
}

.chat-message.error {
  background: rgba(239, 68, 68, 0.08);
  color: #dc2626;
}

.message-content {
  font-size: 0.85rem;
  line-height: 1.5;
  white-space: pre-wrap;
  margin-bottom: 0.5rem;
}

.ai-input {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  background: white;
}
</style>

