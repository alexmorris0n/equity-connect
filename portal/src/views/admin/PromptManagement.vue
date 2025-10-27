<template>
  <div class="prompt-workspace">
    <section class="meta-card">
      <header class="meta-header">
        <div class="meta-title-wrap">
          <n-icon size="20" class="meta-icon"><FolderOutline /></n-icon>
          <span class="meta-title">Prompts</span>
        </div>
      </header>
      <div class="meta-list-wrapper">
        <div class="meta-list">
          <button
            v-for="prompt in prompts"
            :key="prompt.id"
            class="meta-item"
            :class="{ active: prompt.id === activePromptId }"
            type="button"
            @click="selectPrompt(prompt.id)"
          >
            <span class="meta-item-title">{{ prompt.name }}</span>
            <span v-if="prompt.call_type" class="meta-badge" :title="getCallTypeLabel(prompt.call_type)">
              <n-icon size="12" style="vertical-align: middle; margin-right: 2px;">
                <component :is="getCallTypeIcon(prompt.call_type)" />
              </n-icon>
              {{ getCallTypeShort(prompt.call_type) }}
            </span>
          </button>
        </div>
      </div>
    </section>

    <section class="meta-card">
      <header class="meta-header">
        <div class="meta-title-wrap">
          <n-icon size="20" class="meta-icon"><CubeOutline /></n-icon>
          <span class="meta-title">Versions</span>
        </div>
      </header>
      <div class="meta-list-wrapper">
        <div class="meta-list">
          <button
            v-for="version in versions"
            :key="version.id"
            class="meta-item version"
            :class="{ active: currentVersion?.id === version.id }"
            type="button"
            @click="loadVersion(version.id)"
          >
            <div class="version-row">
              <span class="meta-item-title">v{{ version.version_number }}</span>
              <span class="meta-date">{{ formatDate(version.created_at) }}</span>
              <span class="meta-status" v-if="version.is_active">Active</span>
              <span class="meta-status draft" v-else-if="version.is_draft">Draft</span>
            </div>
            <span
              class="meta-item-sub"
              v-if="version.change_summary"
              :title="version.change_summary"
            >
              {{ version.change_summary }}
            </span>
          </button>
        </div>
      </div>
    </section>

    <div class="editor-pane">
      <n-card class="editor-card" :bordered="false">
        <div class="editor-toolbar compact-toolbar">
          <n-button size="small" tertiary round :disabled="loading || !currentVersion?.id" @click="openPreviewModal">
            <template #icon>
              <n-icon><EyeOutline /></n-icon>
            </template>
            Preview
          </n-button>
          <n-button size="small" type="primary" round :disabled="loading || !hasChanges" @click="saveChanges">
            <template #icon>
              <n-icon><SaveOutline /></n-icon>
            </template>
            Save
          </n-button>
          <n-button size="small" round type="info" :disabled="loading || !currentVersion?.id || currentVersion?.is_active" @click="openDeployModal">
            <template #icon>
              <n-icon><RocketOutline /></n-icon>
            </template>
            {{ isOlderVersion ? 'Rollback' : 'Deploy' }}
          </n-button>
          <n-button size="small" round :disabled="loading || !currentVersion?.id" @click="openAuditModal" style="background: rgba(139, 92, 246, 0.1); color: #8b5cf6; border: 1px solid rgba(139, 92, 246, 0.3);" class="ai-audit-btn">
            <template #icon>
              <n-icon style="color: #f59e0b !important;"><SparklesOutline /></n-icon>
            </template>
            AI Audit
          </n-button>
        </div>

        <n-tabs type="line" size="small" v-model:value="activeTab">
          <n-tab-pane name="performance" tab="Performance">
            <div v-if="evaluationData && evaluationData.count > 0" class="performance-container">
              <!-- Summary Stats Grid -->
              <n-grid :cols="4" :x-gap="12" :y-gap="12" style="margin-bottom: 24px;">
                <n-grid-item>
                  <n-statistic label="Total Calls" :value="evaluationData.count" />
                </n-grid-item>
                <n-grid-item>
                  <n-statistic label="Overall Score" :value="evaluationData.avgOverallScore">
                    <template #suffix>/10</template>
                  </n-statistic>
                </n-grid-item>
                <n-grid-item>
                  <n-statistic label="Best Call" :value="evaluationData.bestScore">
                    <template #suffix>/10</template>
                  </n-statistic>
                </n-grid-item>
                <n-grid-item>
                  <n-statistic label="Last Evaluated" :value="formatRelativeTime(evaluationData.lastEvaluated)" />
                </n-grid-item>
              </n-grid>

              <!-- 6 Metric Scores -->
              <n-card title="Performance Metrics" :bordered="false" style="margin-bottom: 24px;">
                <n-grid :cols="3" :x-gap="12" :y-gap="16">
                  <n-grid-item v-for="metric in evaluationMetrics" :key="metric.key">
                    <div class="metric-card">
                      <div class="metric-label">{{ metric.label }}</div>
                      <div class="metric-score" :class="getScoreClass(metric.value)">
                        {{ metric.value.toFixed(1) }}/10
                      </div>
                      <n-progress 
                        type="line" 
                        :percentage="(metric.value / 10) * 100" 
                        :show-indicator="false"
                        :color="getScoreColor(metric.value)"
                        :height="6"
                      />
                    </div>
                  </n-grid-item>
                </n-grid>
              </n-card>

              <!-- AI Analysis Section -->
              <n-card title="AI Analysis" :bordered="false" style="margin-bottom: 24px;">
                <n-collapse>
                  <n-collapse-item title="Strengths" name="strengths">
                    <n-list bordered>
                      <n-list-item v-for="(strength, idx) in evaluationData.commonStrengths" :key="idx">
                        <template #prefix>
                          <n-icon color="#10b981"><CheckmarkCircleOutline /></n-icon>
                        </template>
                        {{ strength }}
                      </n-list-item>
                    </n-list>
                  </n-collapse-item>
                  
                  <n-collapse-item title="Weaknesses" name="weaknesses">
                    <n-list bordered>
                      <n-list-item v-for="(weakness, idx) in evaluationData.commonWeaknesses" :key="idx">
                        <template #prefix>
                          <n-icon color="#f59e0b"><WarningOutline /></n-icon>
                        </template>
                        {{ weakness }}
                      </n-list-item>
                    </n-list>
                  </n-collapse-item>
                  
                  <n-collapse-item title="Red Flags" name="red-flags" v-if="evaluationData.redFlags.length > 0">
                    <n-list bordered>
                      <n-list-item v-for="(flag, idx) in evaluationData.redFlags" :key="idx">
                        <template #prefix>
                          <n-icon color="#ef4444"><CloseCircleOutline /></n-icon>
                        </template>
                        {{ flag }}
                      </n-list-item>
                    </n-list>
                  </n-collapse-item>
                </n-collapse>
              </n-card>

              <!-- AI Improvement Suggestions -->
              <n-card :bordered="false" style="background: rgba(139, 92, 246, 0.05); border: 1px solid rgba(139, 92, 246, 0.2);">
                <template #header>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <n-icon size="20" color="#8b5cf6"><SparklesOutline /></n-icon>
                    <span>AI Improvement Suggestions</span>
                  </div>
                </template>
                <n-list>
                  <n-list-item v-for="(suggestion, idx) in aiSuggestions" :key="idx">
                    <template #prefix>
                      <n-badge :value="suggestion.priority" :type="getPriorityType(suggestion.priority)" />
                    </template>
                    <div>
                      <div style="font-weight: 500; margin-bottom: 4px;">{{ suggestion.title }}</div>
                      <div style="font-size: 0.9em; color: #6b7280;">{{ suggestion.description }}</div>
                    </div>
                    <template #suffix>
                      <n-button size="small" tertiary @click="applySuggestion(suggestion)">
                        Apply
                      </n-button>
                    </template>
                  </n-list-item>
                </n-list>
              </n-card>
            </div>
            
            <!-- Empty State -->
            <div v-else class="evaluation-empty-state">
              <n-empty size="large">
                <template #icon>
                  <div class="empty-icon-wrapper">
                    <n-icon size="64" :depth="3" color="#9ca3af">
                      <BarChartOutline />
                    </n-icon>
                  </div>
                </template>
                <template #default>
                  <div class="empty-content">
                    <h3>No Evaluation Data Yet</h3>
                    <p>Make test calls to see performance metrics and AI-generated insights.</p>
                  </div>
                </template>
                <template #extra>
                  <n-button type="primary" size="small" round @click="activeTab = 'editor'">
                    <template #icon>
                      <n-icon><SparklesOutline /></n-icon>
                    </template>
                    Edit Prompt
                  </n-button>
                </template>
              </n-empty>
            </div>
          </n-tab-pane>

          <n-tab-pane name="editor" tab="Editor">
            <div v-if="currentVersion" class="editor-sections">
              <n-collapse display-directive="show" accordion v-model:expanded-names="expandedSections">
                <n-collapse-item
                  v-for="section in promptSections"
                  :key="section.key"
                  :name="section.key"
                  :title="section.label"
                  :disabled="loading"
                >
                  <template #header>
                    <div class="section-header">
                      <span>{{ section.label }}</span>
                      <span v-if="section.required" class="required">*</span>
                      <n-tooltip v-if="section.tooltip" :placement="'top-start'">
                        <template #trigger>
                          <n-icon size="14" class="info-icon"><InformationCircleOutline /></n-icon>
                        </template>
                        {{ section.tooltip }}
                      </n-tooltip>
                      <n-dropdown 
                        v-if="expandedSections.includes(section.key)" 
                        :options="section.key === 'tools' ? toolsDropdownOptions : variableDropdownOptions" 
                        @select="(key) => section.key === 'tools' ? insertToolFromDropdown(key) : insertVariableIntoSection(section.key, key)" 
                        trigger="click" 
                        placement="bottom-start"
                      >
                        <n-button text circle size="tiny" class="variable-trigger" @click.stop>
                          <template #icon>
                            <n-icon size="14">
                              <ConstructOutline v-if="section.key === 'tools'" />
                              <FlashOutline v-else />
                            </n-icon>
                          </template>
                        </n-button>
                      </n-dropdown>
                      <n-button v-if="expandedSections.includes(section.key)" text circle size="tiny" class="ai-improve-trigger" @click.stop="openAIImprove(section)">
                        <template #icon>
                          <n-icon size="16">
                            <SparklesOutline />
                          </n-icon>
                        </template>
                      </n-button>
                    </div>
                  </template>

                  <div
                    :ref="el => { if (el) textareaRefs[section.key] = el }"
                    class="notion-textarea"
                    :data-placeholder="section.placeholder"
                    contenteditable="true"
                    @input="handleContentEditableInput($event, section.key)"
                    @keyup="handleContentEditableInput($event, section.key)"
                    @blur="handleContentEditableBlur($event, section.key)"
                    @keydown="handleContentEditableKeydown($event, section.key)"
                  ></div>
                </n-collapse-item>
              </n-collapse>
            </div>
            <n-empty v-else description="Select a version or create a new one." class="empty-state" />
          </n-tab-pane>

          <n-tab-pane name="settings" tab="Settings">
            <div class="tab-content">
              <div class="settings-section">
                <h3>Voice Settings</h3>
                <p class="text-muted">Configure the AI voice and behavior for this prompt:</p>
                
                <div style="margin-top: 1.5rem;">
                  <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Voice:</label>
                  <n-select
                    v-model:value="selectedVoice"
                    :options="voiceOptions"
                    size="large"
                    placeholder="Select a voice"
                    @update:value="handleVoiceChange"
                  />
                  <p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: #9ca3af;">
                    AI voice for this prompt (default: shimmer)
                  </p>
                </div>

                <!-- Advanced Settings Toggle -->
                <n-button
                  @click="showAdvancedSettings = !showAdvancedSettings"
                  secondary
                  style="margin-top: 1.5rem;"
                >
                  {{ showAdvancedSettings ? 'Hide' : 'Show' }} Advanced Settings
                </n-button>

                <!-- Advanced Settings Section -->
                <div v-if="showAdvancedSettings" style="margin-top: 1rem; padding: 1rem; background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb; font-size: 0.9rem;">
                  <n-alert type="warning" style="margin-bottom: 1rem; font-size: 0.85rem;">
                    <template #icon>
                      <n-icon size="16"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M85.57 446.25h340.86a32 32 0 0028.17-47.17L284.18 82.58c-12.09-22.44-44.27-22.44-56.36 0L57.4 399.08a32 32 0 0028.17 47.17z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/><path d="M250.26 195.39l5.74 122 5.73-121.95a5.74 5.74 0 00-5.79-6h0a5.74 5.74 0 00-5.68 5.95z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/><path d="M256 397.25a20 20 0 1120-20 20 20 0 01-20 20z"/></svg></n-icon>
                    </template>
                    <strong>Advanced Settings</strong> - Changing these can affect call quality. Only adjust if you understand VAD parameters.
                  </n-alert>

                  <h4 style="margin: 0 0 0.75rem 0; font-size: 0.85rem; font-weight: 600;">Voice Activity Detection (VAD)</h4>

                  <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; font-size: 0.85rem;">
                      VAD Threshold: {{ vadThreshold.toFixed(2) }}
                    </label>
                    <n-slider
                      v-model:value="vadThreshold"
                      :step="0.05"
                      :min="0.3"
                      :max="0.8"
                      :marks="{
                        0.3: 'Sensitive',
                        0.5: 'Default',
                        0.8: 'Patient'
                      }"
                      size="small"
                      @update:value="handleVadThresholdChange"
                    />
                    <p style="margin: 0.35rem 0 0 0; font-size: 0.75rem; color: #9ca3af; line-height: 1.3;">
                      Lower = more sensitive to speech (may trigger on noise). Higher = waits for clearer speech.
                    </p>
                  </div>

                  <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.35rem; font-weight: 500; font-size: 0.85rem;">Prefix Padding (ms):</label>
                    <n-input-number
                      v-model:value="vadPrefixPaddingMs"
                      :min="100"
                      :max="1000"
                      :step="50"
                      size="small"
                      style="width: 100%;"
                      @update:value="handleVadPrefixPaddingChange"
                    />
                    <p style="margin: 0.35rem 0 0 0; font-size: 0.75rem; color: #9ca3af; line-height: 1.3;">
                      Audio captured BEFORE speech starts. 300-400ms recommended.
                    </p>
                  </div>

                  <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.35rem; font-weight: 500; font-size: 0.85rem;">Silence Duration (ms):</label>
                    <n-input-number
                      v-model:value="vadSilenceDurationMs"
                      :min="200"
                      :max="2000"
                      :step="100"
                      size="small"
                      style="width: 100%;"
                      @update:value="handleVadSilenceDurationChange"
                    />
                    <p style="margin: 0.35rem 0 0 0; font-size: 0.75rem; color: #9ca3af; line-height: 1.3;">
                      How long to wait before considering speech finished. 500ms = balanced, 700ms+ = patient (good for seniors).
                    </p>
                  </div>

                  <n-button
                    @click="resetVadToDefaults"
                    secondary
                    size="small"
                    style="margin-top: 0.5rem;"
                  >
                    <template #icon>
                      <n-icon size="14"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M320 146s24.36-12-64-12a160 160 0 10160 160" fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M256 58l80 80-80 80"/></svg></n-icon>
                    </template>
                    Reset to Defaults
                  </n-button>
                </div>

                <div v-if="selectedVoice" style="margin-top: 1.5rem; padding: 1rem; background: rgba(99, 102, 241, 0.05); border-radius: 8px;">
                  <p style="margin: 0; font-size: 0.9rem; color: #6b7280;">
                    <strong>Current Voice:</strong> {{ selectedVoice }}
                  </p>
                  <p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: #9ca3af;">
                    This voice will be used when this prompt is deployed and used in calls.
                  </p>
                </div>
              </div>
            </div>
          </n-tab-pane>

          <n-tab-pane name="variables" tab="Variables">
            <div class="variables-content">
              <div class="variables-section">
                <h3>Detected Variables</h3>
                <p class="text-muted">Variables found in this prompt version:</p>
                <div class="variables-wrapper" v-if="extractedVariables.length">
                  <n-tag v-for="variable in extractedVariables" :key="variable" size="medium" round>
                    {{ formatVariable(variable) }}
                  </n-tag>
                </div>
                <n-empty v-else description="No template variables detected. Use {{variableName}} syntax." size="small" />
              </div>

              <div class="variables-section">
                <h3>Available Variables</h3>
                <p class="text-muted">Click to copy variable syntax:</p>
                
                <div class="variable-category">
                  <h4>Lead Info</h4>
                  <div class="variable-grid">
                    <div v-for="variable in availableVariables.lead" :key="variable.key" class="variable-item" @click="copyVariable(variable.key)">
                      <span class="variable-name">{{ formatVariable(variable.key) }}</span>
                      <span class="variable-desc">{{ variable.desc }}</span>
                    </div>
                  </div>
                </div>

                <div class="variable-category">
                  <h4>Property Info</h4>
                  <div class="variable-grid">
                    <div v-for="variable in availableVariables.property" :key="variable.key" class="variable-item" @click="copyVariable(variable.key)">
                      <span class="variable-name">{{ formatVariable(variable.key) }}</span>
                      <span class="variable-desc">{{ variable.desc }}</span>
                    </div>
                  </div>
                </div>

                <div class="variable-category">
                  <h4>Broker Info</h4>
                  <div class="variable-grid">
                    <div v-for="variable in availableVariables.broker" :key="variable.key" class="variable-item" @click="copyVariable(variable.key)">
                      <span class="variable-name">{{ formatVariable(variable.key) }}</span>
                      <span class="variable-desc">{{ variable.desc }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </n-tab-pane>

          <n-tab-pane name="tools" tab="Tools">
            <div class="variables-content">
              <div class="variables-section">
                <h3>Available Tools</h3>
                <p class="text-muted">Click a tool to add it to the Tools section:</p>
                
                <div class="variable-category">
                  <h4>Lead Management</h4>
                  <div class="variable-grid">
                    <div v-for="tool in availableTools.lead" :key="tool.key" class="variable-item" @click="insertToolIntoPrompt(tool)">
                      <span class="variable-name">{{ tool.name }}</span>
                      <span class="variable-desc">{{ tool.desc }}</span>
                    </div>
                  </div>
                </div>

                <div class="variable-category">
                  <h4>Knowledge Base</h4>
                  <div class="variable-grid">
                    <div v-for="tool in availableTools.knowledge" :key="tool.key" class="variable-item" @click="insertToolIntoPrompt(tool)">
                      <span class="variable-name">{{ tool.name }}</span>
                      <span class="variable-desc">{{ tool.desc }}</span>
                    </div>
                  </div>
                </div>

                <div class="variable-category">
                  <h4>Broker & Territory</h4>
                  <div class="variable-grid">
                    <div v-for="tool in availableTools.broker" :key="tool.key" class="variable-item" @click="insertToolIntoPrompt(tool)">
                      <span class="variable-name">{{ tool.name }}</span>
                      <span class="variable-desc">{{ tool.desc }}</span>
                    </div>
                  </div>
                </div>

                <div class="variable-category">
                  <h4>Appointments</h4>
                  <div class="variable-grid">
                    <div v-for="tool in availableTools.appointment" :key="tool.key" class="variable-item" @click="insertToolIntoPrompt(tool)">
                      <span class="variable-name">{{ tool.name }}</span>
                      <span class="variable-desc">{{ tool.desc }}</span>
                    </div>
                  </div>
                </div>

                <div class="variable-category">
                  <h4>Call Tracking</h4>
                  <div class="variable-grid">
                    <div v-for="tool in availableTools.tracking" :key="tool.key" class="variable-item" @click="insertToolIntoPrompt(tool)">
                      <span class="variable-name">{{ tool.name }}</span>
                      <span class="variable-desc">{{ tool.desc }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </n-tab-pane>

          <n-tab-pane name="guide" tab="Guide">
            <div class="guide-content">
              <n-collapse v-model:expanded-names="guideExpandedSections">
                <n-collapse-item v-for="guide in guideContent" :key="guide.key" :title="guide.title" :name="guide.key">
                  <div class="guide-section">
                    <p class="guide-purpose"><strong>Purpose:</strong> {{ guide.purpose }}</p>
                    
                    <div v-if="guide.bestPractices" class="guide-subsection">
                      <h4>Best Practices</h4>
                      <ul>
                        <li v-for="(practice, idx) in guide.bestPractices" :key="idx">{{ practice }}</li>
                      </ul>
                    </div>

                    <div v-if="guide.example" class="guide-subsection">
                      <div class="guide-example-header">
                        <h4>Example</h4>
                        <n-button size="tiny" @click="insertExample(guide.key)" :disabled="!currentVersion">
                          <template #icon>
                            <n-icon><CopyOutline /></n-icon>
                          </template>
                          Insert Example
                        </n-button>
                      </div>
                      <pre class="guide-example">{{ guide.example }}</pre>
                    </div>

                    <div v-if="guide.keyPoints" class="guide-subsection">
                      <h4>Key Points</h4>
                      <ul>
                        <li v-for="(point, idx) in guide.keyPoints" :key="idx">{{ point }}</li>
                      </ul>
                    </div>
                  </div>
                </n-collapse-item>
              </n-collapse>
            </div>
          </n-tab-pane>
        </n-tabs>
      </n-card>
    </div>

    <n-modal v-model:show="showPreviewModal" preset="card" :style="{ width: '80%', maxWidth: '900px' }" title="Preview Prompt" :bordered="false">
      <n-scrollbar style="max-height: 70vh;">
        <div class="preview-content">
          <div class="preview-section" v-for="section in promptSections" :key="section.key">
            <h4 class="preview-section-title">{{ section.label }}</h4>
            <pre class="preview-section-content">{{ currentVersion?.content[section.key] || '(empty)' }}</pre>
          </div>
        </div>
      </n-scrollbar>
      <template #footer>
        <div class="modal-footer">
          <n-button @click="showPreviewModal = false">Close</n-button>
        </div>
      </template>
    </n-modal>

    <n-modal v-model:show="showDeployModal" preset="card" :style="{ width: '85%', maxWidth: '1000px' }" :title="isOlderVersion ? 'Confirm Rollback' : 'Confirm Deployment'" :bordered="false">
      <n-scrollbar style="max-height: 70vh;">
        <div class="deploy-preview">
          <p v-if="isOlderVersion" class="deploy-warning">
            You are about to rollback to <strong>v{{ currentVersion?.version_number }}</strong>. This will make it the active version.
          </p>
          <p v-else class="deploy-info">
            You are about to deploy <strong>v{{ currentVersion?.version_number }}</strong> to production.
          </p>

          <div style="margin: 1rem 0;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Change Summary:</label>
            <n-input
              v-model:value="deployChangeSummary"
              type="textarea"
              placeholder="Describe what changed in this version (e.g., 'Added appointment booking tools', 'Updated personality tone')..."
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </div>

          <div v-if="!activeVersion" class="preview-content">
            <p class="text-muted">No active version to compare. This will be the first deployment.</p>
            <div class="preview-section" v-for="section in promptSections" :key="section.key">
              <h4 class="preview-section-title">{{ section.label }}</h4>
              <pre class="preview-section-content">{{ currentVersion?.content[section.key] || '(empty)' }}</pre>
            </div>
          </div>

          <div v-else class="diff-content">
            <div class="diff-section" v-for="diffSection in diffSections" :key="diffSection.key">
              <h4 class="preview-section-title">
                {{ diffSection.label }}
                <span v-if="diffSection.hasChanges" class="changed-badge">Modified</span>
              </h4>
              <div class="diff-text">
                <span
                  v-for="(part, index) in diffSection.diff"
                  :key="index"
                  :class="{
                    'diff-added': part.added,
                    'diff-removed': part.removed,
                    'diff-unchanged': !part.added && !part.removed
                  }"
                >{{ part.value }}</span>
              </div>
            </div>
          </div>
        </div>
      </n-scrollbar>
      <template #footer>
        <div class="modal-footer">
          <n-button @click="showDeployModal = false">Cancel</n-button>
          <n-button type="info" @click="confirmDeploy" :loading="loading" :disabled="!deployChangeSummary.trim()">
            {{ isOlderVersion ? 'Confirm Rollback' : 'Confirm Deploy' }}
          </n-button>
        </div>
      </template>
    </n-modal>

    <!-- AI Improve Modal -->
    <n-modal v-model:show="showAIImproveModal" preset="card" :style="{ width: '90%', maxWidth: '1200px' }" title="✨ AI Improve Section" :bordered="false">
      <div v-if="!aiSuggestion" class="ai-improve-request">
        <div class="ai-context-info">
          <h4 style="margin: 0 0 0.5rem 0; color: #1f2937;">Improving: {{ aiImprovingSection?.label }}</h4>
          <p class="text-muted" style="margin: 0; font-size: 0.85rem; line-height: 1.6;">
            <strong>Prompt:</strong> {{ currentPromptMetadata.name }}<br>
            <strong>Purpose:</strong> {{ currentPromptMetadata.purpose }}<br>
            <strong>Goal:</strong> {{ currentPromptMetadata.goal }}
          </p>
        </div>

        <div style="margin: 1.5rem 0;">
          <label style="display: block; margin-bottom: 0.75rem; font-weight: 500;">What would you like to improve?</label>
          <n-input
            v-model:value="aiUserRequest"
            type="textarea"
            placeholder="Describe what you want to improve... (e.g., 'Make this warmer for elderly callers', 'Add more examples', 'Make it more concise')"
            :autosize="{ minRows: 3, maxRows: 6 }"
          />
        </div>

        <div class="quick-suggestions">
          <span class="quick-label" style="font-size: 0.85rem; color: #6b7280; font-weight: 500;">Quick suggestions:</span>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
            <n-tag
              v-for="suggestion in getQuickSuggestions(aiImprovingSection?.key)"
              :key="suggestion"
              size="medium"
              :bordered="false"
              style="cursor: pointer; background: rgba(99, 102, 241, 0.08); transition: all 0.2s;"
              @click="aiUserRequest = suggestion"
            >
              {{ suggestion }}
            </n-tag>
          </div>
        </div>

        <div class="current-content-preview" style="margin-top: 1.5rem;">
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #6b7280;">Current Content:</label>
          <pre style="background: rgba(248, 250, 255, 0.8); padding: 1rem; border-radius: 8px; font-size: 0.8rem; line-height: 1.5; max-height: 200px; overflow-y: auto; white-space: pre-wrap; border: 1px solid rgba(148, 163, 184, 0.18);">{{ currentVersion?.content[aiImprovingSection?.key] || '(empty)' }}</pre>
        </div>
      </div>

      <div v-else class="ai-improve-result">
        <div class="result-header" style="margin-bottom: 1rem;">
          <h4 style="margin: 0 0 0.25rem 0; color: #1f2937;">✨ AI Improved Version</h4>
          <p class="text-muted" style="margin: 0; font-size: 0.85rem;">Review the changes and accept or reject:</p>
        </div>

        <div class="side-by-side-diff" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="diff-column">
            <h5 style="margin: 0 0 0.5rem 0; font-size: 0.9rem; color: #6b7280;">Original</h5>
            <pre style="background: rgba(248, 250, 255, 0.8); padding: 1rem; border-radius: 8px; font-size: 0.8rem; line-height: 1.5; max-height: 400px; overflow-y: auto; white-space: pre-wrap; border: 1px solid rgba(148, 163, 184, 0.18);">{{ currentVersion?.content[aiImprovingSection?.key] || '(empty)' }}</pre>
          </div>
          <div class="diff-column">
            <h5 style="margin: 0 0 0.5rem 0; font-size: 0.9rem; color: #10b981;">AI Improved</h5>
            <pre style="background: rgba(16, 185, 129, 0.05); padding: 1rem; border-radius: 8px; font-size: 0.8rem; line-height: 1.5; max-height: 400px; overflow-y: auto; white-space: pre-wrap; border: 1px solid rgba(16, 185, 129, 0.3);">{{ aiSuggestion }}</pre>
          </div>
        </div>

        <div v-if="aiChanges.length > 0" class="changes-list" style="margin-top: 1rem; padding: 1rem; background: rgba(99, 102, 241, 0.05); border-radius: 8px;">
          <h5 style="margin: 0 0 0.5rem 0; font-size: 0.9rem; color: #1f2937;">Changes Made:</h5>
          <ul style="margin: 0; padding-left: 1.5rem; font-size: 0.85rem; line-height: 1.6;">
            <li v-for="(change, idx) in aiChanges" :key="idx">{{ change }}</li>
          </ul>
        </div>
      </div>

      <template #footer>
        <div class="modal-footer">
          <n-button @click="closeAIImprove" :disabled="aiIsLoading">Cancel</n-button>
          <n-button v-if="!aiSuggestion" type="primary" @click="runAIImprove" :loading="aiIsLoading" :disabled="!aiUserRequest.trim()">
            <template #icon>
              <n-icon><SparklesOutline /></n-icon>
            </template>
            Improve with AI
          </n-button>
          <n-button v-else type="success" @click="acceptAISuggestion">
            <template #icon>
              <n-icon><CheckmarkOutline /></n-icon>
            </template>
            Accept Changes
          </n-button>
        </div>
      </template>
    </n-modal>

    <!-- Audit Questions Modal -->
    <n-modal 
      v-model:show="showAuditQuestionsModal" 
      preset="card" 
      :style="{ width: '700px' }" 
      title="📋 Prompt Audit Questions" 
      :bordered="false"
      :z-index="9999"
      :mask-closable="false"
    >
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        <p style="margin: 0; color: #6b7280; font-size: 0.9rem;">
          Answer these questions to help GPT-5 provide a comprehensive evaluation of your prompt:
        </p>

        <div>
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #1f2937;">
            1. What specific problem are you trying to solve with this prompt version?
          </label>
          <n-input
            v-model:value="auditAnswers.problem"
            type="textarea"
            placeholder="e.g., Need to handle objections better, improve qualification flow, reduce call time..."
            :autosize="{ minRows: 2, maxRows: 4 }"
          />
        </div>

        <div>
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #1f2937;">
            2. What's the target lead profile?
          </label>
          <n-input
            v-model:value="auditAnswers.targetProfile"
            type="textarea"
            placeholder="e.g., 50-70 years old, $150k+ equity, owner-occupied, skeptical of reverse mortgages..."
            :autosize="{ minRows: 2, maxRows: 4 }"
          />
        </div>

        <div>
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #1f2937;">
            3. What's the primary conversion goal?
          </label>
          <n-input
            v-model:value="auditAnswers.conversionGoal"
            type="textarea"
            placeholder="e.g., Book appointment with broker, qualify lead and schedule callback, gather missing data..."
            :autosize="{ minRows: 2, maxRows: 4 }"
          />
        </div>

        <div>
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #1f2937;">
            4. Are there any known issues from previous versions?
          </label>
          <n-input
            v-model:value="auditAnswers.knownIssues"
            type="textarea"
            placeholder="e.g., Too wordy, doesn't handle 'not interested' well, confusing equity explanation..."
            :autosize="{ minRows: 2, maxRows: 4 }"
          />
        </div>

        <div>
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #1f2937;">
            5. What tone/personality are you aiming for?
          </label>
          <n-input
            v-model:value="auditAnswers.tone"
            type="textarea"
            placeholder="e.g., Warm and conversational, professional but friendly, empathetic and patient..."
            :autosize="{ minRows: 2, maxRows: 4 }"
          />
        </div>

        <div>
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #1f2937;">
            6. Any specific objections or edge cases this needs to handle?
          </label>
          <n-input
            v-model:value="auditAnswers.edgeCases"
            type="textarea"
            placeholder="e.g., 'I'm not interested in selling my home', 'My spouse handles finances', wrong number scenarios..."
            :autosize="{ minRows: 2, maxRows: 4 }"
          />
        </div>
      </div>

      <template #footer>
        <div class="modal-footer">
          <n-button @click="closeAuditQuestions" :disabled="auditIsLoading">Cancel</n-button>
          <n-button type="primary" @click="runAudit" :loading="auditIsLoading">
            <template #icon>
              <n-icon><CheckmarkDoneOutline /></n-icon>
            </template>
            Run Audit (GPT-5)
          </n-button>
        </div>
      </template>
    </n-modal>

    <!-- Audit Results Modal -->
    <n-modal 
      v-model:show="showAuditResultsModal" 
      preset="card" 
      :style="{ width: '900px', maxHeight: '85vh' }" 
      title="📊 Prompt Audit Results" 
      :bordered="false"
      :z-index="9999"
      :mask-closable="false"
    >
      <n-scrollbar style="max-height: calc(85vh - 180px);">
        <div style="display: flex; flex-direction: column; gap: 2rem;">
          <!-- Overall Score -->
          <div style="text-align: center; padding: 2rem; background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1)); border-radius: 12px;">
            <h2 style="margin: 0 0 0.5rem 0; font-size: 3rem; font-weight: 700; color: #4f46e5;">
              {{ auditResults.score }}<span style="font-size: 1.5rem; color: #6b7280;">/100</span>
            </h2>
            <p style="margin: 0; color: #6b7280; font-size: 0.9rem;">
              {{ auditResults.score >= 90 ? '🎉 Excellent!' : auditResults.score >= 75 ? '✅ Good' : auditResults.score >= 60 ? '⚠️ Needs Improvement' : '🚨 Major Issues' }}
            </p>
          </div>

          <!-- Strengths -->
          <div v-if="auditResults.strengths.length > 0">
            <h3 style="margin: 0 0 1rem 0; color: #10b981; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
              <n-icon size="20"><CheckmarkOutline /></n-icon> Strengths
            </h3>
            <ul style="margin: 0; padding-left: 1.5rem; line-height: 1.8; color: #374151;">
              <li v-for="(strength, idx) in auditResults.strengths" :key="idx">{{ strength }}</li>
            </ul>
          </div>

          <!-- Critical Issues -->
          <div v-if="auditResults.criticalIssues.length > 0" style="padding: 1rem; background: rgba(239, 68, 68, 0.08); border-left: 4px solid #ef4444; border-radius: 8px;">
            <h3 style="margin: 0 0 1rem 0; color: #ef4444; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
              <n-icon size="20"><CloseOutline /></n-icon> Critical Issues
            </h3>
            <ul style="margin: 0; padding-left: 1.5rem; line-height: 1.8; color: #7f1d1d;">
              <li v-for="(issue, idx) in auditResults.criticalIssues" :key="idx">{{ issue }}</li>
            </ul>
          </div>

          <!-- Weaknesses -->
          <div v-if="auditResults.weaknesses.length > 0">
            <h3 style="margin: 0 0 1rem 0; color: #f59e0b; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
              <n-icon size="20"><InformationCircleOutline /></n-icon> Weaknesses
            </h3>
            <ul style="margin: 0; padding-left: 1.5rem; line-height: 1.8; color: #78350f;">
              <li v-for="(weakness, idx) in auditResults.weaknesses" :key="idx">{{ weakness }}</li>
            </ul>
          </div>

          <!-- Recommendations -->
          <div v-if="auditResults.recommendations.length > 0">
            <h3 style="margin: 0 0 1rem 0; color: #6366f1; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
              <n-icon size="20"><SparklesOutline /></n-icon> Recommendations ({{ auditResults.recommendations.length }})
            </h3>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <div 
                v-for="(rec, idx) in auditResults.recommendations" 
                :key="idx"
                style="padding: 1rem; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 8px; background: rgba(248, 250, 255, 0.5);"
              >
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                  <div style="flex: 1;">
                    <span 
                      :style="{ 
                        display: 'inline-block',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        background: rec.priority === 'critical' ? '#fef2f2' : rec.priority === 'high' ? '#fff7ed' : rec.priority === 'medium' ? '#fefce8' : '#f0fdf4',
                        color: rec.priority === 'critical' ? '#991b1b' : rec.priority === 'high' ? '#9a3412' : rec.priority === 'medium' ? '#854d0e' : '#166534'
                      }"
                    >
                      {{ rec.priority.toUpperCase() }}
                    </span>
                    <span style="margin-left: 0.5rem; font-weight: 500; color: #1f2937;">{{ rec.section }}</span>
                  </div>
                  <n-button size="small" type="primary" @click="applyAuditRecommendation(rec)">
                    <template #icon>
                      <n-icon><CheckmarkDoneOutline /></n-icon>
                    </template>
                    Apply
                  </n-button>
                </div>
                <p style="margin: 0 0 0.5rem 0; color: #ef4444; font-size: 0.9rem;"><strong>Issue:</strong> {{ rec.issue }}</p>
                <p style="margin: 0 0 0.5rem 0; color: #6b7280; font-size: 0.85rem;"><strong>Why:</strong> {{ rec.reasoning }}</p>
                <div style="margin-top: 0.75rem; padding: 0.75rem; background: rgba(16, 185, 129, 0.05); border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.2);">
                  <p style="margin: 0 0 0.5rem 0; font-size: 0.8rem; font-weight: 600; color: #10b981;">Suggested Change:</p>
                  <pre style="margin: 0; white-space: pre-wrap; font-size: 0.85rem; line-height: 1.5; color: #1f2937;">{{ rec.suggestion }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </n-scrollbar>

      <template #footer>
        <div class="modal-footer">
          <n-button @click="closeAuditResults">Close</n-button>
        </div>
      </template>
    </n-modal>

    <n-modal 
      v-model:show="showNewPromptModal" 
      preset="card" 
      :style="{ width: '500px' }" 
      title="Create New Prompt" 
      :bordered="false"
      :z-index="9999"
      :mask-closable="false"
    >
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div>
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Prompt Name:</label>
          <n-input
            v-model:value="newPromptName"
            placeholder="e.g., Barbara - Email Assistant"
            @keyup.enter="confirmCreatePrompt"
            autofocus
          />
        </div>
        <div>
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Category:</label>
          <n-input
            v-model:value="newPromptCategory"
            placeholder="e.g., voice-assistant, email-assistant"
            @keyup.enter="confirmCreatePrompt"
          />
        </div>
      </div>
      <template #footer>
        <div class="modal-footer">
          <n-button @click="showNewPromptModal = false">Cancel</n-button>
          <n-button type="primary" @click="confirmCreatePrompt" :disabled="!newPromptName.trim()" :loading="loading">
            Create Prompt
          </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick, h } from 'vue'
import { supabase } from '@/lib/supabase'
import * as Diff from 'diff'
import {
  NCard,
  NButton,
  NIcon,
  NCollapse,
  NCollapseItem,
  NTooltip,
  NTabs,
  NTabPane,
  NEmpty,
  NTag,
  NGrid,
  NGridItem,
  NStatistic,
  NDropdown,
  NModal,
  NScrollbar,
  NInput,
  NSelect,
  NSlider,
  NInputNumber,
  NAlert,
  NProgress,
  NList,
  NListItem,
  NBadge
} from 'naive-ui'
import {
  RefreshOutline,
  AddCircleOutline,
  SaveOutline,
  RocketOutline,
  InformationCircleOutline,
  FolderOutline,
  CubeOutline,
  CopyOutline,
  FlashOutline,
  EyeOutline,
  BuildOutline,
  ConstructOutline,
  CallOutline,
  PhonePortraitOutline,
  SwapHorizontalOutline,
  SparklesOutline,
  SendOutline,
  CheckmarkOutline,
  CloseOutline,
  TimeOutline,
  CalendarOutline,
  PeopleOutline,
  ShieldCheckmarkOutline,
  CheckmarkDoneOutline,
  CheckmarkCircleOutline,
  CloseCircleOutline,
  WarningOutline,
  BarChartOutline
} from '@vicons/ionicons5'

const loading = ref(false)
const error = ref('')
const activeTab = ref('performance')
const versions = ref([])
const showPreviewModal = ref(false)
const showDeployModal = ref(false)
const showNewPromptModal = ref(false)
const newPromptName = ref('')
const newPromptCategory = ref('voice-assistant')
const activeVersion = ref(null)
const diffSections = ref([])
const deployChangeSummary = ref('')
const selectedVoice = ref('alloy')
const currentPromptMetadata = ref({ name: '', purpose: '', goal: '', call_type: '' })

// VAD settings
const vadThreshold = ref(0.5)
const vadPrefixPaddingMs = ref(300)
const vadSilenceDurationMs = ref(500)
const showAdvancedSettings = ref(false)

// AI Improve feature
const showAIImproveModal = ref(false)
const aiImprovingSection = ref(null)
const aiUserRequest = ref('')
const aiSuggestion = ref('')
const aiChanges = ref([])
const aiIsLoading = ref(false)

// AI Audit feature
const showAuditQuestionsModal = ref(false)
const showAuditResultsModal = ref(false)
const auditIsLoading = ref(false)
const auditAnswers = ref({
  problem: '',
  targetProfile: '',
  conversionGoal: '',
  knownIssues: '',
  tone: '',
  edgeCases: ''
})
const auditResults = ref({
  score: 0,
  strengths: [],
  weaknesses: [],
  criticalIssues: [],
  recommendations: []
})

const voiceOptions = [
  { label: 'Alloy', value: 'alloy' },
  { label: 'Echo', value: 'echo' },
  { label: 'Shimmer', value: 'shimmer' },
  { label: 'Ash', value: 'ash' },
  { label: 'Ballad', value: 'ballad' },
  { label: 'Coral', value: 'coral' },
  { label: 'Sage', value: 'sage' },
  { label: 'Verse', value: 'verse' },
  { label: 'Cedar', value: 'cedar' },
  { label: 'Marin', value: 'marin' }
]

const prompts = ref([])
const activePromptId = ref(null)
const currentVersion = ref(null)
const performanceData = ref(null)
const hasChanges = ref(false)

// Scrollbar refs and state
const promptsTrack = ref(null)
const versionsTrack = ref(null)
const canScrollPromptsLeft = ref(false)
const canScrollPromptsRight = ref(false)
const canScrollVersionsLeft = ref(false)
const canScrollVersionsRight = ref(false)

// Debug: watch hasChanges
watch(hasChanges, (newVal) => {
  console.log('🔵 hasChanges changed to:', newVal)
})

watch(loading, (newVal) => {
  console.log('🔵 loading changed to:', newVal)
})

// Watch prompts and versions to update scroll states
watch(prompts, () => {
  console.log('📊 Prompts changed, updating scroll states')
  setTimeout(updateScrollStates, 100)
}, { deep: true })

watch(versions, () => {
  console.log('📊 Versions changed, updating scroll states')
  setTimeout(updateScrollStates, 100)
}, { deep: true })
const expandedSections = ref([])
const guideExpandedSections = ref([])
const textareaRefs = ref({})
let textareaMirror = null
const promptsCollapsed = ref(false)
const versionsCollapsed = ref(false)

const availableTools = {
  lead: [
    { key: 'get_lead_context', name: 'get_lead_context', desc: 'Get lead information by phone number to personalize the conversation. Returns lead details, broker info, and property data.' },
    { key: 'update_lead_info', name: 'update_lead_info', desc: 'Update lead information collected during the call (last name, address, age, property value, mortgage balance, owner_occupied).' },
    { key: 'check_consent_dnc', name: 'check_consent_dnc', desc: 'Check if lead has given consent to be contacted and is not on DNC list.' }
  ],
  knowledge: [
    { key: 'search_knowledge', name: 'search_knowledge', desc: 'Search the reverse mortgage knowledge base for accurate information about eligibility, fees, objections, compliance, etc.' }
  ],
  broker: [
    { key: 'find_broker_by_territory', name: 'find_broker_by_territory', desc: 'Find the appropriate broker for a lead based on their city or ZIP code.' },
    { key: 'check_broker_availability', name: 'check_broker_availability', desc: 'Check broker calendar availability for appointment scheduling. Returns available time slots for the next 7 days.' }
  ],
  appointment: [
    { key: 'book_appointment', name: 'book_appointment', desc: 'Book an appointment with the broker after checking availability. Creates calendar event and auto-sends invite to lead email.' },
    { key: 'assign_tracking_number', name: 'assign_tracking_number', desc: 'Assign the current SignalWire number to this lead/broker pair for call tracking. Should be called immediately after booking an appointment.' }
  ],
  tracking: [
    { key: 'save_interaction', name: 'save_interaction', desc: 'Save call interaction details at the end of the call. Include transcript summary and outcome.' }
  ]
}

const availableVariables = {
  lead: [
    { key: 'leadFirstName', desc: 'Lead first name' },
    { key: 'leadLastName', desc: 'Lead last name' },
    { key: 'leadFullName', desc: 'Lead full name' },
    { key: 'leadEmail', desc: 'Lead email address' },
    { key: 'leadPhone', desc: 'Lead phone number' },
    { key: 'leadAge', desc: 'Lead age' }
  ],
  property: [
    { key: 'propertyAddress', desc: 'Full property address' },
    { key: 'propertyCity', desc: 'Property city' },
    { key: 'propertyState', desc: 'Property state' },
    { key: 'propertyZipcode', desc: 'Property ZIP code' },
    { key: 'propertyValue', desc: 'Property value (number)' },
    { key: 'propertyValueWords', desc: 'Property value in words' },
    { key: 'mortgageBalance', desc: 'Mortgage balance (number)' },
    { key: 'mortgageBalanceWords', desc: 'Mortgage balance in words' },
    { key: 'estimatedEquity', desc: 'Estimated equity (number)' },
    { key: 'estimatedEquityWords', desc: 'Estimated equity in words' },
    { key: 'ownerOccupied', desc: 'Owner occupied (true/false)' }
  ],
  broker: [
    { key: 'brokerFirstName', desc: 'Broker first name' },
    { key: 'brokerLastName', desc: 'Broker last name' },
    { key: 'brokerFullName', desc: 'Broker full name' },
    { key: 'brokerCompany', desc: 'Broker company name' },
    { key: 'brokerPhone', desc: 'Broker phone number' }
  ]
}

const variableDropdownOptions = computed(() => {
  const allVars = [
    ...availableVariables.lead,
    ...availableVariables.property,
    ...availableVariables.broker
  ]
  
  return allVars.map(v => ({
    label: `{{${v.key}}} - ${v.desc}`,
    key: v.key
  }))
})

const toolsDropdownOptions = computed(() => {
  const allTools = [
    ...availableTools.lead,
    ...availableTools.knowledge,
    ...availableTools.broker,
    ...availableTools.appointment,
    ...availableTools.tracking
  ]
  
  return [
    {
      label: '✨ Add All Tools',
      key: 'ADD_ALL_TOOLS'
    },
    {
      type: 'divider',
      key: 'divider'
    },
    ...allTools.map(t => ({
      label: `${t.name}`,
      key: t.key,
      toolData: t
    }))
  ]
})

const promptSections = [
  { key: 'role', label: 'Role & Objective', required: true, placeholder: 'Define who the agent is and what success means...' },
  { key: 'personality', label: 'Personality & Tone', required: true, placeholder: 'Voice, style, warmth, brevity (2-3 sentences per turn)...' },
  { key: 'context', label: 'Context', required: false, placeholder: 'Relevant background, caller data, previous call notes...' },
  { key: 'pronunciation', label: 'Reference Pronunciations', required: false, placeholder: 'Phonetic guidance for tricky words or names...' },
  { key: 'tools', label: 'Tools', required: false, placeholder: 'List functions/APIs the agent may call and when to use them...' },
  { key: 'instructions', label: 'Instructions & Rules', required: true, placeholder: 'Behavior guardrails, dos/donts, escalation triggers...' },
  { key: 'conversation_flow', label: 'Conversation Flow', required: false, placeholder: 'Outline conversation states, transitions, and exit criteria...' },
  { key: 'output_format', label: 'Output Format', required: false, placeholder: 'Structured output requirements (JSON schema, message format)...' },
  { key: 'safety', label: 'Safety & Escalation', required: false, placeholder: 'When to handoff to a human, fallback behavior, compliance notes...' }
]

const guideContent = [
  {
    key: 'role',
    title: 'Role & Objective',
    purpose: 'Define who the AI is and what success looks like',
    bestPractices: [
      'Keep it to 2-3 bullet points',
      'Be specific about the domain',
      'Define the primary goal clearly'
    ],
    example: `- You are a friendly, knowledgeable customer service agent for [Company Name]
- Your goal is to resolve customer issues efficiently while maintaining a warm, professional tone
- Success means the customer feels heard, their issue is resolved or escalated appropriately`
  },
  {
    key: 'personality',
    title: 'Personality & Tone',
    purpose: 'Set voice, brevity, and pacing for natural responses',
    keyPoints: [
      'Personality: 1-2 adjectives + role descriptor',
      'Tone: emotional quality (warm, confident, etc.)',
      'Length: e.g., "2-3 sentences per turn"',
      'Pacing: voice-specific guidance',
      'Language: if multilingual or strict to one language',
      'Variety: prevent robotic repetition'
    ],
    example: `## Personality
- Friendly, calm, and approachable expert

## Tone
- Warm, concise, confident, never fawning

## Length
- 2-3 sentences per turn

## Pacing
- Deliver your audio response fast, but do not sound rushed
- Do not modify content, only increase speaking speed

## Language
- The conversation will be only in English
- Do not respond in any other language even if the user asks

## Variety
- Do not repeat the same sentence twice
- Vary your responses so it doesn't sound robotic`
  },
  {
    key: 'pronunciation',
    title: 'Reference Pronunciations',
    purpose: 'Guide specific pronunciations for brand names, technical terms, or proper nouns',
    bestPractices: [
      'Use phonetic spelling for tricky words',
      'Include brand names and technical jargon',
      'Specify exact pronunciation inline'
    ],
    example: `When voicing these words, use the respective pronunciations:
- Pronounce "SQL" as "sequel"
- Pronounce "PostgreSQL" as "post-gress"
- Pronounce "Kyiv" as "KEE-iv"
- Pronounce "Huawei" as "HWAH-way"`
  },
  {
    key: 'instructions',
    title: 'Instructions & Rules',
    purpose: 'Core behavioral rules and constraints',
    keyPoints: [
      'Use clear, short bullets that outperform long paragraphs',
      'Avoid conflicting, ambiguous, or unclear instructions',
      'Include unclear audio handling rules',
      'Specify digit/number reading format',
      'Define speed/pacing control'
    ],
    example: `## Unclear Audio
- Only respond to clear audio or text
- If the user's audio is unintelligible, ask for clarification:
  "I'm sorry, I didn't catch that. Could you repeat?"

## Reading Numbers
- Always read back phone numbers, credit cards, or IDs digit-by-digit with pauses
- Example: "5-5-1-1-1-9-7-6-5-4-2-3"
- After reading, ask: "Is that correct?"

## Pacing
- Deliver responses quickly but naturally
- Do not modify content—only increase speaking speed
- Avoid rushed or robotic delivery`
  },
  {
    key: 'conversation_flow',
    title: 'Conversation Flow',
    purpose: 'Structure dialogue into clear, goal-driven phases',
    bestPractices: [
      'Break interaction into phases with clear goals',
      'Define exit criteria for each phase',
      'Include sample phrases for variety',
      'Prevent stalling, skipping steps, or jumping ahead'
    ],
    example: `## 1) Greeting
Goal: Set tone and invite reason for calling
How to respond:
- Identify as [Company Name]
- Keep opener brief and invite caller's goal
- Sample phrases: "Thanks for calling [Company]—how can I help today?"
Exit when: Caller states an initial goal

## 2) Discovery
Goal: Classify the issue
How to respond:
- Ask one targeted question to understand the issue
- Collect key details (email, phone, address)
Exit when: Intent and contact info are known

## 3) Resolution
Goal: Apply fix or escalate
How to respond:
- Use appropriate tools
- Confirm outcome
Exit when: Issue resolved or escalated`
  },
  {
    key: 'tools',
    title: 'Tools',
    purpose: 'Define when/how to invoke functions',
    keyPoints: [
      'Tool alignment check – Ensure tools in prompt match available tools',
      'Preambles – What to say BEFORE calling the tool',
      'Proactive vs Confirmation – Define per-tool behavior',
      'When to use / When NOT to use'
    ],
    example: `## General Rules
- When calling a tool, do not ask for user confirmation (be proactive)
- EXCEPTION: For destructive actions (refunds, cancellations), confirm first

## lookup_account(email_or_phone)
**When to use:** Verifying identity or viewing account details
**When NOT to use:** User is clearly anonymous with general questions
**Preamble sample phrases:**
- "Let me pull up your account now"
- "I'm looking up your account using [email/phone]"

## check_outage(address)
**When to use:** User reports connectivity issues
**When NOT to use:** Question is billing-only
**Preamble sample phrases:**
- "I'll check for any outages at [address] right now"`
  },
  {
    key: 'safety',
    title: 'Safety & Escalation',
    purpose: 'Define when to escalate and what to say',
    keyPoints: [
      'Escalate immediately for safety risks',
      'Escalate on explicit user requests',
      'Escalate for severe dissatisfaction',
      'Escalate after repeated tool failures',
      'Escalate for out-of-scope requests'
    ],
    example: `When to escalate (no extra troubleshooting):
- Safety risk (self-harm, threats, harassment)
- User explicitly asks for a human
- Severe dissatisfaction (profanity, "extremely frustrated")
- 2 failed tool attempts on same task
- Out-of-scope (real-time news, financial/legal/medical advice)

What to say (MANDATORY):
- "Thanks for your patience—I'm connecting you with a specialist now."
- Then call: escalate_to_human()

Examples requiring escalation:
- "This is the third time it didn't work. Just get me a person."
- "I am extremely frustrated!"`
  }
]

const extractedVariables = computed(() => {
  if (!currentVersion.value?.content) return []
  const variables = new Set()
  const regex = /{{(\w+)}}/g
  promptSections.forEach(section => {
    const content = currentVersion.value.content[section.key]
    if (content) {
      let match
      while ((match = regex.exec(content)) !== null) {
        variables.add(match[1])
      }
    }
  })
  return Array.from(variables).sort()
})

const performanceMetrics = computed(() => {
  if (!performanceData.value) return []
  return [
    { key: 'calls', label: 'Total Calls', value: performanceData.value.total_calls || 0, suffix: '' },
    { key: 'duration', label: 'Avg Duration', value: performanceData.value.avg_duration || 0, suffix: 's' },
    { key: 'conversion', label: 'Conversion Rate', value: performanceData.value.conversion_rate || 0, suffix: '%' },
    { key: 'compliance', label: 'Compliance Score', value: performanceData.value.compliance_score || 0, suffix: '%' }
  ]
})

// Evaluation data for current prompt version
const evaluationData = ref(null)
const evaluationLoading = ref(false)

// Computed property for evaluation metrics display
const evaluationMetrics = computed(() => {
  if (!evaluationData.value) return []
  return [
    { key: 'opening_effectiveness', label: 'Opening Effectiveness', value: evaluationData.value.avgOpeningEffectiveness || 0 },
    { key: 'property_discussion_quality', label: 'Property Discussion', value: evaluationData.value.avgPropertyDiscussionQuality || 0 },
    { key: 'objection_handling', label: 'Objection Handling', value: evaluationData.value.avgObjectionHandling || 0 },
    { key: 'booking_attempt_quality', label: 'Booking Attempts', value: evaluationData.value.avgBookingAttemptQuality || 0 },
    { key: 'tone_consistency', label: 'Tone Consistency', value: evaluationData.value.avgToneConsistency || 0 },
    { key: 'overall_call_flow', label: 'Overall Call Flow', value: evaluationData.value.avgOverallCallFlow || 0 }
  ]
})

// AI suggestions based on weaknesses and low scores
const aiSuggestions = computed(() => {
  if (!evaluationData.value) return []
  
  const suggestions = []
  const metrics = {
    opening_effectiveness: evaluationData.value.avgOpeningEffectiveness || 0,
    property_discussion_quality: evaluationData.value.avgPropertyDiscussionQuality || 0,
    objection_handling: evaluationData.value.avgObjectionHandling || 0,
    booking_attempt_quality: evaluationData.value.avgBookingAttemptQuality || 0,
    tone_consistency: evaluationData.value.avgToneConsistency || 0,
    overall_call_flow: evaluationData.value.avgOverallCallFlow || 0
  }
  
  // Suggest improvements for metrics scoring below 7
  if (metrics.opening_effectiveness < 7) {
    suggestions.push({
      priority: metrics.opening_effectiveness < 5 ? 'High' : 'Medium',
      title: 'Improve Opening Effectiveness',
      description: 'Focus on warmer greetings, faster rapport building, and confirming the lead\'s name early',
      section: 'role_objective'
    })
  }
  
  if (metrics.property_discussion_quality < 7) {
    suggestions.push({
      priority: metrics.property_discussion_quality < 5 ? 'High' : 'Medium',
      title: 'Enhance Property Discussion Quality',
      description: 'Add more targeted questions about property details and equity calculations',
      section: 'instructions_rules'
    })
  }
  
  if (metrics.objection_handling < 7) {
    suggestions.push({
      priority: metrics.objection_handling < 5 ? 'High' : 'Medium',
      title: 'Strengthen Objection Handling',
      description: 'Include techniques for reframing concerns and addressing common objections',
      section: 'conversation_flow'
    })
  }
  
  if (metrics.booking_attempt_quality < 7) {
    suggestions.push({
      priority: metrics.booking_attempt_quality < 5 ? 'High' : 'Medium',
      title: 'Improve Booking Attempts',
      description: 'Make appointment requests clearer, more confident, and tied to value proposition',
      section: 'conversation_flow'
    })
  }
  
  if (metrics.tone_consistency < 7) {
    suggestions.push({
      priority: 'Medium',
      title: 'Maintain Tone Consistency',
      description: 'Review personality guidelines to ensure conversational and empathetic tone throughout',
      section: 'personality_tone'
    })
  }
  
  if (metrics.overall_call_flow < 7) {
    suggestions.push({
      priority: metrics.overall_call_flow < 5 ? 'High' : 'Medium',
      title: 'Optimize Call Flow',
      description: 'Improve logical progression and pacing through better conversation structure',
      section: 'conversation_flow'
    })
  }
  
  // Add suggestions from common weaknesses
  if (evaluationData.value.commonWeaknesses && evaluationData.value.commonWeaknesses.length > 0) {
    const topWeakness = evaluationData.value.commonWeaknesses[0]
    if (topWeakness.toLowerCase().includes('rapport')) {
      suggestions.push({
        priority: 'High',
        title: 'Build Stronger Rapport',
        description: 'Add empathetic responses and active listening cues based on AI analysis',
        section: 'personality_tone'
      })
    }
  }
  
  return suggestions.slice(0, 5) // Limit to top 5 suggestions
})

// Computed property to get active prompt object
const activePrompt = computed(() => {
  return prompts.value.find(p => p.id === activePromptId.value) || null
})

// Helper functions
const getScoreClass = (score) => {
  if (score >= 8) return 'score-good'
  if (score >= 6) return 'score-fair'
  return 'score-poor'
}

const getScoreColor = (score) => {
  if (score >= 8) return '#10b981' // green
  if (score >= 6) return '#f59e0b' // yellow
  return '#ef4444' // red
}

const getPriorityType = (priority) => {
  if (priority === 'High') return 'error'
  if (priority === 'Medium') return 'warning'
  return 'info'
}

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return 'Never'
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks < 4) return `${diffWeeks}w ago`
  return date.toLocaleDateString()
}

// Apply suggestion to prompt
const applySuggestion = async (suggestion) => {
  // Open the relevant section in Editor tab
  activeTab.value = 'editor'
  expandedSections.value = [suggestion.section]
  
  // Show notification
  window.$message?.info(`Opening ${suggestion.section.replace(/_/g, ' ')} section. Review and apply the suggestion.`)
}

// Fetch evaluation data for current prompt version
const fetchEvaluationData = async () => {
  if (!currentVersion.value || !activePrompt.value) {
    evaluationData.value = null
    return
  }
  
  evaluationLoading.value = true
  
  try {
    // Format: "inbound-qualified-v3" or "outbound-warm-v2"
    const promptVersion = `${activePrompt.value.call_type}-v${currentVersion.value.version_number}`
    
    // Query Supabase for evaluations matching this prompt_version
    const { data, error: queryError } = await supabase
      .from('call_evaluations')
      .select('*')
      .eq('prompt_version', promptVersion)
    
    if (queryError) {
      console.error('Error fetching evaluation data:', queryError)
      evaluationData.value = null
      return
    }
    
    if (!data || data.length === 0) {
      evaluationData.value = null
      return
    }
    
    // Calculate averages for all 6 metrics
    const avgOpeningEffectiveness = data.reduce((sum, e) => sum + (e.opening_effectiveness || 0), 0) / data.length
    const avgPropertyDiscussionQuality = data.reduce((sum, e) => sum + (e.property_discussion_quality || 0), 0) / data.length
    const avgObjectionHandling = data.reduce((sum, e) => sum + (e.objection_handling || 0), 0) / data.length
    const avgBookingAttemptQuality = data.reduce((sum, e) => sum + (e.booking_attempt_quality || 0), 0) / data.length
    const avgToneConsistency = data.reduce((sum, e) => sum + (e.tone_consistency || 0), 0) / data.length
    const avgOverallCallFlow = data.reduce((sum, e) => sum + (e.overall_call_flow || 0), 0) / data.length
    const avgOverallScore = data.reduce((sum, e) => sum + (parseFloat(e.overall_score) || 0), 0) / data.length
    const bestScore = Math.max(...data.map(e => parseFloat(e.overall_score) || 0))
    
    // Collect all analysis objects
    const allStrengths = []
    const allWeaknesses = []
    const allRedFlags = []
    
    data.forEach(evaluation => {
      if (evaluation.analysis) {
        if (evaluation.analysis.strengths) {
          allStrengths.push(...evaluation.analysis.strengths)
        }
        if (evaluation.analysis.weaknesses) {
          allWeaknesses.push(...evaluation.analysis.weaknesses)
        }
        if (evaluation.analysis.red_flags) {
          allRedFlags.push(...evaluation.analysis.red_flags)
        }
      }
    })
    
    // Get most common items (simple frequency count)
    const getTopItems = (items, limit = 5) => {
      const frequency = {}
      items.forEach(item => {
        frequency[item] = (frequency[item] || 0) + 1
      })
      return Object.entries(frequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([item]) => item)
    }
    
    evaluationData.value = {
      count: data.length,
      avgOverallScore: avgOverallScore.toFixed(1),
      bestScore: bestScore.toFixed(1),
      lastEvaluated: data[0]?.evaluated_at, // Assuming sorted by evaluated_at desc
      avgOpeningEffectiveness,
      avgPropertyDiscussionQuality,
      avgObjectionHandling,
      avgBookingAttemptQuality,
      avgToneConsistency,
      avgOverallCallFlow,
      commonStrengths: getTopItems(allStrengths),
      commonWeaknesses: getTopItems(allWeaknesses),
      redFlags: getTopItems(allRedFlags, 3)
    }
  } catch (err) {
    console.error('Error in fetchEvaluationData:', err)
    evaluationData.value = null
  } finally {
    evaluationLoading.value = false
  }
}

// Watch for version changes to fetch evaluation data
watch([currentVersion, activePrompt], () => {
  fetchEvaluationData()
}, { immediate: true })

const isOlderVersion = computed(() => {
  if (!currentVersion.value || !versions.value.length) return false
  const latestVersion = versions.value[0] // versions sorted desc by version_number
  return currentVersion.value.version_number < latestVersion.version_number
})

// Watch for section expansions to trigger textarea resize
watch(expandedSections, (newSections, oldSections) => {
  const newlyExpanded = newSections.filter(s => !oldSections.includes(s))
  newlyExpanded.forEach(key => {
    setTimeout(() => {
      const textarea = textareaRefs.value[key]
      if (textarea) {
        // Populate content (always update to latest content)
        if (currentVersion.value?.content[key] !== undefined) {
          textarea.innerText = currentVersion.value.content[key] || ''
        }
        
        textarea.style.height = '0px'
        nextTick(() => {
          textarea.style.height = textarea.scrollHeight + 20 + 'px'
          textarea.style.overflowY = 'hidden'
        })
      }
    }, 350)
  })
}, { deep: true })

async function selectPrompt(id) {
  // Check for unsaved changes before switching prompts
  if (hasChanges.value) {
    const confirmed = window.confirm('You have unsaved changes. Do you want to save before switching prompts?')
    if (confirmed) {
      await saveChanges()
    } else {
      hasChanges.value = false
    }
  }
  
  activePromptId.value = id
  
  // Load the prompt details to get the voice, call_type, purpose, and goal
  const { data: promptData, error: promptError } = await supabase
    .from('prompts')
    .select('*')
    .eq('id', id)
    .single()
  
  if (promptError) {
    console.error('Failed to load prompt:', promptError)
  } else if (promptData) {
    selectedVoice.value = promptData.voice || 'alloy'
    vadThreshold.value = promptData.vad_threshold || 0.5
    vadPrefixPaddingMs.value = promptData.vad_prefix_padding_ms || 300
    vadSilenceDurationMs.value = promptData.vad_silence_duration_ms || 500
    currentPromptMetadata.value = {
      name: promptData.name,
      purpose: promptData.purpose || '',
      goal: promptData.goal || '',
      call_type: promptData.call_type
    }
  }
  
  // Reload versions for the selected prompt
  loading.value = true
  try {
    const { data, error: fetchError } = await supabase
      .from('prompt_versions')
      .select('*')
      .eq('prompt_id', id)
      .order('version_number', { ascending: false })

    if (fetchError) throw fetchError

    versions.value = data || []

    if (versions.value.length > 0) {
      const activeVersion = versions.value.find(v => v.is_active) || versions.value[0]
      await loadVersion(activeVersion.id)
    } else {
      // No versions for this prompt yet
      currentVersion.value = null
      performanceData.value = null
    }
  } catch (err) {
    error.value = err.message
    console.error('Failed to load versions for prompt:', err)
  } finally {
    loading.value = false
  }
}

async function createNewPrompt() {
  console.log('🆕 Create new prompt clicked')
  console.log('📊 showNewPromptModal BEFORE:', showNewPromptModal.value)
  // Reset form fields
  newPromptName.value = ''
  newPromptCategory.value = 'voice-assistant'
  showNewPromptModal.value = true
  console.log('📊 showNewPromptModal AFTER:', showNewPromptModal.value)
  
  // Debug: force a nextTick to ensure Vue has processed the change
  await nextTick()
  console.log('📊 showNewPromptModal after nextTick:', showNewPromptModal.value)
}

async function confirmCreatePrompt() {
  if (!newPromptName.value.trim()) return
  
  // Check for duplicate name before attempting insert
  const existingPrompt = prompts.value.find(
    p => p.name.toLowerCase() === newPromptName.value.trim().toLowerCase()
  )
  
  if (existingPrompt) {
    window.$message?.error('A prompt with this name already exists. Please choose a different name.')
    return
  }
  
  loading.value = true
  showNewPromptModal.value = false
  
  try {
    // 1. Create the new prompt
    const { data: newPrompt, error: promptError } = await supabase
      .from('prompts')
      .insert({
        name: newPromptName.value.trim(),
        category: newPromptCategory.value.trim(),
        voice: 'alloy',
        is_base_prompt: false,
        is_active: true
      })
      .select()
      .single()
    
    if (promptError) throw promptError
    
    // 2. Create v1 draft for the new prompt
    const { data: newVersion, error: versionError } = await supabase
      .from('prompt_versions')
      .insert({
        prompt_id: newPrompt.id,
        version_number: 1,
        content: {
          role: '',
          personality: '',
          context: '',
          pronunciation: '',
          tools: '',
          instructions: '',
          conversation_flow: '',
          output_format: '',
          safety: ''
        },
        variables: [],
        change_summary: 'Initial version',
        is_draft: true,
        is_active: false,
        created_by: 'Admin'
      })
      .select()
      .single()
    
    if (versionError) throw versionError
    
    // 3. Add to prompts list and select it
    prompts.value.push({
      id: newPrompt.id,
      name: newPrompt.name,
      category: newPrompt.category
    })
    
    activePromptId.value = newPrompt.id
    
    // 4. Reload versions and load the new v1 draft
    await loadVersions()
    
    window.$message?.success(`Prompt "${newPrompt.name}" created successfully!`)
  } catch (err) {
    console.error('❌ Error creating prompt:', err)
    showNewPromptModal.value = true // Re-open modal so user can fix the issue
    
    if (err.code === '23505') {
      error.value = 'A prompt with this name already exists. Please choose a different name.'
      window.$message?.error('A prompt with this name already exists. Please choose a different name.')
    } else {
      error.value = err.message
      window.$message?.error(`Failed to create prompt: ${err.message}`)
    }
  } finally {
    loading.value = false
  }
}

function markAsChanged() {
  hasChanges.value = true
}

function handleTextareaInput(key) {
  markAsChanged()
  autoResizeTextarea(key)
}

async function handleContentEditableInput(event, key) {
  console.log('Input detected on key:', key, 'hasChanges before:', hasChanges.value)
  
  // Convert <br> back to \n for storage
  const htmlContent = event.target.innerHTML
  const textContent = htmlContent.replace(/<br\s*\/?>/gi, '\n').replace(/<div>/gi, '\n').replace(/<\/div>/gi, '')
  currentVersion.value.content[key] = textContent
  markAsChanged()
  
  // Auto-resize the contenteditable div
  autoResizeTextarea(key)
  
  console.log('hasChanges after:', hasChanges.value)
}

function handleContentEditableBlur(event, key) {
  // Convert <br> back to \n for storage
  const htmlContent = event.target.innerHTML
  const textContent = htmlContent.replace(/<br\s*\/?>/gi, '\n').replace(/<div>/gi, '\n').replace(/<\/div>/gi, '')
  currentVersion.value.content[key] = textContent
}

function handleContentEditableKeydown(event, key) {
  if (event.key === 'Enter') {
    event.preventDefault()
    
    const selection = window.getSelection()
    if (!selection.rangeCount) return
    
    const range = selection.getRangeAt(0)
    
    // Insert a <br> element at the caret
    const br = document.createElement('br')
    range.insertNode(br)
    
    // Move cursor after the <br>
    range.setStartAfter(br)
    range.setEndAfter(br)
    range.collapse(true)
    
    // Update selection
    selection.removeAllRanges()
    selection.addRange(range)
    
    // Trigger input event to sync model and resize
    handleContentEditableInput({ target: event.target }, key)
    
    // Force immediate resize after DOM update
    requestAnimationFrame(() => {
      autoResizeTextarea(key)
    })
  }
}

function ensureTextareaMirror() {
  if (textareaMirror) return textareaMirror
  const mirror = document.createElement('div')
  mirror.setAttribute('aria-hidden', 'true')
  mirror.style.position = 'absolute'
  mirror.style.top = '-9999px'
  mirror.style.left = '-9999px'
  mirror.style.visibility = 'hidden'
  mirror.style.pointerEvents = 'none'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.wordWrap = 'break-word'
  mirror.style.overflowWrap = 'break-word'
  mirror.style.padding = '0'
  mirror.style.height = 'auto'
  mirror.style.minHeight = '0'
  mirror.style.zIndex = '-1'
  document.body.appendChild(mirror)
  textareaMirror = mirror
  return textareaMirror
}

function measureTextareaHeight(textarea) {
  const mirror = ensureTextareaMirror()
  const computed = window.getComputedStyle(textarea)

  const propertiesToCopy = [
    'boxSizing',
    'width',
    'paddingTop',
    'paddingBottom',
    'paddingLeft',
    'paddingRight',
    'borderTopWidth',
    'borderBottomWidth',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'lineHeight',
    'letterSpacing',
    'textTransform',
    'textIndent'
  ]

  propertiesToCopy.forEach(prop => {
    mirror.style[prop] = computed[prop]
  })

  mirror.style.width = textarea.offsetWidth + 'px'
  mirror.textContent = (textarea.value || textarea.placeholder || '') + '\n'

  const contentHeight = mirror.scrollHeight

  const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.35 || 18
  const paddingTop = parseFloat(computed.paddingTop) || 0
  const paddingBottom = parseFloat(computed.paddingBottom) || 0
  const borderTop = parseFloat(computed.borderTopWidth) || 0
  const borderBottom = parseFloat(computed.borderBottomWidth) || 0

  const minHeight = lineHeight * 3 + paddingTop + paddingBottom + borderTop + borderBottom
  const buffer = lineHeight

  return Math.max(contentHeight + buffer, minHeight)
}

function autoResizeTextarea(key, attempt = 0) {
  const textarea = textareaRefs.value[key]
  if (!textarea) return

  // Reset height to recalculate
  textarea.style.height = '0px'
  
  // Use scrollHeight directly + small buffer
  const scrollHeight = textarea.scrollHeight
  
  if (scrollHeight === 0 && attempt < 10) {
    requestAnimationFrame(() => autoResizeTextarea(key, attempt + 1))
    return
  }
  
  // Add just one line of buffer (approx 20px)
  textarea.style.height = `${scrollHeight + 20}px`
  textarea.style.overflowY = 'hidden'
}

async function resizeAllTextareas() {
  await nextTick()
  Object.keys(textareaRefs.value).forEach(key => autoResizeTextarea(key))
}

async function loadVersions() {
  loading.value = true
  error.value = ''
  try {
    // Load ALL prompts (not just base prompts)
    const { data: allPrompts, error: promptsError } = await supabase
      .from('prompts')
      .select('id, name, call_type, purpose, goal, is_base_prompt')
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (promptsError) throw promptsError

    if (!allPrompts || allPrompts.length === 0) {
      throw new Error('No prompts found. Create a prompt to get started.')
    }

    // Update prompts list
    prompts.value = allPrompts.map(p => ({
      id: p.id,
      name: p.name,
      call_type: p.call_type,
      purpose: p.purpose,
      goal: p.goal
    }))

    // Use the currently selected prompt, or default to first one
    const targetPromptId = activePromptId.value || allPrompts[0].id
    activePromptId.value = targetPromptId

    // Load versions for the active prompt
    const { data, error: fetchError } = await supabase
      .from('prompt_versions')
      .select('*')
      .eq('prompt_id', targetPromptId)
      .order('version_number', { ascending: false })

    if (fetchError) throw fetchError

    versions.value = data || []

    if (versions.value.length > 0) {
      const activeVersion = versions.value.find(v => v.is_active) || versions.value[0]
      await loadVersion(activeVersion.id)
    }
  } catch (err) {
    error.value = err.message
    console.error('Failed to load versions:', err)
  } finally {
    loading.value = false
  }
}

async function loadVersion(versionId) {
  // Check for unsaved changes before switching
  if (hasChanges.value) {
    const confirmed = window.confirm('You have unsaved changes. Do you want to save before switching versions?')
    if (confirmed) {
      await saveChanges()
    } else {
      // User chose not to save, discard changes
      hasChanges.value = false
    }
  }
  
  loading.value = true
  error.value = ''
  hasChanges.value = false

  try {
    const { data, error: fetchError } = await supabase
      .from('prompt_versions')
      .select('*')
      .eq('id', versionId)
      .single()

    if (fetchError) throw fetchError

    currentVersion.value = data
    // await loadPerformance(versionId) // TODO: Enable when performance table exists
    await nextTick()
    
    // Populate contenteditable divs with loaded content
    populateContentEditableDivs()
    
    resizeAllTextareas()
  } catch (err) {
    error.value = err.message
    console.error('Failed to load version:', err)
  } finally {
    loading.value = false
  }
}

async function loadPerformance(versionId) {
  try {
    const { data, error } = await supabase
      .from('prompt_version_performance')
      .select('*')
      .eq('version_id', versionId)
      .maybeSingle() // Use maybeSingle instead of single to handle missing table gracefully

    if (error) {
      console.warn('⚠️ Performance data not available:', error.message)
      performanceData.value = null
      return
    }

    performanceData.value = data || null
  } catch (err) {
    console.warn('⚠️ Failed to load performance data:', err)
    performanceData.value = null
  }
}

async function saveChanges() {
  if (!currentVersion.value) return
  loading.value = true
  
  try {
    // If editing an active version, create a new draft instead of updating it
    if (!currentVersion.value.is_draft) {
      // Find the highest version number
      const { data: versions, error: fetchError } = await supabase
        .from('prompt_versions')
        .select('version_number')
        .eq('prompt_id', currentVersion.value.prompt_id)
        .order('version_number', { ascending: false })
        .limit(1)
      
      if (fetchError) throw fetchError
      
      const nextVersionNumber = versions && versions[0] ? versions[0].version_number + 1 : 1
      
      // Create new draft version with current changes
      const { data: newVersion, error: insertError } = await supabase
        .from('prompt_versions')
        .insert({
          prompt_id: currentVersion.value.prompt_id,
          version_number: nextVersionNumber,
          content: currentVersion.value.content,
          variables: extractedVariables.value,
          change_summary: `Draft v${nextVersionNumber}`,
          is_draft: true,
          is_active: false,
          created_by: 'Admin'
        })
        .select()
        .single()
      
      if (insertError) throw insertError
      
      // Clear hasChanges BEFORE reloading to avoid triggering the unsaved changes popup
      hasChanges.value = false
      
      // Reload versions and switch to the new draft
      await loadVersions()
      if (newVersion) {
        await loadVersion(newVersion.id)
      }
    } else {
      // If already a draft, just update it
      const { error: updateError } = await supabase
        .from('prompt_versions')
        .update({
          content: currentVersion.value.content,
          variables: extractedVariables.value
        })
        .eq('id', currentVersion.value.id)

      if (updateError) throw updateError

      hasChanges.value = false
      
      // Reload to refresh the version card
      await loadVersions()
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function createNewVersion() {
  if (!currentVersion.value || versions.value.length === 0) return
  const summary = prompt('Enter a summary for this new version:')
  if (!summary) return
  loading.value = true
  try {
    const nextVersionNumber = (versions.value[0]?.version_number || 0) + 1
    const { data, error: insertError } = await supabase
      .from('prompt_versions')
      .insert({
        prompt_id: currentVersion.value.prompt_id,
        version_number: nextVersionNumber,
        content: currentVersion.value.content,
        variables: extractedVariables.value,
        change_summary: summary,
        is_draft: true,
        created_by: 'Admin'
      })
      .select()
      .single()

    if (insertError) throw insertError

    await loadVersions()
    await loadVersion(data.id)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function openPreviewModal() {
  showPreviewModal.value = true
}

async function openDeployModal() {
  if (!currentVersion.value) return
  
  // Check for unsaved changes before opening deploy modal
  if (hasChanges.value) {
    const confirmed = window.confirm('You have unsaved changes. Do you want to save before deploying?')
    if (confirmed) {
      await saveChanges()
    } else {
      // User chose not to save, discard changes
      hasChanges.value = false
    }
  }
  
  // Fetch the currently active version for comparison
  try {
    const { data: active, error: fetchError } = await supabase
      .from('prompt_versions')
      .select('*')
      .eq('prompt_id', currentVersion.value.prompt_id)
      .eq('is_active', true)
      .maybeSingle()
    
    if (fetchError) throw fetchError
    
    activeVersion.value = active
    
    // Generate diff for each section
    if (active) {
      diffSections.value = promptSections.map(section => {
        const oldText = active.content[section.key] || ''
        const newText = currentVersion.value.content[section.key] || ''
        
        const diff = Diff.diffWords(oldText, newText)
        
        return {
          key: section.key,
          label: section.label,
          diff: diff,
          hasChanges: diff.some(part => part.added || part.removed)
        }
      })
    } else {
      // No active version yet (first deployment)
      diffSections.value = []
    }
    
    showDeployModal.value = true
  } catch (err) {
    error.value = err.message
  }
}

// AI Improve functions
function openAIImprove(section) {
  aiImprovingSection.value = section
  aiUserRequest.value = ''
  aiSuggestion.value = ''
  aiChanges.value = []
  showAIImproveModal.value = true
}

function closeAIImprove() {
  showAIImproveModal.value = false
  aiImprovingSection.value = null
  aiUserRequest.value = ''
  aiSuggestion.value = ''
  aiChanges.value = []
}

function getSectionGuidelines(sectionKey) {
  const guidelines = {
    role: `ROLE & OBJECTIVE GUIDELINES:
- Define who Barbara is (voice assistant for Equity Connect)
- State the call scenario (${currentPromptMetadata.value.call_type})
- Define what success means for THIS specific call type
- Be specific about the domain (reverse mortgages, appointment booking)
- Keep to 2-3 sentences maximum
Example: "You are Barbara, a warm and professional voice assistant for Equity Connect. This is an INBOUND QUALIFIED call—caller is already in our system and likely pre-qualified. Your goal: skip unnecessary re-qualification if records are complete, provide brief equity snapshot, answer questions concisely, and book appointment with the assigned broker."`,

    personality: `PERSONALITY & TONE GUIDELINES (Critical for Realtime API):
- **Interrupt Handling**: "Stop talking IMMEDIATELY if caller starts speaking; resume naturally after they finish"
- **Response Length**: "Max 2 sentences per turn, aim for under 200 characters"
- **Conversational Fillers**: List natural sounds ("mm-hmm", "uh-huh", "got it", gentle breathing)
- **Number Format**: "Convert all numbers to WORDS (never say digits)"
- **Tone Quality**: Warm, calm, human—mirror their pace and energy
- **Confirmations**: "One-breath confirmations instead of long recaps"
- **Tool Latency**: "While tools run: use gentle filler phrases"
- **Silence Handling**: "If silence > 2s: soft micro-utterance; if > 5s: gentle re-prompt"
Example bullet format for clarity.`,

    context: `CONTEXT SECTION GUIDELINES:
- List ALL available {{variables}} organized by category
- Lead variables: {{leadFirstName}}, {{leadLastName}}, {{leadEmail}}, {{leadPhone}}, {{leadAge}}
- Property variables: {{propertyAddress}}, {{propertyCity}}, {{propertyState}}, {{estimatedEquity}}, etc.
- Broker variables: {{brokerFirstName}}, {{brokerCompany}}, {{brokerPhone}}
- Include guidance: "If any variable is empty or 'unknown', treat it as missing and gently ask only for what's needed"
- Group related variables together
- Explain what each category contains`,

    pronunciation: `PRONUNCIATION GUIDELINES:
- Phonetic spelling for tricky words
- Brand names and technical terms
- Always include: "Equity → 'EH-kwi-tee'"
- Always include: "NMLS → 'N-M-L-S' (spell out individual letters)"
- Number rules: "Always convert to words ('sixty-two' not '62')"
- Broker names: "Use natural pronunciation; if unsure, ask caller to confirm"
Keep it simple, bullet format.`,

    tools: `TOOLS SECTION GUIDELINES:
- List each available tool with description
- Format: "- tool_name: What it does and when to use it"
- Include timing expectations for tools
- Add note about fillers: "IMPORTANT: Talk naturally while tools are running. Use conversational fillers: 'just pulling that up', 'one sec', 'loading'"
- Common tools: get_lead_context, search_knowledge, check_broker_availability, book_appointment, save_interaction
- Keep descriptions concise but clear about purpose`,

    instructions: `INSTRUCTIONS & RULES GUIDELINES:
- Use numbered or bulleted list format
- Start with "CRITICAL RULES:"
- Include edge cases and error handling
- Qualification logic (if applicable)
- Compliance requirements
- What NOT to do
- When to transfer/escalate
Example format:
"CRITICAL RULES:
1. **Rule Name**: Explanation
2. **Another Rule**: Explanation"`,

    conversation_flow: `CONVERSATION FLOW GUIDELINES:
- Step-by-step dialogue structure
- Use section headers in ALL CAPS (GREETING & PURPOSE:, QUALIFICATION GATE:, etc.)
- Use arrows (→) for dialogue examples
- Include what to say at each step
- Add transition phrases between sections
- Show tool usage inline ("→ check_broker_availability (filler: 'One moment...')")
- Include re-evaluation loops if needed
- Natural progression from greeting → qualification → booking → closing
Example:
"GREETING:
→ 'Hi {{leadFirstName}}, this is Barbara with Equity Connect. How are you today?'
→ Brief rapport building"`,

    output_format: `OUTPUT FORMAT GUIDELINES:
- Specify response format requirements
- Natural phone conversation
- Numbers as words
- Ultra-short turns (under 200 chars)
- No special formatting in audio
- Conversational flow with micro-utterances
Keep this section brief and clear.`,

    safety: `SAFETY & ESCALATION GUIDELINES:
- List escalation triggers (when to transfer to human)
- Disqualification protocols with exact scripts
- Compliance reminders
- Format with clear sections:
  "ESCALATION TRIGGERS:
  - Distressed/angry caller
  - Legal questions beyond basics
  
  DISQUALIFICATION PROTOCOL:
  - Under 62: '[exact script]'
  
  COMPLIANCE:
  - No loan approval guarantees
  - Respect DNC/consent"`
  }
  
  return guidelines[sectionKey] || 'Follow OpenAI Realtime API best practices for voice conversations.'
}

function getQuickSuggestions(sectionKey) {
  const suggestions = {
    role: [
      'Make tone warmer and friendlier',
      'Add clarity about Barbara\'s purpose',
      'Optimize for elderly callers',
      'Make more concise'
    ],
    personality: [
      'Add more conversational fillers',
      'Improve interruption handling',
      'Make responses more concise',
      'Add senior-friendly pacing'
    ],
    instructions: [
      'Add error handling',
      'Improve qualification logic',
      'Add compliance guardrails',
      'Add edge case handling'
    ],
    conversation_flow: [
      'Expand greeting section',
      'Add smoother transitions',
      'Improve booking flow',
      'Add more natural dialogue'
    ],
    tools: [
      'Add tool usage examples',
      'Explain when to use each tool',
      'Add error handling for tools',
      'Add filler phrases while tools run'
    ],
    context: [
      'List all available variables',
      'Add variable usage examples',
      'Explain missing variable handling'
    ],
    pronunciation: [
      'Add more phonetic examples',
      'Include broker name guidance',
      'Add number pronunciation rules'
    ],
    output_format: [
      'Make more specific',
      'Add length guidelines',
      'Add formatting examples'
    ],
    safety: [
      'Add more escalation triggers',
      'Improve disqualification scripts',
      'Add compliance reminders'
    ]
  }
  
  return suggestions[sectionKey] || [
    'Make clearer',
    'Make more concise',
    'Add examples'
  ]
}

async function runAIImprove() {
  if (!aiUserRequest.value.trim() || !aiImprovingSection.value) return
  
  // Debug: Check if API key is loaded
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    window.$message?.error('OpenAI API key not found. Make sure VITE_OPENAI_API_KEY is in portal/.env.local and restart dev server.')
    return
  }
  console.log('API Key found:', apiKey.substring(0, 10) + '...') // Debug log (first 10 chars only)
  
  aiIsLoading.value = true
  
  try {
    // Build comprehensive system prompt with OpenAI Realtime API best practices
    const systemPrompt = `You are an expert prompt engineer specializing in OpenAI's Realtime API for voice conversations.

REFERENCE DOCUMENTATION:
You must follow best practices from:
- OpenAI Realtime API Guide: https://platform.openai.com/docs/guides/realtime
- OpenAI Cookbook: https://github.com/openai/openai-cookbook
- Realtime Examples: https://github.com/openai/openai-realtime-examples
- Internal Reference: docs/REALTIME_API_PROMPTING_REFERENCE.md

PROMPT YOU'RE IMPROVING:
- Name: ${currentPromptMetadata.value.name}
- Call Type: ${currentPromptMetadata.value.call_type}
- Purpose: ${currentPromptMetadata.value.purpose}
- Goal: ${currentPromptMetadata.value.goal}

SECTION: ${aiImprovingSection.value.label} (${aiImprovingSection.value.key})

CURRENT CONTENT:
${currentVersion.value.content[aiImprovingSection.value.key] || '(empty)'}

USER REQUEST: ${aiUserRequest.value}

SECTION-SPECIFIC GUIDELINES:
${getSectionGuidelines(aiImprovingSection.value.key)}

REQUIREMENTS:
1. Follow OpenAI Realtime API best practices (ultra-brief <200 chars, interrupt-friendly, numbers as words, tool fillers, micro-utterances)
2. Match the prompt's purpose (${currentPromptMetadata.value.purpose})
3. Align with the goal (${currentPromptMetadata.value.goal})
4. Preserve line breaks and formatting (bullets -, numbers 1., arrows →, ALL CAPS headers)
5. Use {{variableName}} syntax for template variables
6. Return ONLY the improved content (no explanations, no code blocks, just the raw text)

Provide the improved content now:`

    // Call OpenAI API with GPT-5 (best for prompt refinement)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a prompt-refinement assistant specializing in OpenAI Realtime API voice prompts. Maintain all original formatting, indentation, line breaks, and {{variables}} exactly. Follow Realtime API best practices: ultra-brief responses, interrupt-friendly design, numbers as words, tool latency fillers, micro-utterances.'
          },
          { 
            role: 'user', 
            content: systemPrompt 
          }
        ],
        max_completion_tokens: 4000 // Enough for longer sections
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      console.error('OpenAI API Error:', errorData)
      throw new Error(`API error: ${response.status} - ${errorData.error?.message || JSON.stringify(errorData)}`)
    }
    
    const data = await response.json()
    aiSuggestion.value = data.choices[0].message.content
    
    // Generate simple change summary (you could make this more sophisticated)
    aiChanges.value = [
      `Applied user request: "${aiUserRequest.value}"`,
      'AI improved the content based on prompt engineering best practices',
      'Review carefully before accepting'
    ]
    
  } catch (error) {
    console.error('AI improve error:', error)
    window.$message?.error('Failed to improve with AI. Please try again.')
  } finally {
    aiIsLoading.value = false
  }
}

function acceptAISuggestion() {
  if (!aiSuggestion.value || !aiImprovingSection.value) return
  
  // Update the current version content
  currentVersion.value.content[aiImprovingSection.value.key] = aiSuggestion.value
  
  // Update the textarea
  nextTick(() => {
    populateContentEditableDivs()
    markAsChanged()
  })
  
  // Close modal
  closeAIImprove()
  
  window.$message?.success('AI improvements applied! Don\'t forget to save.')
}

// Audit functions
function openAuditModal() {
  // Reset audit state
  auditAnswers.value = {
    problem: '',
    targetProfile: '',
    conversionGoal: '',
    knownIssues: '',
    tone: '',
    edgeCases: ''
  }
  auditResults.value = {
    score: 0,
    strengths: [],
    weaknesses: [],
    criticalIssues: [],
    recommendations: []
  }
  showAuditQuestionsModal.value = true
}

function closeAuditQuestions() {
  showAuditQuestionsModal.value = false
}

function closeAuditResults() {
  showAuditResultsModal.value = false
}

async function runAudit() {
  if (!currentVersion.value) return
  
  auditIsLoading.value = true
  
  try {
    // Debug: Check if API key is loaded
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey) {
      window.$message?.error('OpenAI API key not found. Make sure VITE_OPENAI_API_KEY is in portal/.env.local and restart dev server.')
      return
    }
    
    // Build comprehensive audit prompt
    const fullPromptContent = Object.entries(currentVersion.value.content)
      .map(([key, value]) => `### ${key.toUpperCase()}\n${value || '(empty)'}`)
      .join('\n\n')
    
    const auditPrompt = `You are an expert prompt engineer conducting a comprehensive audit of a voice AI prompt for OpenAI's Realtime API.

PROMPT METADATA:
- Name: ${currentPromptMetadata.value.name}
- Call Type: ${currentPromptMetadata.value.call_type}
- Purpose: ${currentPromptMetadata.value.purpose}
- Goal: ${currentPromptMetadata.value.goal}

CONTEXT FROM USER:
- Problem to solve: ${auditAnswers.value.problem}
- Target lead profile: ${auditAnswers.value.targetProfile}
- Conversion goal: ${auditAnswers.value.conversionGoal}
- Known issues: ${auditAnswers.value.knownIssues}
- Desired tone: ${auditAnswers.value.tone}
- Edge cases to handle: ${auditAnswers.value.edgeCases}

FULL PROMPT CONTENT:
${fullPromptContent}

EVALUATION CRITERIA:
1. OpenAI Realtime API Best Practices (ultra-brief responses <200 chars, interrupt-friendly, numbers as words, tool latency fillers, micro-utterances)
2. Consistency across all sections (tone, terminology, flow)
3. Alignment with stated purpose and conversion goal
4. Handling of target profile and edge cases
5. Variable usage and syntax correctness
6. Completeness (missing critical elements)
7. Known issues addressed

REQUIRED OUTPUT FORMAT (MUST BE VALID JSON):
{
  "score": <number 0-100>,
  "strengths": ["strength 1", "strength 2", ...],
  "weaknesses": ["weakness 1", "weakness 2", ...],
  "criticalIssues": ["critical issue 1", "critical issue 2", ...],
  "recommendations": [
    {
      "section": "section_key",
      "priority": "critical|high|medium|low",
      "issue": "What's wrong",
      "suggestion": "Improved version of the content",
      "reasoning": "Why this change matters"
    }
  ]
}

Provide your comprehensive evaluation now as valid JSON:`

    // Call OpenAI API with GPT-5 (best for comprehensive analysis)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-5',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert prompt engineer specializing in OpenAI Realtime API voice prompts. You conduct thorough audits and provide actionable recommendations. Always return valid JSON in the exact format requested.'
          },
          { 
            role: 'user', 
            content: auditPrompt 
          }
        ],
        max_completion_tokens: 8000, // Need more tokens for comprehensive audit
        response_format: { type: 'json_object' }
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      console.error('OpenAI API Error:', errorData)
      throw new Error(`API error: ${response.status} - ${errorData.error?.message || JSON.stringify(errorData)}`)
    }
    
    const data = await response.json()
    const auditData = JSON.parse(data.choices[0].message.content)
    
    // Store results
    auditResults.value = {
      score: auditData.score || 0,
      strengths: auditData.strengths || [],
      weaknesses: auditData.weaknesses || [],
      criticalIssues: auditData.criticalIssues || [],
      recommendations: auditData.recommendations || []
    }
    
    // Close questions modal and open results modal
    showAuditQuestionsModal.value = false
    showAuditResultsModal.value = true
    
  } catch (error) {
    console.error('Audit error:', error)
    window.$message?.error('Failed to run audit. Please try again.')
  } finally {
    auditIsLoading.value = false
  }
}

function applyAuditRecommendation(recommendation) {
  if (!recommendation.section || !recommendation.suggestion) return
  
  // Update the current version content with the recommendation
  currentVersion.value.content[recommendation.section] = recommendation.suggestion
  
  // Update the textarea
  nextTick(() => {
    populateContentEditableDivs()
    markAsChanged()
  })
  
  window.$message?.success(`Applied recommendation to ${recommendation.section}. Don't forget to save.`)
}

async function confirmDeploy() {
  if (!currentVersion.value || !deployChangeSummary.value.trim()) return
  
  showDeployModal.value = false
  loading.value = true
  
  try {
    const versionId = currentVersion.value.id
    const promptId = currentVersion.value.prompt_id
    
    // 1. Deactivate all other versions
    await supabase
      .from('prompt_versions')
      .update({ is_active: false })
      .eq('prompt_id', promptId)

    // 2. Mark current version as active (not draft) with change summary
    const { error: updateError } = await supabase
      .from('prompt_versions')
      .update({ 
        is_active: true, 
        is_draft: false,
        change_summary: deployChangeSummary.value.trim()
      })
      .eq('id', versionId)

    if (updateError) throw updateError

    // 3. Update the current version object immediately for UI responsiveness
    currentVersion.value.is_active = true
    currentVersion.value.is_draft = false
    currentVersion.value.change_summary = deployChangeSummary.value.trim()
    
    // 4. Update the versions list to reflect the change
    const versionIndex = versions.value.findIndex(v => v.id === versionId)
    if (versionIndex !== -1) {
      versions.value[versionIndex].is_active = true
      versions.value[versionIndex].is_draft = false
      versions.value[versionIndex].change_summary = deployChangeSummary.value.trim()
      
      // Mark all other versions as inactive in the UI
      versions.value.forEach((v, idx) => {
        if (idx !== versionIndex) {
          v.is_active = false
        }
      })
    }

    // 5. Clear the deploy change summary
    deployChangeSummary.value = ''

    // 6. Force reactivity update
    versions.value = [...versions.value]
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function createDraftFromActive() {
  if (!currentVersion.value || currentVersion.value.is_draft) return
  
  // Check if a draft already exists
  const { data: existingDraft } = await supabase
    .from('prompt_versions')
    .select('id')
    .eq('prompt_id', currentVersion.value.prompt_id)
    .eq('is_draft', true)
    .maybeSingle()
  
  if (existingDraft) {
    // Switch to existing draft instead of creating new one
    await loadVersion(existingDraft.id)
    return
  }
  
  loading.value = true
  
  try {
    // Find the highest version number
    const { data: versions, error: fetchError } = await supabase
      .from('prompt_versions')
      .select('version_number')
      .eq('prompt_id', currentVersion.value.prompt_id)
      .order('version_number', { ascending: false })
      .limit(1)
    
    if (fetchError) throw fetchError
    
    const nextVersionNumber = versions && versions[0] ? versions[0].version_number + 1 : 1
    
    // Create new draft version based on current active version
    const { data: newVersion, error: insertError } = await supabase
      .from('prompt_versions')
      .insert({
        prompt_id: currentVersion.value.prompt_id,
        version_number: nextVersionNumber,
        content: currentVersion.value.content,
        variables: extractedVariables.value,
        change_summary: `Draft v${nextVersionNumber}`,
        is_draft: true,
        is_active: false,
        created_by: 'Admin'
      })
      .select()
      .single()
    
    if (insertError) throw insertError
    
    // Reload and switch to new draft
    await loadVersions()
    if (newVersion) {
      await loadVersion(newVersion.id)
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getCallTypeIcon(callType) {
  const iconMap = {
    'inbound-qualified': CallOutline,
    'inbound-unqualified': CallOutline,
    'outbound-warm': PhonePortraitOutline,
    'outbound-cold': PhonePortraitOutline,
    'transfer': SwapHorizontalOutline,
    'callback': TimeOutline,
    'broker-schedule-check': CalendarOutline,
    'broker-connect-appointment': PeopleOutline,
    'fallback': ShieldCheckmarkOutline
  }
  return iconMap[callType] || CallOutline
}

function getCallTypeShort(callType) {
  const shortMap = {
    'inbound-qualified': 'In-Qual',
    'inbound-unqualified': 'In-New',
    'outbound-warm': 'Out-Warm',
    'outbound-cold': 'Out-Cold',
    'transfer': 'Transfer',
    'callback': 'Callback',
    'broker-schedule-check': 'Broker-Sched',
    'broker-connect-appointment': 'Broker-Appt',
    'fallback': 'Fallback'
  }
  return shortMap[callType] || callType
}

function getCallTypeLabel(callType) {
  const labelMap = {
    'inbound-qualified': 'Inbound - Qualified (Returning Lead)',
    'inbound-unqualified': 'Inbound - Unqualified (New Lead)',
    'outbound-warm': 'Outbound - Warm (Follow-up)',
    'outbound-cold': 'Outbound - Cold (First Touch)',
    'transfer': 'Transfer/Handoff',
    'callback': 'Scheduled Callback',
    'broker-schedule-check': 'Broker - Schedule Check',
    'broker-connect-appointment': 'Broker - Connect for Appointment',
    'fallback': 'Emergency Fallback'
  }
  return labelMap[callType] || callType
}

function formatVariable(variable) {
  return `{{${variable}}}`
}

function insertExample(guideKey) {
  if (!currentVersion.value) return
  
  const guide = guideContent.find(g => g.key === guideKey)
  if (!guide || !guide.example) return
  
  // Insert the example into the corresponding prompt section
  currentVersion.value.content[guideKey] = guide.example
  
  // Mark as changed
  hasChanges.value = true
  
  // Switch to editor tab and expand that section
  activeTab.value = 'editor'
  if (!expandedSections.value.includes(guideKey)) {
    expandedSections.value.push(guideKey)
  }
}

async function copyVariable(variableKey) {
  const variableText = `{{${variableKey}}}`
  try {
    await navigator.clipboard.writeText(variableText)
    // Could add a toast notification here
    console.log(`Copied: ${variableText}`)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

function insertVariableIntoSection(sectionKey, variableKey) {
  if (!currentVersion.value) return
  
  const textarea = textareaRefs.value[sectionKey]
  if (!textarea) return
  
  const variableText = `{{${variableKey}}}`
  
  // Get current content
  const currentContent = currentVersion.value.content[sectionKey] || ''
  
  // Try to insert at cursor position for contenteditable
  const selection = window.getSelection()
  if (selection && selection.rangeCount > 0 && textarea.contains(selection.anchorNode)) {
    const range = selection.getRangeAt(0)
    range.deleteContents()
    const textNode = document.createTextNode(variableText)
    range.insertNode(textNode)
    range.setStartAfter(textNode)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    
    // Update the model
    currentVersion.value.content[sectionKey] = textarea.innerText
  } else {
    // Fallback: append to end
    currentVersion.value.content[sectionKey] = currentContent + (currentContent ? ' ' : '') + variableText
    
    // Update the textarea
    nextTick(() => {
      textarea.innerText = currentVersion.value.content[sectionKey]
    })
  }
  
  markAsChanged()
}

function insertToolIntoPrompt(tool) {
  if (!currentVersion.value) return
  
  // Format: - tool_name: description
  const toolText = `- ${tool.name}: ${tool.desc}`
  
  const toolsContent = currentVersion.value.content['tools'] || ''
  
  // Add tool to the Tools section (each tool on a new line)
  currentVersion.value.content['tools'] = toolsContent + (toolsContent ? '\n' : '') + toolText
  
  // Update the textarea if it exists
  const textarea = textareaRefs.value['tools']
  if (textarea) {
    nextTick(() => {
      textarea.innerText = currentVersion.value.content['tools']
    })
  }
  
  // Switch to Editor tab and expand Tools section
  activeTab.value = 'editor'
  if (!expandedSections.value.includes('tools')) {
    expandedSections.value.push('tools')
  }
  
  markAsChanged()
}

async function handleVoiceChange(voice) {
  if (!activePromptId.value) return
  
  loading.value = true
  try {
    const { error: updateError } = await supabase
      .from('prompts')
      .update({ voice })
      .eq('id', activePromptId.value)
    
    if (updateError) throw updateError
    
    window.$message?.success(`Voice updated to ${voice}`)
  } catch (err) {
    error.value = err.message
    window.$message?.error('Failed to update voice')
    console.error('Failed to update voice:', err)
  } finally {
    loading.value = false
  }
}

// VAD Settings Handlers
async function handleVadThresholdChange(value) {
  if (!activePromptId.value) return
  
  try {
    const { error: updateError } = await supabase
      .from('prompts')
      .update({ vad_threshold: value })
      .eq('id', activePromptId.value)
    
    if (updateError) throw updateError
  } catch (err) {
    console.error('Failed to update VAD threshold:', err)
    window.$message?.error('Failed to save VAD threshold')
  }
}

async function handleVadPrefixPaddingChange(value) {
  if (!activePromptId.value) return
  
  try {
    const { error: updateError } = await supabase
      .from('prompts')
      .update({ vad_prefix_padding_ms: value })
      .eq('id', activePromptId.value)
    
    if (updateError) throw updateError
  } catch (err) {
    console.error('Failed to update VAD prefix padding:', err)
    window.$message?.error('Failed to save VAD prefix padding')
  }
}

async function handleVadSilenceDurationChange(value) {
  if (!activePromptId.value) return
  
  try {
    const { error: updateError } = await supabase
      .from('prompts')
      .update({ vad_silence_duration_ms: value })
      .eq('id', activePromptId.value)
    
    if (updateError) throw updateError
  } catch (err) {
    console.error('Failed to update VAD silence duration:', err)
    window.$message?.error('Failed to save VAD silence duration')
  }
}

async function resetVadToDefaults() {
  if (!activePromptId.value) return
  
  // Reset local values
  vadThreshold.value = 0.5
  vadPrefixPaddingMs.value = 300
  vadSilenceDurationMs.value = 500
  
  // Save to database
  try {
    const { error: updateError } = await supabase
      .from('prompts')
      .update({
        vad_threshold: 0.5,
        vad_prefix_padding_ms: 300,
        vad_silence_duration_ms: 500
      })
      .eq('id', activePromptId.value)
    
    if (updateError) throw updateError
    
    window.$message?.success('VAD settings reset to defaults')
  } catch (err) {
    console.error('Failed to reset VAD settings:', err)
    window.$message?.error('Failed to reset VAD settings')
  }
}

function insertToolFromDropdown(toolKey) {
  // Check if "Add All Tools" was clicked
  if (toolKey === 'ADD_ALL_TOOLS') {
    addAllTools()
    return
  }
  
  // Find the tool data
  const allTools = [
    ...availableTools.lead,
    ...availableTools.knowledge,
    ...availableTools.broker,
    ...availableTools.appointment,
    ...availableTools.tracking
  ]
  
  const tool = allTools.find(t => t.key === toolKey)
  if (!tool) return
  
  insertToolIntoPrompt(tool)
}

function addAllTools() {
  if (!currentVersion.value) return
  
  // Get all tools
  const allTools = [
    ...availableTools.lead,
    ...availableTools.knowledge,
    ...availableTools.broker,
    ...availableTools.appointment,
    ...availableTools.tracking
  ]
  
  // Format all tools as a list
  const toolsList = allTools.map(tool => `- ${tool.name}: ${tool.desc}`).join('\n')
  
  // Set the Tools section content
  currentVersion.value.content['tools'] = toolsList
  
  // Switch to Editor tab first
  activeTab.value = 'editor'
  
  // Expand Tools section if not already expanded
  if (!expandedSections.value.includes('tools')) {
    expandedSections.value.push('tools')
  }
  
  // Wait for section to expand, then directly update textarea
  setTimeout(() => {
    const textarea = textareaRefs.value['tools']
    if (textarea) {
      textarea.innerText = currentVersion.value.content['tools']
    }
  }, 400)
  
  markAsChanged()
}

// Removed: watch(() => currentVersion.value?.content, () => resizeAllTextareas(), { deep: true })
// This was causing hasChanges to be reset because it triggers on every keystroke
watch([promptsCollapsed, versionsCollapsed], () => resizeAllTextareas())

// Helper function to populate contenteditable divs
function populateContentEditableDivs() {
  if (!currentVersion.value) return
  
  nextTick(() => {
    // Populate all contenteditable divs with the loaded version content
    Object.keys(textareaRefs.value).forEach(key => {
      const textarea = textareaRefs.value[key]
      if (textarea && currentVersion.value.content[key] !== undefined) {
        const rawContent = currentVersion.value.content[key] || ''
        // Convert \n to <br> for HTML rendering, preserve the raw text structure
        const htmlContent = rawContent.replace(/\n/g, '<br>')
        
        // Only update if content is different to avoid cursor reset
        if (textarea.innerHTML !== htmlContent) {
          textarea.innerHTML = htmlContent
        }
      }
    })
  })
}

// Watch for version changes and manually update contenteditable divs (avoid v-html reactivity issues)
watch(() => currentVersion.value?.id, () => {
  populateContentEditableDivs()
})

// Sync guide expanded sections with editor when switching to Guide tab
watch(activeTab, (newTab, oldTab) => {
  if (newTab === 'guide' && oldTab === 'editor') {
    // Only open the guide sections that are currently expanded in the editor
    guideExpandedSections.value = [...expandedSections.value]
  }
  
  if (newTab === 'editor' && oldTab === 'guide') {
    // Restore editor sections from guide if user was browsing guide
    // Keep whatever was expanded in editor before
  }
})

function handleWindowResize() {
  resizeAllTextareas()
}

function getTrackElements(refEl) {
  const container = refEl?.value
  if (!container) return { container: null, content: null }
  const content = container.querySelector('.meta-list')
  return { container, content }
}

const SCROLL_STEP = 220
const EPSILON = 2

// Scroll functions for prompts and versions
function scrollPrompts(direction) {
  console.log('🔄 scrollPrompts called, direction:', direction)
  const { container } = getTrackElements(promptsTrack)
  if (!container) {
    console.log('❌ prompts container not found')
    return
  }
  const maxScroll = Math.max(container.scrollWidth - container.clientWidth, 0)
  const proposed = container.scrollLeft + direction * SCROLL_STEP
  const next = Math.min(Math.max(proposed, 0), maxScroll)
  container.scrollTo({ left: next, behavior: 'smooth' })
}

function scrollVersions(direction) {
  console.log('🔄 scrollVersions called, direction:', direction)
  const { container } = getTrackElements(versionsTrack)
  if (!container) {
    console.log('❌ versions container not found')
    return
  }
  const maxScroll = Math.max(container.scrollWidth - container.clientWidth, 0)
  const proposed = container.scrollLeft + direction * SCROLL_STEP
  const next = Math.min(Math.max(proposed, 0), maxScroll)
  container.scrollTo({ left: next, behavior: 'smooth' })
}

function handlePromptsScroll(e) {
  const container = e.target
  const overflow = container.scrollWidth - container.clientWidth
  canScrollPromptsLeft.value = container.scrollLeft > EPSILON
  canScrollPromptsRight.value = overflow - container.scrollLeft > EPSILON
}

function handleVersionsScroll(e) {
  const container = e.target
  const overflow = container.scrollWidth - container.clientWidth
  canScrollVersionsLeft.value = container.scrollLeft > EPSILON
  canScrollVersionsRight.value = overflow - container.scrollLeft > EPSILON
}

// Check scroll state on mount and after data changes
function updateScrollStates() {
  nextTick(() => {
    console.log('🔍 updateScrollStates called')
    const { container: promptsContainer, content: promptsContent } = getTrackElements(promptsTrack)
    if (promptsContainer && promptsContent) {
      const overflow = promptsContent.scrollWidth - promptsContainer.clientWidth
      canScrollPromptsLeft.value = promptsContainer.scrollLeft > EPSILON
      canScrollPromptsRight.value = overflow - promptsContainer.scrollLeft > EPSILON
      console.log('✅ Prompts scroll state - Left:', canScrollPromptsLeft.value, 'Right:', canScrollPromptsRight.value)
    }

    const { container: versionsContainer, content: versionsContent } = getTrackElements(versionsTrack)
    if (versionsContainer && versionsContent) {
      const overflow = versionsContent.scrollWidth - versionsContainer.clientWidth
      canScrollVersionsLeft.value = versionsContainer.scrollLeft > EPSILON
      canScrollVersionsRight.value = overflow - versionsContainer.scrollLeft > EPSILON
      console.log('✅ Versions scroll state - Left:', canScrollVersionsLeft.value, 'Right:', canScrollVersionsRight.value)
    }
  })
}

async function loadPrompts() {
  console.log('🔍 Loading prompts from database...')
  loading.value = true
  try {
    const { data, error: fetchError } = await supabase
      .from('prompts')
      .select('*')
    
    if (fetchError) {
      console.error('❌ Error loading prompts:', fetchError)
      throw fetchError
    }
    
    console.log('📦 Raw prompts data:', data)
    
    // Custom sort order for call types (left to right in UI)
    const callTypeOrder = {
      'inbound-qualified': 1,
      'inbound-unqualified': 2,
      'outbound-warm': 3,
      'outbound-cold': 4,
      'transfer': 5,
      'callback': 6,
      'broker-schedule-check': 7,
      'broker-connect-appointment': 8,
      'fallback': 9
    }
    
    prompts.value = (data || []).sort((a, b) => {
      return (callTypeOrder[a.call_type] || 99) - (callTypeOrder[b.call_type] || 99)
    })
    
    console.log('✅ Loaded prompts:', prompts.value.length, prompts.value)
    
    // Auto-select first prompt if available
    if (prompts.value.length > 0 && !activePromptId.value) {
      console.log('👉 Auto-selecting first prompt:', prompts.value[0].name)
      await selectPrompt(prompts.value[0].id)
    }
  } catch (err) {
    error.value = err.message
    console.error('❌ Failed to load prompts:', err)
    window.$message?.error('Failed to load prompts: ' + err.message)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadPrompts()
  loadVersions()
  window.addEventListener('resize', handleWindowResize)
  
  // Warn before leaving page with unsaved changes
  window.addEventListener('beforeunload', handleBeforeUnload)
  
  // Update scroll states after initial load (multiple attempts to ensure DOM is ready)
  setTimeout(updateScrollStates, 500)
  setTimeout(updateScrollStates, 1000)
  setTimeout(updateScrollStates, 2000)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize)
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

function handleBeforeUnload(e) {
  if (hasChanges.value) {
    e.preventDefault()
    e.returnValue = '' // Required for Chrome
    return '' // Required for some browsers
  }
}
</script>

<style scoped>
.prompt-workspace {
  display: grid;
  grid-template-columns: minmax(300px, 1fr) minmax(250px, 0.8fr) minmax(0, 2fr);
  gap: 1rem;
  align-items: start;
  padding-left: 0;
  max-width: 100%;
}

.meta-card {
  background: rgba(255, 255, 255, 0.92);
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  box-shadow: 0 10px 25px -22px rgba(15, 23, 42, 0.16);
  padding: 0.55rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  align-items: flex-start;
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  height: fit-content;
  min-width: 0;
}

.meta-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  font-weight: 600;
  color: #1f2937;
}

.meta-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.meta-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: transparent;
  font-size: 1.05rem;
}

.meta-title {
  font-size: 0.78rem;
}

.meta-action {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  border: none;
  background: transparent;
  font-size: 0.75rem;
  color: #64748b;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.meta-action:disabled {
  opacity: 0.4;
  cursor: default;
}

.meta-action:not(:disabled):hover {
  background: rgba(99, 102, 241, 0.12);
}

.meta-list-container {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

.scroll-arrow {
  flex-shrink: 0;
  width: 32px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  color: #6366f1;
  padding: 0;
}

.scroll-arrow:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.scroll-arrow:not(:disabled):hover {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.3);
}


.meta-list-track {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  display: block;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.meta-list-track::-webkit-scrollbar {
  display: none;
}

.meta-list-wrapper {
  overflow-x: auto;
  overflow-y: hidden;
  width: 100%;
}

.meta-list-wrapper::-webkit-scrollbar {
  height: 6px;
}

.meta-list-wrapper::-webkit-scrollbar-track {
  background: transparent;
}

.meta-list-wrapper::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.3);
  border-radius: 3px;
}

.meta-list-wrapper::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.5);
}

.meta-list {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0.45rem;
  padding: 0.35rem 0;
  width: max-content;
}

.meta-item,
.meta-item.version {
  flex-shrink: 0;
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 12px;
  padding: 0.45rem 1.1rem;
  background: rgba(255, 255, 255, 0.92);
  font-size: 0.62rem;
  color: #1f2937;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.1rem;
  transition: border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
  min-width: 180px;
  width: 180px;
  height: 60px;
  scroll-snap-align: start;
  box-shadow: 0 8px 18px -18px rgba(15, 23, 42, 0.22);
  overflow: hidden;
}

.meta-item.active {
  border-color: rgba(99, 102, 241, 0.65);
  background: rgba(99, 102, 241, 0.15);
}

.meta-item:hover {
  border-color: rgba(99, 102, 241, 0.55);
  background: rgba(99, 102, 241, 0.1);
}

.meta-item:not(.version) {
  align-items: center;
  text-align: center;
}

.meta-item:not(.version) .meta-item-title {
  width: 100%;
}

.meta-item-title {
  font-weight: 600;
  justify-self: start;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta-item-sub {
  grid-area: summary;
  color: #64748b;
  font-size: 0.58rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  line-height: 1.2;
}

.meta-badge {
  display: inline-block;
  padding: 2px 0;
  margin-top: 4px;
  font-size: 0.55rem;
  font-weight: 500;
  color: #4f46e5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.meta-item:not(.version) .meta-item-sub {
  text-align: center;
}

.meta-item.version .meta-item-sub {
  text-align: left;
}

.version-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
}

.version-row .meta-item-title {
  font-weight: 700;
  font-size: 0.9rem;
  min-width: 0;
  color: #1e293b;
}

.meta-date {
  font-size: 0.62rem;
  color: #94a3b8;
  white-space: nowrap;
}

.meta-status {
  background: rgba(34, 197, 94, 0.15);
  color: #15803d;
  border-radius: 999px;
  padding: 0 0.35rem;
  font-size: 0.6rem;
  font-weight: 600;
  white-space: nowrap;
}

.meta-status.draft {
  background: rgba(250, 204, 21, 0.2);
  color: #92400e;
}

.editor-pane {
  min-width: 0;
}

.editor-card {
  border-radius: 14px;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 40px -28px rgba(15, 23, 42, 0.22);
  gap: 0.8rem;
}

.editor-card :deep(.n-tabs-nav) {
  padding-left: 0;
  margin-left: -10px;
}

.compact-toolbar {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: flex-start;
  padding-left: 0;
  margin-left: -20px;
  margin-top: -1rem;
  margin-bottom: 0.5rem;
}

.compact-toolbar :deep(.n-button) {
  min-width: 90px;
  padding: 0 0.6rem;
  border-radius: 8px !important;
  border: 1px solid rgba(99, 102, 241, 0.3) !important;
}

.compact-toolbar :deep(.n-button:hover) {
  border-color: rgba(99, 102, 241, 0.5) !important;
}

.compact-toolbar :deep(.n-button:disabled) {
  border-color: rgba(148, 163, 184, 0.2) !important;
}

.editor-sections {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
  color: #1f2937;
  font-size: 0.78rem;
}

.required {
  color: #ef4444;
}

.info-icon {
  color: #6366f1;
  cursor: pointer;
}

.variable-trigger {
  margin-left: auto;
  color: #6366f1;
}

.variable-trigger:hover {
  color: #4f46e5;
}

.ai-improve-trigger {
  color: #f59e0b;
  background: transparent;
  transition: all 0.2s ease;
}

.ai-improve-trigger:hover {
  color: #ea580c;
  background: transparent;
  transform: scale(1.2);
}

.ai-audit-btn :deep(.n-icon) {
  color: #f59e0b !important;
}

.ai-context-info {
  padding: 1rem;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(99, 102, 241, 0.05));
  border-radius: 8px;
  border: 1px solid rgba(139, 92, 246, 0.15);
}

.quick-suggestions {
  margin-top: 1rem;
}

.quick-suggestions .n-tag:hover {
  background: rgba(99, 102, 241, 0.15) !important;
  transform: translateY(-1px);
}

.notion-textarea {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.32);
  border-radius: 8px;
  padding: 0.5rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  line-height: 1.6;
  background: rgba(248, 250, 255, 0.82);
  transition: border 160ms ease, box-shadow 160ms ease;
  box-sizing: border-box;
  min-height: 60px;
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* Better spacing for line breaks in contenteditable */
.notion-textarea br {
  display: block;
  content: "";
  margin: 0.25rem 0;
}

.notion-textarea:empty:before {
  content: attr(data-placeholder);
  color: #9ca3af;
  pointer-events: none;
}

.notion-textarea:focus {
  outline: none;
  border-color: rgba(99, 102, 241, 0.65);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
}

.metrics-wrapper {
  padding-top: 1rem;
}

.tab-content {
  padding: 1rem 0;
}

.settings-section {
  max-width: 600px;
}

.settings-section h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
}

.variables-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.variables-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.variables-section h3 {
  font-size: 0.95rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.variables-section .text-muted {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0;
}

.variables-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding-top: 0.4rem;
}

.variable-category {
  margin-bottom: 1.5rem;
}

.variable-category h4 {
  font-size: 0.8rem;
  font-weight: 600;
  color: #4b5563;
  margin: 0 0 0.5rem 0;
}

.variable-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.5rem;
}

.variable-item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.5rem 0.75rem;
  background: rgba(248, 250, 255, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 8px;
  cursor: pointer;
  transition: all 160ms ease;
}

.variable-item:hover {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.45);
}

.variable-name {
  font-family: 'Fira Code', monospace;
  font-size: 0.72rem;
  color: #4f46e5;
  font-weight: 600;
}

.variable-desc {
  font-size: 0.68rem;
  color: #6b7280;
}

.empty-state {
  margin: 2.5rem 0;
}

.preview-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.preview-section-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.preview-section-content {
  background: rgba(248, 250, 255, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 8px;
  padding: 0.75rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  line-height: 1.5;
  color: #1f2937;
  white-space: pre-wrap;
  margin: 0;
}

.deploy-warning {
  padding: 0.75rem;
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 8px;
  color: #92400e;
  margin-bottom: 1rem;
}

.deploy-info {
  padding: 0.75rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 8px;
  color: #1e40af;
  margin-bottom: 1rem;
}

.modal-footer {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

/* Force modal visibility */
.n-modal-container {
  z-index: 10000 !important;
}

.n-modal-mask {
  z-index: 9999 !important;
}

.n-modal-body-wrapper {
  z-index: 10001 !important;
}

.diff-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.diff-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.changed-badge {
  margin-left: 0.5rem;
  font-size: 0.65rem;
  font-weight: 500;
  color: #f59e0b;
  background: rgba(251, 191, 36, 0.15);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
}

.diff-text {
  background: rgba(248, 250, 255, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 8px;
  padding: 0.75rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.diff-added {
  background: rgba(16, 185, 129, 0.2);
  color: #065f46;
  padding: 0.1rem 0.2rem;
  border-radius: 3px;
}

.diff-removed {
  background: rgba(239, 68, 68, 0.2);
  color: #991b1b;
  text-decoration: line-through;
  padding: 0.1rem 0.2rem;
  border-radius: 3px;
}

.diff-unchanged {
  color: #1f2937;
}

.guide-content {
  padding: 0.5rem 0;
}

.guide-section {
  font-size: 0.8rem;
  line-height: 1.5;
}

.guide-purpose {
  margin-bottom: 1rem;
  color: #4b5563;
}

.guide-subsection {
  margin-bottom: 1.5rem;
}

.guide-example-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.guide-example-header h4 {
  font-size: 0.85rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.guide-subsection h4 {
  font-size: 0.85rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.guide-subsection ul {
  margin: 0;
  padding-left: 1.5rem;
  color: #4b5563;
}

.guide-subsection li {
  margin-bottom: 0.35rem;
}

.guide-example {
  background: rgba(248, 250, 255, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 8px;
  padding: 0.75rem;
  font-family: 'Fira Code', monospace;
  font-size: 0.72rem;
  line-height: 1.5;
  color: #1f2937;
  overflow-x: auto;
  white-space: pre-wrap;
}

@media (max-width: 1280px) {
  .prompt-workspace {
    grid-template-columns: 220px 240px 1fr;
  }
}

@media (max-width: 1100px) {
  .prompt-workspace {
    grid-template-columns: 1fr;
    gap: 0.6rem;
  }

  .pane,
  .editor-pane {
    grid-column: 1 / -1;
  }

  .prompt-list,
  .version-list {
    flex-direction: row;
    overflow-x: auto;
    padding-bottom: 0.5rem;
    gap: 1rem;
    max-height: 100px;
  }

  .prompt-item,
  .version-card {
    flex: 0 0 190px;
  }
}

/* Performance Tab Styles */
.performance-container {
  padding: 16px 0;
}

.metric-card {
  padding: 12px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

.metric-label {
  font-size: 0.85rem;
  color: #6b7280;
  margin-bottom: 8px;
}

.metric-score {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.score-good { 
  color: #10b981; 
}

.score-fair { 
  color: #f59e0b; 
}

.score-poor { 
  color: #ef4444; 
}

/* Empty State Styling */
.evaluation-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 60px 20px;
}

.empty-icon-wrapper {
  margin-bottom: 16px;
}

.empty-content {
  text-align: center;
  max-width: 400px;
}

.empty-content h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.empty-content p {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}
</style>

