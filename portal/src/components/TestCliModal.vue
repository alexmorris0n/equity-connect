<template>
  <n-modal
    v-model:show="localShow"
    preset="card"
    title="Test Prompt Node"
    :style="{ width: '900px', maxWidth: '95vw' }"
    :mask-closable="!loading"
  >
    <div class="test-cli-modal">
      <!-- Test Configuration -->
      <n-card 
        size="small" 
        title="Test Configuration" 
        :bordered="false"
        style="margin-bottom: 1rem;"
      >
        <n-descriptions bordered :column="2" size="small">
          <n-descriptions-item label="Vertical">
            <n-tag type="primary">{{ vertical }}</n-tag>
          </n-descriptions-item>
          <n-descriptions-item label="Node">
            <n-tag type="info">{{ nodeName }}</n-tag>
          </n-descriptions-item>
          <n-descriptions-item label="Version">
            <n-tag>{{ versionLabel }}</n-tag>
          </n-descriptions-item>
          <n-descriptions-item label="Status">
            <n-tag v-if="!result && !error" type="default">Ready</n-tag>
            <n-tag v-else-if="loading" type="warning">Running...</n-tag>
            <n-tag v-else-if="result?.success" type="success">✓ Passed</n-tag>
            <n-tag v-else type="error">✗ Failed</n-tag>
          </n-descriptions-item>
        </n-descriptions>
      </n-card>

      <!-- Action Buttons -->
      <n-space style="margin-bottom: 1rem;">
        <n-button
          type="primary"
          size="large"
          :loading="loading"
          :disabled="loading"
          @click="runTest"
        >
          <template #icon>
            <n-icon><Flask /></n-icon>
          </template>
          {{ loading ? 'Running Test...' : 'Run Test' }}
        </n-button>
        
        <n-button
          :disabled="!parsedSwml"
          @click="copySwml"
        >
          <template #icon>
            <n-icon><CopyOutline /></n-icon>
          </template>
          Copy SWML
        </n-button>

        <n-button
          v-if="result"
          secondary
          @click="clearResults"
        >
          Clear Results
        </n-button>
      </n-space>

      <!-- Loading State -->
      <n-alert 
        v-if="loading" 
        type="info" 
        title="Executing Test..."
        style="margin-bottom: 1rem;"
      >
        <div>Running swaig-test CLI command. This may take 10-45 seconds...</div>
        <n-progress 
          v-if="loadingProgress > 0"
          type="line" 
          :percentage="loadingProgress" 
          :show-indicator="false"
          style="margin-top: 0.5rem;"
        />
        <div v-if="loadingProgress > 0" style="font-size: 0.75rem; margin-top: 0.25rem; opacity: 0.7;">
          {{ Math.round(loadingProgress) }}% • Elapsed: {{ elapsedSeconds }}s
        </div>
      </n-alert>

      <!-- Error State -->
      <n-alert 
        v-if="error" 
        type="error" 
        title="Test Failed" 
        closable
        @close="error = ''"
        style="margin-bottom: 1rem;"
      >
        {{ error }}
      </n-alert>

      <!-- Success/Results -->
      <div v-if="result" class="test-results">
        <n-card 
          size="small"
          :bordered="false"
          style="margin-bottom: 1rem;"
        >
          <template #header>
            <n-space align="center">
              <span>{{ result.success ? 'Test Results ✓' : 'Test Results (with errors)' }}</span>
              <n-tag 
                size="small" 
                :type="result.success ? 'success' : 'error'"
              >
                Exit Code: {{ result.exitCode }}
              </n-tag>
              <n-tag size="small" type="default">
                Duration: {{ (result.duration / 1000).toFixed(1) }}s
              </n-tag>
            </n-space>
          </template>

          <n-tabs type="line" animated>
            <!-- SWML Output Tab -->
            <n-tab-pane name="swml" tab="SWML Output">
              <div v-if="parsedSwml">
                <n-alert 
                  type="success" 
                  title="Valid SWML Generated"
                  style="margin-bottom: 1rem;"
                  :bordered="false"
                >
                  The agent successfully generated valid SWML configuration.
                  You can copy this for inspection or debugging.
                </n-alert>
                
                <n-code 
                  :code="formatJson(parsedSwml)" 
                  language="json" 
                  :word-wrap="true"
                  show-line-numbers
                  style="max-height: 500px; overflow-y: auto;"
                />
              </div>
              <n-alert 
                v-else 
                type="warning"
                title="No SWML Output"
                :bordered="false"
              >
                The test did not produce valid SWML output. 
                Check the Raw Output and Debug Logs tabs for details.
              </n-alert>
            </n-tab-pane>

            <!-- Raw Output Tab -->
            <n-tab-pane name="raw" tab="Raw Output">
              <n-code 
                :code="result.output || '(no output)'" 
                language="shell"
                :word-wrap="true"
                style="max-height: 500px; overflow-y: auto;"
              />
            </n-tab-pane>

            <!-- Debug Logs Tab -->
            <n-tab-pane name="logs" tab="Debug Logs">
              <div v-if="result.stderr">
                <n-alert 
                  type="info"
                  title="Verbose Logs"
                  style="margin-bottom: 1rem;"
                  :bordered="false"
                >
                  Debug logs from swaig-test showing agent initialization, 
                  tool loading, and SWML generation process.
                </n-alert>
                <n-code 
                  :code="result.stderr" 
                  language="shell"
                  :word-wrap="true"
                  style="max-height: 500px; overflow-y: auto;"
                />
              </div>
              <n-alert 
                v-else 
                type="default" 
                :bordered="false"
              >
                No debug logs captured.
              </n-alert>
            </n-tab-pane>
          </n-tabs>
        </n-card>
      </div>
    </div>

    <!-- Footer -->
    <template #footer>
      <n-space justify="end">
        <n-button 
          @click="handleClose"
          :disabled="loading"
        >
          {{ loading ? 'Test Running...' : 'Close' }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useMessage } from 'naive-ui';
import {
  NModal,
  NCard,
  NAlert,
  NButton,
  NSpace,
  NDescriptions,
  NDescriptionsItem,
  NTag,
  NTabs,
  NTabPane,
  NCode,
  NIcon,
  NProgress
} from 'naive-ui';
import { Flask, CopyOutline } from '@vicons/ionicons5';

// Props
const props = defineProps<{
  show: boolean;
  vertical: string;
  nodeName: string;
  versionId: string;
  versionLabel: string;
}>();

// Emits
const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
}>();

// Composables
const message = useMessage();

// Local state
const localShow = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
});

const loading = ref(false);
const error = ref('');
const result = ref<any>(null);
const parsedSwml = ref<any>(null);
const loadingProgress = ref(0);
const elapsedSeconds = ref(0);

let progressInterval: number | null = null;
let elapsedInterval: number | null = null;

/**
 * Run CLI test
 */
async function runTest() {
  loading.value = true;
  error.value = '';
  result.value = null;
  parsedSwml.value = null;
  loadingProgress.value = 0;
  elapsedSeconds.value = 0;

  // Start progress simulation (0-90% over 45 seconds)
  progressInterval = window.setInterval(() => {
    if (loadingProgress.value < 90) {
      loadingProgress.value += 2; // 2% every second
    }
  }, 1000);

  // Start elapsed timer
  elapsedInterval = window.setInterval(() => {
    elapsedSeconds.value += 1;
  }, 1000);

  // Use environment variable with fallback for local development
  // Use CLI testing service URL (separate from deprecated bridge)
  const CLI_TESTING_URL = import.meta.env.VITE_CLI_TESTING_URL || 'http://localhost:8080';
  
  try {
    const response = await fetch(`${CLI_TESTING_URL}/api/test-cli`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        versionId: props.versionId,
        vertical: props.vertical,
        nodeName: props.nodeName
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    result.value = data;

    // Complete progress bar
    loadingProgress.value = 100;

    // Try to extract SWML from output
    if (data.output) {
      try {
        // Look for JSON object with "version" key (SWML signature)
        const jsonMatch = data.output.match(/\{[\s\S]*?"version"[\s\S]*?\}/);
        if (jsonMatch) {
          parsedSwml.value = JSON.parse(jsonMatch[0]);
          console.log('[TestCliModal] Parsed SWML successfully');
        }
      } catch (parseErr) {
        console.warn('[TestCliModal] Could not parse SWML from output:', parseErr);
      }
    }

    // Show result message
    if (data.success) {
      message.success('Test completed successfully');
    } else {
      message.warning('Test completed with errors');
      error.value = data.error || 'Test failed - check debug logs for details';
    }

  } catch (err) {
    console.error('[TestCliModal] Test execution error:', err);
    error.value = err instanceof Error ? err.message : 'Unknown error occurred';
    message.error('Failed to execute test');
    loadingProgress.value = 0;
  } finally {
    loading.value = false;
    stopProgressTimers();
  }
}

/**
 * Stop progress timers
 */
function stopProgressTimers() {
  if (progressInterval !== null) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
  if (elapsedInterval !== null) {
    clearInterval(elapsedInterval);
    elapsedInterval = null;
  }
}

/**
 * Format JSON with indentation
 */
function formatJson(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

/**
 * Copy SWML to clipboard
 */
async function copySwml() {
  if (!parsedSwml.value) {
    message.warning('No SWML to copy');
    return;
  }

  try {
    await navigator.clipboard.writeText(formatJson(parsedSwml.value));
    message.success('SWML copied to clipboard');
  } catch (err) {
    console.error('[TestCliModal] Copy failed:', err);
    message.error('Failed to copy to clipboard');
  }
}

/**
 * Clear results
 */
function clearResults() {
  result.value = null;
  error.value = '';
  parsedSwml.value = null;
  loadingProgress.value = 0;
  elapsedSeconds.value = 0;
}

/**
 * Handle modal close
 */
function handleClose() {
  if (loading.value) {
    message.warning('Please wait for test to complete');
    return;
  }
  
  localShow.value = false;
  
  // Clear results after animation
  setTimeout(() => {
    clearResults();
  }, 300);
}

// Watch for modal close to cleanup
watch(() => props.show, (newShow) => {
  if (!newShow) {
    stopProgressTimers();
  }
});
</script>

<style scoped>
.test-cli-modal {
  min-height: 300px;
}

.test-results {
  max-height: 600px;
  overflow-y: auto;
}
</style>

