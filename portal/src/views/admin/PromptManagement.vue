<template>
  <div class="prompt-workspace" :class="{ 'prompts-collapsed': promptsCollapsed }">
    <section class="meta-card">
      <header class="meta-header">
        <div class="meta-title-wrap">
          <n-icon size="20" class="meta-icon"><FolderOutline /></n-icon>
          <span class="meta-title">Prompts</span>
        </div>
        <n-button class="meta-action collapse-trigger" text size="tiny" @click="promptsCollapsed = true">
          <template #icon>
            <n-icon><ArrowBackOutline /></n-icon>
          </template>
        </n-button>
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

    <!-- Expand Prompts Button (desktop only) -->
    <n-button v-if="promptsCollapsed" class="expand-prompts-btn" quaternary circle size="small" @click="promptsCollapsed = false">
      <template #icon>
        <n-icon><ArrowForwardOutline /></n-icon>
      </template>
    </n-button>

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
            <div class="version-content">
              <span class="meta-status-top" v-if="version.is_active">Active</span>
              <span class="meta-status-top draft" v-else-if="version.is_draft">Draft</span>
              <span class="meta-item-title">v{{ version.version_number }}</span>
              <span class="meta-item-sub">
                {{ formatDate(version.created_at) }}
              </span>
            </div>
            <!-- Activity Rings with Tooltip -->
            <n-tooltip placement="right" trigger="hover">
              <template #trigger>
                <svg class="activity-rings" width="50" height="50" viewBox="0 0 50 50">
                  <g v-for="(ring, idx) in getVersionRings(version)" :key="idx">
                    <!-- Background ring -->
                    <circle
                      :cx="25"
                      :cy="25"
                      :r="18 - (idx * 5)"
                      fill="none"
                      stroke="rgba(0,0,0,0.08)"
                      :stroke-width="3"
                    />
                    <!-- Progress ring -->
                    <circle
                      :cx="25"
                      :cy="25"
                      :r="18 - (idx * 5)"
                      fill="none"
                      :stroke="ring.color"
                      :stroke-width="3"
                      stroke-linecap="round"
                      :stroke-dasharray="`${2 * Math.PI * (18 - idx * 5)}`"
                      :stroke-dashoffset="`${2 * Math.PI * (18 - idx * 5) * (1 - ring.value / ring.max)}`"
                      transform="rotate(-90 25 25)"
                    />
                  </g>
                </svg>
              </template>
              <!-- Tooltip Content: Larger rings with labels -->
              <div class="rings-tooltip">
                <div class="rings-tooltip-header">
                  <strong>v{{ version.version_number }} Performance</strong>
                  <span class="rings-tooltip-calls" v-if="versionMetrics[`${activePrompt?.call_type}-v${version.version_number}`]">
                    {{ versionMetrics[`${activePrompt?.call_type}-v${version.version_number}`].count }} calls
                  </span>
                  <span class="rings-tooltip-calls" v-else>No data</span>
                </div>
                <svg width="140" height="140" viewBox="0 0 140 140" style="display: block; margin: 0.5rem auto;">
                  <g v-for="(ring, idx) in getVersionRings(version)" :key="idx">
                    <!-- Background ring -->
                    <circle
                      :cx="70"
                      :cy="70"
                      :r="55 - (idx * 15)"
                      fill="none"
                      stroke="rgba(0,0,0,0.08)"
                      :stroke-width="10"
                    />
                    <!-- Progress ring -->
                    <circle
                      :cx="70"
                      :cy="70"
                      :r="55 - (idx * 15)"
                      fill="none"
                      :stroke="ring.color"
                      :stroke-width="10"
                      stroke-linecap="round"
                      :stroke-dasharray="`${2 * Math.PI * (55 - idx * 15)}`"
                      :stroke-dashoffset="`${2 * Math.PI * (55 - idx * 15) * (1 - ring.value / ring.max)}`"
                      transform="rotate(-90 70 70)"
                    />
                  </g>
                </svg>
                <div class="rings-tooltip-legend">
                  <div v-for="(ring, idx) in getVersionRings(version)" :key="idx" class="legend-item">
                    <div class="legend-color" :style="{ background: ring.color }"></div>
                    <span class="legend-label">{{ ring.label }}</span>
                    <span class="legend-value">{{ ring.value ? ring.value.toFixed(1) : '—' }}/10</span>
                  </div>
                </div>
              </div>
            </n-tooltip>
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
          <n-button size="small" type="primary" round :disabled="loading || !hasChanges" @click="selectedVertical ? saveCurrentNode() : saveChanges()">
            <template #icon>
              <n-icon><SaveOutline /></n-icon>
            </template>
            {{ selectedVertical ? 'Save Node' : 'Save' }}
          </n-button>
          <n-button size="small" round type="info" :disabled="loading || !currentVersion?.id || currentVersion?.is_active" @click="openDeployModal">
            <template #icon>
              <n-icon><RocketOutline /></n-icon>
            </template>
            {{ isOlderVersion ? 'Rollback' : 'Deploy' }}
          </n-button>
          <n-button size="small" round :disabled="loading || !currentVersion?.id" @click="openAuditModal" class="ai-audit-btn">
            <template #icon>
              <n-icon style="color: #f59e0b !important;"><SparklesOutline /></n-icon>
            </template>
            AI Audit
          </n-button>
          <n-button size="small" round type="warning" :disabled="loading || !currentVersion?.id" @click="runPromptCleanup">
            <template #icon>
              <n-icon><RefreshOutline /></n-icon>
            </template>
            Clean Up
          </n-button>
        </div>

        <!-- Vertical Selector for Node-Based Routing -->
        <div class="vertical-selector-section" style="margin: 1.5rem 0; padding: 1rem; background: #f8fafc; border-radius: 0.5rem;">
          <label style="display: block; font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 0.5rem;">
            Select Vertical:
          </label>
          <select
            v-model="selectedVertical"
            style="width: 100%; padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.875rem; background: white;"
          >
            <option value="">-- Choose a vertical --</option>
            <option value="reverse_mortgage">Reverse Mortgage</option>
            <option value="solar">Solar</option>
            <option value="hvac">HVAC</option>
          </select>
        </div>

        <!-- Theme Editor (only show if vertical is selected) -->
        <div v-if="selectedVertical" style="margin: 1.5rem 0; padding: 1.5rem; background: #fff7ed; border: 2px solid #fb923c; border-radius: 0.5rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
            <div>
              <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600; color: #9a3412;">
                🎨 Theme / Personality (Universal)
              </h3>
              <p style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: #7c2d12;">
                This theme applies to ALL nodes in the <strong>{{ selectedVertical }}</strong> vertical. It defines Barbara's core personality, speaking style, and values.
              </p>
            </div>
            <n-button 
              type="primary" 
              :loading="themeSaving" 
              :disabled="!themeHasChanges || themeLoading"
              @click="saveTheme"
            >
              Save Theme
            </n-button>
          </div>
          <n-input
            v-model:value="themeContent"
            type="textarea"
            placeholder="Enter theme/personality content here..."
            :autosize="{ minRows: 8, maxRows: 20 }"
            @update:value="themeHasChanges = true"
            :disabled="themeLoading"
          />
          <p style="margin: 0.5rem 0 0 0; font-size: 0.8rem; color: #9a3412; font-style: italic;">
            💡 Tip: This content is automatically prepended to every node prompt. Only include universal personality traits, speaking style, and core values—not node-specific instructions.
          </p>
        </div>

        <!-- Node Tabs (only show if vertical is selected) -->
        <div v-if="selectedVertical" style="margin-bottom: 1.5rem; background: #eef2ff; border-radius: 0.5rem; padding: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.5rem;">
            <button
              v-for="node in nodeList"
              :key="node.name"
              @click="selectedNode = node.name"
              :style="{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
                border: 'none',
                cursor: 'pointer',
                background: selectedNode === node.name ? '#4f46e5' : 'white',
                color: selectedNode === node.name ? 'white' : '#374151',
                boxShadow: selectedNode === node.name ? '0 4px 6px rgba(0,0,0,0.1)' : 'none'
              }"
            >
              {{ node.label }}
            </button>
          </div>
          <div style="margin-top: 0.75rem; font-size: 0.875rem; color: #4b5563; font-style: italic;">
            <strong>{{ selectedNode }}:</strong> {{ getCurrentNodeDescription() }}
          </div>
        </div>

        <n-tabs type="line" size="small" v-model:value="activeTab">
          <n-tab-pane name="performance" tab="Performance">
            <div v-if="evaluationData && evaluationData.count > 0" class="performance-container">
              <!-- Summary Info Bar -->
              <div class="summary-info-bar">
                <div class="summary-info-item">
                  <n-icon size="18" color="#6366f1" style="margin-right: 0.4rem;"><CallOutline /></n-icon>
                  <span class="summary-info-label">{{ evaluationData.count }} {{ evaluationData.count === 1 ? 'call' : 'calls' }}</span>
                </div>
                <div class="summary-info-divider"></div>
                <div class="summary-info-item">
                  <n-icon size="18" color="#94a3b8" style="margin-right: 0.4rem;"><TimeOutline /></n-icon>
                  <span class="summary-info-label">{{ formatRelativeTime(evaluationData.lastEvaluated) }}</span>
                </div>
              </div>

              <!-- 6 Metric Scores - Circular Progress -->
              <n-card :bordered="false" class="metrics-card">
                <div class="metrics-ring-grid">
                  <div v-for="metric in evaluationMetrics" :key="metric.key" class="metric-ring-item">
                    <n-progress
                      type="circle"
                      :percentage="(metric.value / 10) * 100"
                      :stroke-width="12"
                      :color="getMetricColorWithIntensity(metric.value, metric.key)"
                      :rail-color="'rgba(0,0,0,0.06)'"
                      :show-indicator="false"
                      class="metric-ring"
                    >
                    </n-progress>
                    <div class="metric-ring-score">{{ metric.value.toFixed(1) }}<span class="metric-ring-suffix">/10</span></div>
                    <div class="metric-ring-label">{{ metric.label }}</div>
                  </div>
                </div>
              </n-card>

              <!-- AI Analysis Section -->
              <n-card title="AI Analysis" :bordered="false" class="ai-analysis-card" style="margin-bottom: 24px;">
                <n-collapse>
                  <n-collapse-item title="Strengths" name="strengths">
                    <n-list bordered class="ai-analysis-list">
                      <n-list-item v-for="(strength, idx) in evaluationData.commonStrengths" :key="idx">
                        <template #prefix>
                          <n-icon color="#10b981"><CheckmarkCircleOutline /></n-icon>
                        </template>
                        {{ strength }}
                      </n-list-item>
                    </n-list>
                  </n-collapse-item>
                  
                  <n-collapse-item title="Weaknesses" name="weaknesses">
                    <n-list bordered class="ai-analysis-list">
                      <n-list-item v-for="(weakness, idx) in evaluationData.commonWeaknesses" :key="idx">
                        <template #prefix>
                          <n-icon color="#f59e0b"><WarningOutline /></n-icon>
                        </template>
                        {{ weakness }}
                      </n-list-item>
                    </n-list>
                  </n-collapse-item>
                  
                  <n-collapse-item title="Red Flags" name="red-flags" v-if="evaluationData.redFlags.length > 0">
                    <n-list bordered class="ai-analysis-list">
                      <n-list-item v-for="(flag, idx) in evaluationData.redFlags" :key="idx">
                        <template #prefix>
                          <n-icon color="#ef4444"><CloseCircleOutline /></n-icon>
                        </template>
                        <span style="color: var(--text-primary);">{{ flag }}</span>
                      </n-list-item>
                    </n-list>
                  </n-collapse-item>
                </n-collapse>
              </n-card>

              <!-- AI Improvement Suggestions -->
              <n-card :bordered="false" class="ai-suggestions-card">
                <template #header>
                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <n-icon size="20" color="#8b5cf6"><SparklesOutline /></n-icon>
                      <span>AI Improvement Suggestions</span>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                      <n-button 
                        size="small" 
                        type="warning"
                        @click="runPromptCleanup"
                        :disabled="!currentVersion"
                        class="cleanup-btn"
                      >
                        <template #icon>
                          <n-icon><RefreshOutline /></n-icon>
                        </template>
                        Clean Up Prompt
                      </n-button>
                      <n-button 
                        size="small" 
                        @click="applyAllSuggestions" 
                        :disabled="!aiSuggestions || aiSuggestions.length === 0"
                        class="apply-all-btn"
                      >
                        <template #icon>
                          <n-icon><CheckmarkDoneOutline /></n-icon>
                        </template>
                        Apply All
                      </n-button>
                    </div>
                  </div>
                </template>
                <n-list class="suggestions-list">
                  <n-list-item 
                    v-for="(suggestion, idx) in aiSuggestions" 
                    :key="idx" 
                    class="suggestion-item"
                    :style="appliedSuggestions.has(mapSuggestionSectionToKey(suggestion.section)) ? { opacity: 0.6 } : {}"
                  >
                    <template #prefix>
                      <n-badge :value="suggestion.priority" :type="getPriorityType(suggestion.priority)" class="suggestion-badge" />
                    </template>
                    <div style="text-align: left; flex: 1;">
                      <div class="suggestion-title">
                        {{ suggestion.title }}
                        <n-tag 
                          v-if="appliedSuggestions.has(mapSuggestionSectionToKey(suggestion.section))" 
                          size="small" 
                          type="success" 
                          :bordered="false"
                          style="margin-left: 0.5rem;"
                        >
                          <template #icon>
                            <n-icon><CheckmarkCircleOutline /></n-icon>
                          </template>
                          Applied
                        </n-tag>
                      </div>
                      <div style="font-size: 0.9em; color: var(--text-secondary);">{{ suggestion.description }}</div>
                    </div>
                    <template #suffix>
                      <n-button 
                        v-if="!appliedSuggestions.has(mapSuggestionSectionToKey(suggestion.section))"
                        size="small" 
                        tertiary 
                        @click="applySuggestion(suggestion)"
                      >
                        Apply
                      </n-button>
                      <n-button 
                        v-else
                        size="small" 
                        tertiary 
                        type="success"
                        disabled
                      >
                        <template #icon>
                          <n-icon><CheckmarkOutline /></n-icon>
                        </template>
                        Applied
                      </n-button>
                    </template>
                  </n-list-item>
                </n-list>
              </n-card>
            </div>
            
            <!-- Empty State -->
            <div v-else class="evaluation-empty-state">
              <n-empty size="large">
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

          <n-tab-pane name="changes" tab="Changes">
            <div v-if="currentVersion" class="changes-container">
              <!-- Version Comparison Header -->
              <n-alert type="info" style="margin-bottom: 1.5rem;" :bordered="false">
                <template #icon>
                  <n-icon><SwapHorizontalOutline /></n-icon>
                </template>
                <div style="font-size: 0.95rem;">
                  <strong>{{ currentVersion.is_draft ? 'Draft' : '' }} Version {{ currentVersion.version_number }}</strong>
                  <span v-if="baseVersionForDiff"> - Comparing against Version {{ baseVersionForDiff.version_number }}{{ baseVersionForDiff.is_active ? ' (Active)' : '' }}</span>
                  <span v-else> - No comparison available (first version or no active version)</span>
                </div>
              </n-alert>

              <!-- Diff Content -->
              <div v-if="baseVersionForDiff" class="diff-content-tab">
                <!-- Summary of changes -->
                <n-alert type="default" style="margin-bottom: 1rem;" :bordered="false">
                  <div style="font-size: 0.9rem;">
                    <strong>{{ sectionsWithChanges.length }}</strong> section{{ sectionsWithChanges.length === 1 ? '' : 's' }} modified
                    <span v-if="sectionsWithChanges.length === 0"> - No changes detected</span>
                  </div>
                </n-alert>

                <!-- Only show sections with changes -->
                <div v-if="sectionsWithChanges.length > 0">
                  <div class="diff-section-tab" v-for="section in sectionsWithChanges" :key="section.key">
                    <h4 class="preview-section-title">
                      {{ section.label }}
                      <span class="changed-badge">Modified</span>
                    </h4>
                    <div class="diff-text">
                      <span
                        v-for="(part, index) in getSectionDiff(section.key)"
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

                <!-- No changes message -->
                <div v-else style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                  <p>No changes detected between these versions.</p>
                </div>
              </div>

              <!-- No Comparison Available -->
              <div v-else class="no-comparison-state">
                <n-empty size="large">
                  <template #default>
                    <div class="empty-content">
                      <h3>No Comparison Available</h3>
                      <p v-if="!activeVersion">This is the first version - there's no active version to compare against.</p>
                      <p v-else>Showing all content (no diff available).</p>
                    </div>
                  </template>
                </n-empty>

                <!-- Show full content if no comparison -->
                <div class="preview-content" style="margin-top: 1.5rem;">
                  <div class="preview-section" v-for="section in (selectedVertical ? nodePromptSections : promptSections)" :key="section.key">
                    <h4 class="preview-section-title">{{ section.label }}</h4>
                    <pre class="preview-section-content">{{ currentVersion?.content[section.key] || '(empty)' }}</pre>
                  </div>
                </div>
              </div>
            </div>

            <!-- No Version Selected -->
            <div v-else class="empty-state">
              <n-empty>
                <template #default>
                  <p>Select a version to view changes</p>
                </template>
              </n-empty>
            </div>
          </n-tab-pane>

          <n-tab-pane name="editor" tab="Editor">
            <div v-if="currentVersion" class="editor-sections">
              <!-- Show different sections for node-based (vertical selected) vs old prompt system -->
              <n-collapse display-directive="show" accordion v-model:expanded-names="expandedSections">
                <n-collapse-item
                  v-for="section in (selectedVertical ? nodePromptSections : promptSections)"
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

                  <!-- Markdown Helper Toolbar -->
                  <div v-if="expandedSections.includes(section.key)" class="markdown-helper-toolbar">
                    <button 
                      type="button"
                      class="md-btn" 
                      @click.stop="insertMarkdown(section.key, '- ', '')"
                      title="Insert bullet point"
                    >
                      • Bullet
                    </button>
                    <button 
                      type="button"
                      class="md-btn" 
                      @click.stop="insertMarkdown(section.key, '1. ', '')"
                      title="Insert numbered list"
                    >
                      1. Number
                    </button>
                    <button 
                      type="button"
                      class="md-btn" 
                      @click.stop="insertMarkdown(section.key, '**', '**')"
                      title="Bold text (select text first)"
                    >
                      <strong>B</strong>
                    </button>
                    <button 
                      type="button"
                      class="md-btn" 
                      @click.stop="insertMarkdown(section.key, '# ', '')"
                      title="Insert header"
                    >
                      # Header
                    </button>
                  </div>

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
                <h3>Runtime Configuration</h3>
                <p class="text-muted">Select the AI runtime and configure its settings:</p>
                
                <!-- Runtime Selector -->
                <div style="margin-top: 1.5rem;">
                  <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Runtime:</label>
                  <n-select
                    v-model:value="selectedRuntime"
                    :options="runtimeOptions"
                    size="large"
                    placeholder="Select runtime"
                    @update:value="handleRuntimeChange"
                  />
                  <p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: #9ca3af;">
                    Choose which AI system will handle calls for this prompt type
                  </p>
                </div>

                <!-- ElevenLabs Settings -->
                <div v-if="selectedRuntime === 'elevenlabs'" style="margin-top: 2rem;">
                  <h4 style="margin: 0 0 1rem 0; font-size: 1rem; font-weight: 600;">ElevenLabs Configuration</h4>
                  
                  <!-- Voice ID -->
                  <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Voice:</label>
                    <n-select
                      v-model:value="elevenLabsVoiceId"
                      :options="elevenLabsVoiceOptions"
                      size="medium"
                      placeholder="Select voice"
                      @update:value="handleElevenLabsSettingChange"
                      filterable
                      tag
                    />
                    <p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: #9ca3af;">
                      Select from presets or paste custom voice_id. Default: Tiffany
                    </p>
                  </div>

                  <!-- First Message -->
                  <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Default First Message:</label>
                    <n-input
                      v-model:value="elevenLabsFirstMessage"
                      type="textarea"
                      placeholder="Hi, this is Barbara..."
                      :autosize="{ minRows: 2, maxRows: 4 }"
                      @update:value="handleElevenLabsSettingChange"
                    />
                    <p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: #9ca3af;">
                      Default greeting when webhook doesn't provide a personalized one
                    </p>
                  </div>

                  <!-- Voice Speed -->
                  <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
                      Voice Speed: {{ elevenLabsVoiceSpeed.toFixed(2) }}x
                    </label>
                    <n-slider
                      v-model:value="elevenLabsVoiceSpeed"
                      :step="0.05"
                      :min="0.5"
                      :max="1.5"
                      :marks="{
                        0.5: 'Slow',
                        0.85: 'Default',
                        1.0: 'Normal',
                        1.5: 'Fast'
                      }"
                      @update:value="handleElevenLabsSettingChange"
                    />
                    <p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: #9ca3af;">
                      0.85 = 15% slower (recommended for seniors)
                    </p>
                  </div>

                  <!-- Language -->
                  <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Language:</label>
                    <n-select
                      v-model:value="elevenLabsAgentLanguage"
                      :options="languageOptions"
                      size="medium"
                      placeholder="Select language"
                      @update:value="handleElevenLabsSettingChange"
                    />
                    <p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: #9ca3af;">
                      Default: English
                    </p>
                  </div>

                  <!-- Advanced Voice Settings Toggle -->
                  <n-button
                    @click="showAdvancedSettings = !showAdvancedSettings"
                    secondary
                    style="margin-top: 1rem;"
                  >
                    {{ showAdvancedSettings ? 'Hide' : 'Show' }} Advanced Voice Settings
                  </n-button>

                  <!-- Advanced Voice Settings -->
                  <div v-if="showAdvancedSettings" style="margin-top: 1rem; padding: 1rem; background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;">
                    <n-alert type="info" style="margin-bottom: 1rem; font-size: 0.85rem;">
                      <strong>Advanced Voice Settings</strong> - Fine-tune voice stability and similarity. Default values work well for most use cases.
                    </n-alert>

                    <!-- Voice Stability -->
                    <div style="margin-bottom: 1rem;">
                      <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; font-size: 0.85rem;">
                        Voice Stability: {{ elevenLabsVoiceStability.toFixed(2) }}
                      </label>
                      <n-slider
                        v-model:value="elevenLabsVoiceStability"
                        :step="0.05"
                        :min="0"
                        :max="1"
                        :marks="{
                          0: 'Variable',
                          0.5: 'Balanced',
                          1: 'Stable'
                        }"
                        @update:value="handleElevenLabsSettingChange"
                      />
                      <p style="margin: 0.35rem 0 0 0; font-size: 0.75rem; color: #9ca3af;">
                        Higher = more consistent voice. Lower = more expressive but variable.
                      </p>
                    </div>

                    <!-- Voice Similarity -->
                    <div style="margin-bottom: 1rem;">
                      <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; font-size: 0.85rem;">
                        Voice Similarity: {{ elevenLabsVoiceSimilarity.toFixed(2) }}
                      </label>
                      <n-slider
                        v-model:value="elevenLabsVoiceSimilarity"
                        :step="0.05"
                        :min="0"
                        :max="1"
                        :marks="{
                          0: 'Creative',
                          0.75: 'Balanced',
                          1: 'Exact'
                        }"
                        @update:value="handleElevenLabsSettingChange"
                      />
                      <p style="margin: 0.35rem 0 0 0; font-size: 0.75rem; color: #9ca3af;">
                        Higher = closer to original voice. Lower = more creative interpretation.
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Realtime (V3) Settings -->
                <div v-if="selectedRuntime === 'realtime'" style="margin-top: 2rem;">
                  <h4 style="margin: 0 0 1rem 0; font-size: 1rem; font-weight: 600;">OpenAI Realtime Configuration</h4>
                  
                  <!-- Voice -->
                  <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Voice:</label>
                    <n-select
                      v-model:value="selectedVoice"
                      :options="voiceOptions"
                      size="medium"
                      placeholder="Select voice"
                      @update:value="handleElevenLabsSettingChange"
                    />
                    <p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: #9ca3af;">
                      OpenAI Realtime voice. Default: shimmer
                    </p>
                  </div>

                  <!-- VAD Settings Toggle -->
                  <n-button
                    @click="showAdvancedSettings = !showAdvancedSettings"
                    secondary
                    style="margin-top: 1rem;"
                  >
                    {{ showAdvancedSettings ? 'Hide' : 'Show' }} Advanced VAD Settings
                  </n-button>

                  <!-- VAD Settings -->
                  <div v-if="showAdvancedSettings" style="margin-top: 1rem; padding: 1rem; background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;">
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
                        @update:value="handleElevenLabsSettingChange"
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
                        @update:value="handleElevenLabsSettingChange"
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
                        @update:value="handleElevenLabsSettingChange"
                      />
                      <p style="margin: 0.35rem 0 0 0; font-size: 0.75rem; color: #9ca3af; line-height: 1.3;">
                        How long to wait before considering speech finished. 500ms = balanced, 700ms+ = patient (good for seniors).
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Save and Reset Buttons -->
                <div style="margin-top: 2rem; display: flex; gap: 1rem; align-items: center;">
                  <n-button
                    type="primary"
                    :loading="loading"
                    :disabled="!settingsHasChanges"
                    @click="saveRuntimeSettings"
                  >
                    <template #icon>
                      <n-icon><SaveOutline /></n-icon>
                    </template>
                    Save Settings
                  </n-button>
                  
                  <n-button
                    secondary
                    @click="resetRuntimeToDefaults"
                  >
                    <template #icon>
                      <n-icon><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M320 146s24.36-12-64-12a160 160 0 10160 160" fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M256 58l80 80-80 80"/></svg></n-icon>
                    </template>
                    Reset to Defaults
                  </n-button>
                  
                  <span v-if="settingsHasChanges" style="font-size: 0.85rem; color: #f59e0b;">
                    Unsaved changes
                  </span>
                </div>

                <!-- Current Runtime Info -->
                <div style="margin-top: 2rem; padding: 1rem; background: rgba(99, 102, 241, 0.05); border-radius: 8px;">
                  <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">
                    <strong>Active Runtime:</strong> {{ selectedRuntime === 'elevenlabs' ? 'ElevenLabs (Production)' : 'Realtime V3 (A/B Testing)' }}
                  </p>
                  <p v-if="selectedRuntime === 'elevenlabs'" style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: #9ca3af;">
                    Voice: {{ elevenLabsVoiceOptions.find(v => v.value === elevenLabsVoiceId)?.label || elevenLabsVoiceId }} • Speed: {{ elevenLabsVoiceSpeed }}x • Language: {{ elevenLabsAgentLanguage }}
                  </p>
                  <p v-else style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: #9ca3af;">
                    Voice: {{ selectedVoice }} • VAD: {{ vadThreshold }}
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

          <n-tab-pane name="tools" tab="Available Tools">
            <div class="variables-content">
              <div class="variables-section">
                <h3>🛠️ All Standard Tools (Auto-Available)</h3>
                <n-alert type="info" style="margin-bottom: 1.5rem;">
                  <strong>Note:</strong> All tools below are automatically available to Barbara at runtime. 
                  You don't need to list them in your prompts anymore. Barbara intelligently selects the right tool based on the conversation context.
                </n-alert>
                
                <div class="variable-category">
                  <h4>Lead Management</h4>
                  <div class="variable-grid">
                    <div v-for="tool in availableTools.lead" :key="tool.key" class="variable-item-readonly">
                      <span class="variable-name">{{ tool.name }}</span>
                      <span class="variable-desc">{{ tool.desc }}</span>
                    </div>
                  </div>
                </div>

                <div class="variable-category">
                  <h4>Knowledge Base</h4>
                  <div class="variable-grid">
                    <div v-for="tool in availableTools.knowledge" :key="tool.key" class="variable-item-readonly">
                      <span class="variable-name">{{ tool.name }}</span>
                      <span class="variable-desc">{{ tool.desc }}</span>
                    </div>
                  </div>
                </div>

                <div class="variable-category">
                  <h4>Broker & Territory</h4>
                  <div class="variable-grid">
                    <div v-for="tool in availableTools.broker" :key="tool.key" class="variable-item-readonly">
                      <span class="variable-name">{{ tool.name }}</span>
                      <span class="variable-desc">{{ tool.desc }}</span>
                    </div>
                  </div>
                </div>

                <div class="variable-category">
                  <h4>Appointments</h4>
                  <div class="variable-grid">
                    <div v-for="tool in availableTools.appointment" :key="tool.key" class="variable-item-readonly">
                      <span class="variable-name">{{ tool.name }}</span>
                      <span class="variable-desc">{{ tool.desc }}</span>
                    </div>
                  </div>
                </div>

                <div class="variable-category">
                  <h4>Call Tracking</h4>
                  <div class="variable-grid">
                    <div v-for="tool in availableTools.tracking" :key="tool.key" class="variable-item-readonly">
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
          <div class="preview-section" v-for="section in (selectedVertical ? nodePromptSections : promptSections)" :key="section.key">
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
            <div class="preview-section" v-for="section in (selectedVertical ? nodePromptSections : promptSections)" :key="section.key">
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
          <h4 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">Improving: {{ aiImprovingSection?.label }}</h4>
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
          <span class="quick-label" style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">Quick suggestions:</span>
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
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: var(--text-secondary);">Current Content:</label>
          <pre style="background: rgba(248, 250, 255, 0.8); padding: 1rem; border-radius: 8px; font-size: 0.8rem; line-height: 1.5; max-height: 200px; overflow-y: auto; white-space: pre-wrap; border: 1px solid rgba(148, 163, 184, 0.18);">{{ currentVersion?.content[aiImprovingSection?.key] || '(empty)' }}</pre>
        </div>
      </div>

      <div v-else class="ai-improve-result">
        <div class="result-header" style="margin-bottom: 1rem;">
          <h4 style="margin: 0 0 0.25rem 0; color: var(--text-primary);">✨ AI Improved Version</h4>
          <p class="text-muted" style="margin: 0; font-size: 0.85rem;">Review the changes and accept or reject:</p>
        </div>

        <div class="diff-content">
          <div class="diff-section">
            <h4 class="preview-section-title">
              {{ aiImprovingSection?.label }}
              <span class="changed-badge">AI Modified</span>
            </h4>
            <div class="diff-text">
              <span
                v-for="(part, index) in aiDiff"
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

        <div v-if="aiChanges.length > 0" class="changes-list" style="margin-top: 1rem; padding: 1rem; background: rgba(99, 102, 241, 0.05); border-radius: 8px;">
          <h5 style="margin: 0 0 0.5rem 0; font-size: 0.9rem; color: var(--text-primary);">Changes Made:</h5>
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

    <!-- Apply All Review Modal -->
    <n-modal 
      v-model:show="showApplyAllModal" 
      preset="card" 
      :style="{ width: '90%', maxWidth: '1200px' }" 
      :title="applyAllIsProcessing ? '⏳ Generating AI Improvements...' : '✨ Review All AI Improvements'" 
      :bordered="false"
      :closable="!applyAllIsProcessing"
      :mask-closable="false"
    >
      <n-scrollbar style="max-height: 70vh;">
        <!-- Progress View (while processing) -->
        <div v-if="applyAllIsProcessing" class="apply-all-progress">
          <div style="margin-bottom: 1rem;">
            <p style="margin: 0; color: var(--text-secondary); font-size: 0.95rem;">
              Please wait while we generate AI improvements for each section...
            </p>
          </div>

          <div class="progress-log">
            <div 
              v-for="(item, idx) in applyAllProgress" 
              :key="idx"
              :style="{
                padding: '0.5rem 0',
                borderBottom: idx < applyAllProgress.length - 1 ? '1px solid rgba(148, 163, 184, 0.1)' : 'none',
                color: item.type === 'error' ? '#ef4444' : item.type === 'success' ? '#10b981' : item.type === 'working' ? '#3b82f6' : 'var(--text-secondary)'
              }"
            >
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <n-spin v-if="item.type === 'working'" size="small" />
                <n-icon v-else-if="item.type === 'success'" size="18" color="#10b981"><CheckmarkCircleOutline /></n-icon>
                <n-icon v-else-if="item.type === 'error'" size="18" color="#ef4444"><CloseCircleOutline /></n-icon>
                <n-icon v-else size="18" :color="isDark ? '#94a3b8' : '#6b7280'"><InformationCircleOutline /></n-icon>
                <span style="font-size: 0.9rem; font-weight: 500;">{{ item.message }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Review View (after processing) -->
        <div v-else class="apply-all-review">
          <div style="margin-bottom: 1.5rem;">
            <p style="margin: 0; color: var(--text-secondary); font-size: 0.95rem;">
              Review all {{ applyAllResults.length }} AI-generated improvements below. You can accept all changes or cancel.
            </p>
          </div>

          <div class="diff-sections">
            <div 
              v-for="(result, idx) in applyAllResults" 
              :key="idx" 
              class="diff-section"
              style="margin-bottom: 2rem; padding-bottom: 2rem; border-bottom: 1px solid rgba(148, 163, 184, 0.18);"
            >
              <div style="margin-bottom: 0.75rem;">
          <h4 style="margin: 0 0 0.25rem 0; color: var(--text-primary); font-size: 1rem;">
                  {{ result.section.label }}
                  <span class="changed-badge" style="margin-left: 0.5rem; font-size: 0.75rem; background: rgba(139, 92, 246, 0.12); color: #8b5cf6; padding: 0.25rem 0.5rem; border-radius: 4px;">{{ result.suggestion.priority }}</span>
                </h4>
                <p style="margin: 0; color: var(--text-secondary); font-size: 0.85rem;">{{ result.suggestion.description }}</p>
              </div>

              <div class="diff-text" style="background: rgba(248, 250, 255, 0.4); padding: 1rem; border-radius: 8px; border: 1px solid rgba(148, 163, 184, 0.18); font-family: monospace; font-size: 0.85rem; line-height: 1.6; white-space: pre-wrap;">
                <span
                  v-for="(part, partIdx) in result.diff"
                  :key="partIdx"
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
        <!-- Processing Footer -->
        <div v-if="applyAllIsProcessing" class="modal-footer" style="display: flex; justify-content: center; align-items: center;">
          <span style="color: var(--text-secondary); font-size: 0.9rem;">
            <n-spin size="small" style="margin-right: 0.5rem;" />
            Processing {{ applyAllProgress.filter(p => p.type === 'success').length }} of {{ aiSuggestions?.length || 0 }} sections...
          </span>
        </div>
        
        <!-- Review Footer -->
        <div v-else class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: var(--text-secondary); font-size: 0.9rem;">{{ applyAllResults.length }} improvements ready to apply</span>
          <div style="display: flex; gap: 0.75rem;">
            <n-button @click="cancelAllImprovements">Cancel All</n-button>
            <n-button type="success" @click="acceptAllImprovements">
              <template #icon>
                <n-icon><CheckmarkDoneOutline /></n-icon>
              </template>
              Accept All Changes
            </n-button>
          </div>
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
        <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">
          Answer these questions to help GPT-5 provide a comprehensive evaluation of your prompt:
        </p>

        <div>
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: var(--text-primary);">
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
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: var(--text-primary);">
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
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: var(--text-primary);">
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
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: var(--text-primary);">
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
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: var(--text-primary);">
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
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: var(--text-primary);">
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
            {{ auditResults.score }}<span style="font-size: 1.5rem; color: var(--text-secondary);">/100</span>
            </h2>
          <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">
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
                    <span style="margin-left: 0.5rem; font-weight: 500; color: var(--text-primary);">{{ rec.section }}</span>
                    <span v-if="appliedAuditRecommendations.has(idx)" style="margin-left: 0.5rem; color: #10b981; font-size: 0.75rem;">✓ Applied</span>
                  </div>
                  <n-button 
                    size="small" 
                    :type="appliedAuditRecommendations.has(idx) ? 'success' : 'primary'" 
                    @click="applyAuditRecommendation(rec, idx)"
                    :disabled="appliedAuditRecommendations.has(idx)"
                  >
                    <template #icon>
                      <n-icon><CheckmarkDoneOutline /></n-icon>
                    </template>
                    {{ appliedAuditRecommendations.has(idx) ? 'Applied' : 'Apply' }}
                  </n-button>
                </div>
                <p style="margin: 0 0 0.5rem 0; color: #ef4444; font-size: 0.9rem;"><strong>Issue:</strong> {{ rec.issue }}</p>
                <p style="margin: 0 0 0.5rem 0; color: var(--text-secondary); font-size: 0.85rem;"><strong>Why:</strong> {{ rec.reasoning }}</p>
                <div style="margin-top: 0.75rem;">
                  <p style="margin: 0 0 0.5rem 0; font-size: 0.8rem; font-weight: 600; color: #10b981;">Suggested Changes:</p>
                  <div class="diff-text">
                    <span
                      v-for="(part, partIdx) in auditRecommendationDiffs[idx]"
                      :key="partIdx"
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
          </div>
        </div>
      </n-scrollbar>

      <template #footer>
        <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
          <span v-if="auditResults.recommendations.length > 0" style="color: var(--text-secondary); font-size: 0.9rem;">
            {{ appliedAuditRecommendations.size }} of {{ auditResults.recommendations.length }} applied
          </span>
          <div style="display: flex; gap: 0.75rem; margin-left: auto;">
            <n-button @click="closeAuditResults">Close</n-button>
            <n-button type="warning" @click="runPromptCleanup">
              <template #icon>
                <n-icon><RefreshOutline /></n-icon>
              </template>
              Run Cleanup
            </n-button>
            <n-button 
              v-if="auditResults.recommendations.length > 0"
              type="success" 
              @click="applyAllAuditRecommendations"
              :disabled="appliedAuditRecommendations.size === auditResults.recommendations.length"
            >
              <template #icon>
                <n-icon><CheckmarkDoneOutline /></n-icon>
              </template>
              Apply All
            </n-button>
          </div>
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
    <!-- Cleanup Review Modal -->
    <n-modal 
      v-model:show="showCleanupModal" 
      preset="card" 
      :style="{ width: '90%', maxWidth: '1200px' }" 
      :title="cleanupIsProcessing ? '🧹 Cleaning Prompt…' : '🧼 Review Cleanup Changes'" 
      :bordered="false"
      :closable="!cleanupIsProcessing"
      :mask-closable="false"
    >
      <div v-if="cleanupIsProcessing" style="display:flex; justify-content:center; align-items:center; min-height: 160px; color: var(--text-secondary);">
        <n-spin size="small" style="margin-right: 0.5rem;" />
        Processing cleanup across sections…
      </div>

      <div v-else>
        <n-scrollbar style="max-height: calc(85vh - 180px);">
          <div v-if="cleanupProgress.length" style="margin-bottom: 1rem;">
            <div v-for="(p, i) in cleanupProgress" :key="i" style="font-size: 0.85rem; color: var(--text-secondary);">
              {{ p.message }}
            </div>
          </div>

          <div v-if="cleanupResults.length === 0" style="color: var(--text-secondary);">No cleanup changes were generated.</div>

          <div v-else>
            <div 
              v-for="(result, idx) in cleanupResults" 
              :key="idx" 
              style="border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;"
            >
              <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <div style="font-weight: 600; color: var(--text-primary);">{{ result.section.label }}</div>
              </div>
              <div class="diff-text">
                <span
                  v-for="(part, partIdx) in result.diff"
                  :key="partIdx"
                  :class="{
                    'diff-added': part.added,
                    'diff-removed': part.removed,
                    'diff-unchanged': !part.added && !part.removed
                  }"
                >{{ part.value }}</span>
              </div>
            </div>
          </div>
        </n-scrollbar>
      </div>

      <template #footer>
        <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: var(--text-secondary); font-size: 0.9rem;">{{ cleanupResults.length }} sections changed</span>
          <div style="display: flex; gap: 0.75rem;">
            <n-button @click="cancelCleanup" :disabled="cleanupIsProcessing">Cancel</n-button>
            <n-button type="success" @click="acceptAllCleanupChanges" :disabled="cleanupIsProcessing || cleanupResults.length === 0">
              <template #icon>
                <n-icon><CheckmarkDoneOutline /></n-icon>
              </template>
              Accept All Cleanup Changes
            </n-button>
          </div>
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
  NBadge,
  NSpin
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
  BarChartOutline,
  ArrowBackOutline,
  ArrowForwardOutline
} from '@vicons/ionicons5'

const loading = ref(false)
const error = ref('')
const activeTab = ref('performance')

// Vertical and node selection for node-based routing
const selectedVertical = ref('')
const selectedNode = ref('greet')
const nodePrompts = ref({}) // { vertical: { greet: {...}, verify: {...}, ... } }
const currentNodePrompt = ref(null)

// Theme editing
const themeContent = ref('')
const themeLoading = ref(false)
const themeSaving = ref(false)
const themeHasChanges = ref(false)

// Node configuration
const nodeList = [
  { name: 'greet', label: '1. Greet', desc: 'Initial greeting when call starts' },
  { name: 'verify', label: '2. Verify', desc: 'Verify caller identity and get lead context' },
  { name: 'qualify', label: '3. Qualify', desc: 'Ask qualifying questions to assess fit' },
  { name: 'quote', label: '4. Quote', desc: 'Present financial quote and gather reaction' },
  { name: 'answer', label: '5. Answer', desc: 'Answer questions about the service' },
  { name: 'objections', label: '6. Objections', desc: 'Handle objections and concerns' },
  { name: 'book', label: '7. Book', desc: 'Schedule an appointment on the calendar' },
  { name: 'exit', label: '8. Exit', desc: 'Say goodbye and end the call' }
]

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

// Runtime settings
const selectedRuntime = ref('elevenlabs')
const settingsHasChanges = ref(false)

// VAD settings (Realtime)
const vadThreshold = ref(0.5)
const vadPrefixPaddingMs = ref(300)
const vadSilenceDurationMs = ref(500)
const showAdvancedSettings = ref(false)

// ElevenLabs defaults
const elevenLabsVoiceId = ref('6aDn1KB0hjpdcocrUkmq') // Tiffany default
const elevenLabsFirstMessage = ref('Hi, this is Barbara with Equity Connect. How are you today?')
const elevenLabsVoiceSpeed = ref(0.85)
const elevenLabsAgentLanguage = ref('en')
const elevenLabsVoiceStability = ref(0.5)
const elevenLabsVoiceSimilarity = ref(0.75)

// AI Improve feature
const showAIImproveModal = ref(false)
const aiImprovingSection = ref(null)
const aiUserRequest = ref('')
const aiSuggestion = ref('')
const aiChanges = ref([])
const aiDiff = ref([])
const aiIsLoading = ref(false)

// AI Improve All feature (batch review)
const showApplyAllModal = ref(false)
const applyAllResults = ref([]) // Array of { section, suggestion, aiContent, diff }
const applyAllProgress = ref([]) // Array of progress messages
const applyAllIsProcessing = ref(false) // True while generating, false when showing review
const appliedSuggestions = ref(new Set()) // Track which suggestions have been applied (by section key)

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
const auditRecommendationDiffs = ref({})
const appliedAuditRecommendations = ref(new Set())

// OpenAI Realtime voices
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

// ElevenLabs voices (your custom voices)
const elevenLabsVoiceOptions = [
  { label: 'Tiffany', value: '6aDn1KB0hjpdcocrUkmq' },
  { label: 'Dakota H', value: 'P7x743VjyZEOihNNygQ9' },
  { label: 'Ms. Walker', value: 'DLsHlh26Ugcm6ELvS0qi' },
  { label: 'Jamahal', value: 'DTKMou8ccj1ZaWGBiotd' },
  { label: 'Eric B', value: '9T9vSqRrPPxIs5wpyZfK' },
  { label: 'Mark', value: 'UgBBYS2sOqTuMpoF3BR0' }
]

// Runtime options
const runtimeOptions = [
  { label: 'ElevenLabs (Production)', value: 'elevenlabs' },
  { label: 'Realtime V3 (A/B Testing)', value: 'realtime' }
]

// Language options for ElevenLabs
const languageOptions = [
  { label: 'English', value: 'en' },
  { label: 'Spanish', value: 'es' },
  { label: 'French', value: 'fr' },
  { label: 'German', value: 'de' },
  { label: 'Italian', value: 'it' },
  { label: 'Portuguese', value: 'pt' },
  { label: 'Polish', value: 'pl' },
  { label: 'Turkish', value: 'tr' },
  { label: 'Russian', value: 'ru' },
  { label: 'Dutch', value: 'nl' },
  { label: 'Czech', value: 'cs' },
  { label: 'Arabic', value: 'ar' },
  { label: 'Chinese', value: 'zh' },
  { label: 'Japanese', value: 'ja' },
  { label: 'Korean', value: 'ko' }
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
    { key: 'cancel_appointment', name: 'cancel_appointment', desc: 'Cancel an existing appointment. Removes calendar event from broker\'s calendar and notifies all participants.' },
    { key: 'reschedule_appointment', name: 'reschedule_appointment', desc: 'Reschedule an existing appointment to a new time. Updates calendar event and sends updated invites to all participants.' },
    { key: 'assign_tracking_number', name: 'assign_tracking_number', desc: 'Assign the current SignalWire number to this lead/broker pair for call tracking. Should be called immediately after booking an appointment.' }
  ],
  tracking: [
  ]
}

const availableVariables = {
  lead: [
    { key: 'first_name', desc: 'Lead first name' },
    { key: 'last_name', desc: 'Lead last name' },
    { key: 'full_name', desc: 'Lead full name' },
    { key: 'lead_email', desc: 'Lead email address' },
    { key: 'lead_phone', desc: 'Lead phone number' },
    { key: 'lead_age', desc: 'Lead age' }
  ],
  property: [
    { key: 'property_address', desc: 'Full property address' },
    { key: 'property_city', desc: 'Property city' },
    { key: 'property_state', desc: 'Property state' },
    { key: 'property_zip', desc: 'Property ZIP code' },
    { key: 'property_value', desc: 'Property value (number)' },
    { key: 'estimated_equity', desc: 'Estimated equity' }
  ],
  broker: [
    { key: 'broker_name', desc: 'Broker name' },
    { key: 'broker_company', desc: 'Broker company name' },
    { key: 'broker_phone', desc: 'Broker phone number' },
    { key: 'broker_email', desc: 'Broker email address' }
  ],
  call: [
    { key: 'call_direction', desc: 'Call direction (inbound/outbound)' }
  ],
  status: [
    { key: 'qualified', desc: 'Is lead qualified (true/false)' },
    { key: 'verified', desc: 'Is caller verified (true/false)' },
    { key: 'quote_presented', desc: 'Has quote been presented (true/false)' },
    { key: 'appointment_booked', desc: 'Is appointment booked (true/false)' },
    { key: 'ready_to_book', desc: 'Is caller ready to book (true/false)' }
  ]
}

const variableDropdownOptions = computed(() => {
  const allVars = [
    ...availableVariables.lead,
    ...availableVariables.property,
    ...availableVariables.broker,
    ...availableVariables.call,
    ...availableVariables.status
  ]
  
  return allVars.map(v => ({
    label: `$${v.key} - ${v.desc}`,
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
  { key: 'instructions', label: 'Instructions & Rules', required: true, placeholder: 'Behavior guardrails, dos/donts, escalation triggers...' },
  { key: 'conversation_flow', label: 'Conversation Flow', required: false, placeholder: 'Outline conversation states, transitions, and exit criteria...' },
  { key: 'output_format', label: 'Output Format', required: false, placeholder: 'Structured output requirements (JSON schema, message format)...' },
  { key: 'safety', label: 'Safety & Escalation', required: false, placeholder: 'When to handoff to a human, fallback behavior, compliance notes...' }
]

// Node-based prompt sections (NO personality - handled by theme_prompts table)
const nodePromptSections = [
  { key: 'role', label: 'Role & Objective', required: true, placeholder: 'Define the node\'s role and objective...' },
  { key: 'instructions', label: 'Instructions & Rules', required: true, placeholder: 'Node-specific behavior, guardrails, completion criteria...' },
  { key: 'tools', label: 'Tools', required: false, placeholder: 'Available tools (comma-separated): verify_caller_identity, mark_quote_presented, book_appointment...' },
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

// Version performance metrics (for activity rings on version cards)
const versionMetrics = ref({})

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
  const seen = new Set() // dedupe by title|section
  const add = (priority, title, description, section) => {
    const key = `${title}|${section}`
    if (seen.has(key)) return
    suggestions.push({ priority, title, description, section })
    seen.add(key)
  }

  const metrics = {
    opening_effectiveness: evaluationData.value.avgOpeningEffectiveness || 0,
    property_discussion_quality: evaluationData.value.avgPropertyDiscussionQuality || 0,
    objection_handling: evaluationData.value.avgObjectionHandling || 0,
    booking_attempt_quality: evaluationData.value.avgBookingAttemptQuality || 0,
    tone_consistency: evaluationData.value.avgToneConsistency || 0,
    overall_call_flow: evaluationData.value.avgOverallCallFlow || 0
  }
  
  // Metric-driven suggestions (threshold < 7)
  if (metrics.opening_effectiveness < 7) {
    add(
      metrics.opening_effectiveness < 5 ? 'High' : 'Medium',
      'Improve Opening Effectiveness',
      "Focus on warmer greetings, faster rapport building, and confirming the lead's name early",
      'role_objective'
    )
  }
  
  if (metrics.property_discussion_quality < 7) {
    add(
      metrics.property_discussion_quality < 5 ? 'High' : 'Medium',
      'Enhance Property Discussion Quality',
      'Add more targeted questions about property details and equity calculations',
      'instructions_rules'
    )
  }
  
  if (metrics.objection_handling < 7) {
    add(
      metrics.objection_handling < 5 ? 'High' : 'Medium',
      'Strengthen Objection Handling',
      'Include techniques for reframing concerns and addressing common objections',
      'conversation_flow'
    )
  }
  
  if (metrics.booking_attempt_quality < 7) {
    add(
      metrics.booking_attempt_quality < 5 ? 'High' : 'Medium',
      'Improve Booking Attempts',
      'Make appointment requests clearer, more confident, and tied to value proposition',
      'conversation_flow'
    )
  }
  
  if (metrics.tone_consistency < 7) {
    add(
      'Medium',
      'Maintain Tone Consistency',
      'Review personality guidelines to ensure conversational and empathetic tone throughout',
      'personality_tone'
    )
  }
  
  if (metrics.overall_call_flow < 7) {
    add(
      metrics.overall_call_flow < 5 ? 'High' : 'Medium',
      'Optimize Call Flow',
      'Improve logical progression and pacing through better conversation structure',
      'conversation_flow'
    )
  }

  // Map common weaknesses to targeted suggestions
  if (evaluationData.value.commonWeaknesses && evaluationData.value.commonWeaknesses.length > 0) {
    evaluationData.value.commonWeaknesses.forEach((weak) => {
      const w = weak.toLowerCase()
      if (w.includes('repeat') || w.includes('repetition') || w.includes('loop')) {
        add(
          'High',
          'Eliminate Prompt Repetition',
          'Rewrite repeated prompts; add a "no-repeat" guard and state checks to avoid asking the same question twice.',
          'instructions_rules'
        )
      }
      if (w.includes('objection')) {
        add(
          'High',
          'Add Objection Handling Patterns',
          'Introduce concise templates for common objections and guidelines to answer before deferring.',
          'conversation_flow'
        )
      }
      if (w.includes('booking') || w.includes('close') || w.includes('tie-down')) {
        add(
          'High',
          'Tighten Booking Requests',
          'Offer two specific times, add a clear next-step close, and use gentle tie‑downs.',
          'conversation_flow'
        )
      }
      if (w.includes("caller") && w.includes('name')) {
        add(
          'Medium',
          'Confirm Caller Identity Early',
          "Add an early identity confirmation step (name + callback number) before account details.",
          'conversation_flow'
        )
      }
      if (w.includes('inconsistent') && (w.includes('phone') || w.includes('email'))) {
        add(
          'High',
          'Standardize Contact Detail Lines',
          'Provide one consistent phrasing for phone/email capture and reuse it verbatim across sections.',
          'output_format'
        )
      }
    })
  }

  // Map red flags directly to high‑priority suggestions (show first)
  if (evaluationData.value.redFlags && evaluationData.value.redFlags.length > 0) {
    evaluationData.value.redFlags.forEach((flag) => {
      const f = flag.toLowerCase()
      if (f.includes('script loop') || f.includes('repetition') || f.includes('repeat')) {
        add(
          'High',
          'Fix Script Loop / Repetition',
          'Remove duplicated lines and add an explicit loop‑guard policy; ensure state prevents re-asking prior questions.',
          'conversation_flow'
        )
        // Also add a rule-level improvement so the policy is explicit
        add(
          'High',
          'Add Non‑Repetition Policy',
          'Add a clear instruction: "Never repeat the same sentence verbatim; summarize once and move forward."',
          'instructions_rules'
        )
      }
      if (f.includes('inconsistent contact') || (f.includes('inconsistent') && (f.includes('phone') || f.includes('email')))) {
        add(
          'High',
          'Unify Contact Detail Phrasing',
          'Define a single canonical phone/email line and reference it everywhere to avoid drift.',
          'output_format'
        )
      }
      if (f.includes('deferral') || f.includes('defer') || f.includes('broker')) {
        add(
          'High',
          'Answer Basics Before Deferring',
          'Add guidance to attempt concise answers to basic consumer questions before escalating to a broker.',
          'instructions_rules'
        )
      }
    })
  }

  // Sort with High first, then Medium, then others
  const rank = (p) => (p === 'High' ? 0 : p === 'Medium' ? 1 : 2)
  suggestions.sort((a, b) => rank(a.priority) - rank(b.priority))
  
  // Return top items (ensure red‑flag fixes surface). Increase cap slightly to include criticals.
  return suggestions.slice(0, 6)
})

// Computed property to get active prompt object
const activePrompt = computed(() => {
  return prompts.value.find(p => p.id === activePromptId.value) || null
})

// Base version for diff comparison (the version we're comparing current version against)
const baseVersionForDiff = computed(() => {
  if (!currentVersion.value) return null
  
  // If this is a draft, compare against the active version
  if (currentVersion.value.is_draft && activeVersion.value) {
    return activeVersion.value
  }
  
  // If this is not the active version, compare against the active version
  if (!currentVersion.value.is_active && activeVersion.value) {
    return activeVersion.value
  }
  
  // If this IS the active version, compare against the previous version
  if (currentVersion.value.is_active && versions.value.length > 1) {
    // Find the version just before this one
    const currentIndex = versions.value.findIndex(v => v.id === currentVersion.value.id)
    // Check if there's a next version in the array (versions are sorted descending by version_number)
    if (currentIndex >= 0 && currentIndex < versions.value.length - 1) {
      return versions.value[currentIndex + 1] // Get the previous version number
    }
  }
  
  // No comparison available
  return null
})

// Get only sections that have changes
const sectionsWithChanges = computed(() => {
  if (!baseVersionForDiff.value || !currentVersion.value) return []
  
  return promptSections.filter(section => {
    const oldContent = baseVersionForDiff.value.content[section.key] || ''
    const newContent = currentVersion.value.content[section.key] || ''
    return oldContent !== newContent
  })
})

// Check if a section has changes
const hasChangesInSection = (sectionKey) => {
  if (!baseVersionForDiff.value || !currentVersion.value) return false
  
  const oldContent = baseVersionForDiff.value.content[sectionKey] || ''
  const newContent = currentVersion.value.content[sectionKey] || ''
  
  return oldContent !== newContent
}

// Get diff for a specific section
const getSectionDiff = (sectionKey) => {
  if (!baseVersionForDiff.value || !currentVersion.value) return []
  
  const oldContent = baseVersionForDiff.value.content[sectionKey] || ''
  const newContent = currentVersion.value.content[sectionKey] || ''
  
  return Diff.diffWords(oldContent, newContent)
}

// Helper functions
const getScoreClass = (score) => {
  if (score >= 8) return 'score-good'
  if (score >= 6) return 'score-fair'
  return 'score-poor'
}

const getScoreColor = (score) => {
  if (score >= 8) return 'rgba(34, 197, 94, 0.6)' // pastel green
  if (score >= 6) return 'rgba(251, 191, 36, 0.6)' // pastel yellow
  return 'rgba(239, 68, 68, 0.5)' // pastel red
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

// Map suggestion section names to actual section keys
const mapSuggestionSectionToKey = (suggestionSection) => {
  const mapping = {
    'role_objective': 'role',
    'personality_tone': 'personality',
    'instructions_rules': 'instructions',
    'conversation_flow': 'conversation_flow',
    'tools': 'tools',
    'context': 'context',
    'pronunciation': 'pronunciation',
    'output_format': 'output_format',
    'safety': 'safety'
  }
  return mapping[suggestionSection] || suggestionSection
}

// Apply suggestion to prompt
const applySuggestion = async (suggestion) => {
  // Map suggestion section to actual section key
  const sectionKey = mapSuggestionSectionToKey(suggestion.section)
  
  // Find the section object
  const section = promptSections.find(s => s.key === sectionKey)
  if (!section) {
    window.$message?.error(`Section not found: ${suggestion.section}`)
    return
  }
  
  // Open AI Improve modal for this section
  openAIImprove(section)
  
  // Pre-fill the user request with the suggestion description
  aiUserRequest.value = suggestion.description
  
  // Auto-run the AI improvement
  nextTick(() => {
    runAIImprove()
  })
  
  // Show notification
  window.$message?.info(`Applying suggestion: ${suggestion.title}`)
}

// Apply all suggestions at once
const applyAllSuggestions = async () => {
  console.log('🔵 applyAllSuggestions called', { suggestionCount: aiSuggestions.value?.length })
  
  if (!aiSuggestions.value || aiSuggestions.value.length === 0) {
    console.warn('No suggestions to apply')
    return
  }
  
  try {
    // Reset state
    applyAllResults.value = []
    applyAllProgress.value = []
    applyAllIsProcessing.value = true
    
    // Open modal immediately
    showApplyAllModal.value = true
    
    const totalCount = aiSuggestions.value.length
    applyAllProgress.value.push({
      type: 'info',
      message: `Starting to generate ${totalCount} AI improvements...`,
      timestamp: new Date()
    })
    
    // Generate AI improvements for each suggestion
    for (let i = 0; i < aiSuggestions.value.length; i++) {
      const suggestion = aiSuggestions.value[i]
      console.log(`🔧 Processing suggestion ${i + 1}/${aiSuggestions.value.length}:`, suggestion.title)
      
      // Map suggestion section to actual section key
      const sectionKey = mapSuggestionSectionToKey(suggestion.section)
      const section = promptSections.find(s => s.key === sectionKey)
      
      if (!section) {
        console.warn(`Section not found for suggestion: ${suggestion.section}`)
        applyAllProgress.value.push({
          type: 'error',
          message: `❌ Section not found: ${suggestion.section}`,
          timestamp: new Date()
        })
        continue
      }
      
      // Add "working on" message
      applyAllProgress.value.push({
        type: 'working',
        message: `Working on ${section.label}...`,
        section: section.label,
        timestamp: new Date()
      })
      
      // Set up the AI improvement
      aiImprovingSection.value = section
      aiUserRequest.value = suggestion.description
      
      // Run AI improvement and collect the result
      try {
        console.log(`⏳ Running AI improvement for: ${section.label}`)
        await runAIImprove()
        console.log(`✅ AI improvement completed for: ${section.label}`, { hasSuggestion: !!aiSuggestion.value })
        
        // If successful, save the result for review
        if (aiSuggestion.value) {
          const oldText = currentVersion.value.content[section.key] || ''
          const newText = aiSuggestion.value || ''
          const diff = Diff.diffWords(oldText, newText)
          
          applyAllResults.value.push({
            section: section,
            suggestion: suggestion,
            aiContent: aiSuggestion.value,
            diff: diff,
            oldContent: oldText
          })
          
          // Add "complete" message
          applyAllProgress.value.push({
            type: 'success',
            message: `✓ ${section.label} complete`,
            section: section.label,
            timestamp: new Date()
          })
          
          console.log(`📦 Added result for ${section.label}. Total results: ${applyAllResults.value.length}`)
        } else {
          console.warn(`No AI suggestion generated for ${section.label}`)
          applyAllProgress.value.push({
            type: 'error',
            message: `❌ Failed to generate improvement for ${section.label}`,
            section: section.label,
            timestamp: new Date()
          })
        }
      } catch (error) {
        console.error(`❌ Failed to generate improvement for ${section.label}:`, error)
        applyAllProgress.value.push({
          type: 'error',
          message: `❌ Error improving ${section.label}: ${error.message}`,
          section: section.label,
          timestamp: new Date()
        })
      }
    }
    
    console.log(`🎉 Finished processing. Total results: ${applyAllResults.value.length}`)
    
    // Add completion message
    applyAllProgress.value.push({
      type: 'success',
      message: `🎉 Finished! Generated ${applyAllResults.value.length} improvements.`,
      timestamp: new Date()
    })
    
    // Switch from processing to review mode
    applyAllIsProcessing.value = false
    
    // If no results, show error
    if (applyAllResults.value.length === 0) {
      console.error('No results to show')
      window.$message?.error(`Failed to generate improvements. Please try again or apply them individually.`)
      showApplyAllModal.value = false
    }
  } catch (error) {
    console.error('❌ Error in applyAllSuggestions:', error)
    window.$message?.error(`Error: ${error.message}`)
    applyAllIsProcessing.value = false
    showApplyAllModal.value = false
  }
}

// Accept all improvements from the batch review
const acceptAllImprovements = async () => {
  let appliedCount = 0
  
  // Apply each improvement to the content
  applyAllResults.value.forEach(result => {
    currentVersion.value.content[result.section.key] = result.aiContent
    
    // Mark this suggestion as applied
    appliedSuggestions.value.add(result.section.key)
    
    appliedCount++
  })
  
  // Save applied suggestions to database
  try {
    const appliedArray = Array.from(appliedSuggestions.value)
    const { error: updateError } = await supabase
      .from('prompt_versions')
      .update({ applied_suggestions: appliedArray })
      .eq('id', currentVersion.value.id)
    
    if (updateError) {
      console.error('Failed to save applied suggestions:', updateError)
    }
  } catch (error) {
    console.error('Error updating applied suggestions:', error)
  }
  
  // Close modal and switch to editor FIRST
  showApplyAllModal.value = false
  applyAllResults.value = []
  activeTab.value = 'editor'
  
  // Wait for editor tab to render, THEN update the UI
  await nextTick()
  await nextTick() // Double nextTick ensures editor is fully rendered
  
  populateContentEditableDivs()
  markAsChanged()
  
  window.$message?.success(`Successfully applied all ${appliedCount} improvements! Review and save when ready.`)
}

// Cancel all improvements
const cancelAllImprovements = () => {
  showApplyAllModal.value = false
  applyAllResults.value = []
  window.$message?.info('Cancelled all improvements')
}

// Fetch evaluation data for current prompt version
const fetchEvaluationData = async () => {
  console.log('🔍 fetchEvaluationData called', {
    hasCurrentVersion: !!currentVersion.value,
    hasActivePrompt: !!activePrompt.value,
    currentVersionId: currentVersion.value?.id,
    activePromptCallType: activePrompt.value?.call_type,
    versionNumber: currentVersion.value?.version_number
  })
  
  // Note: We don't clear appliedSuggestions here - they persist from the database
  
  if (!currentVersion.value || !activePrompt.value) {
    console.log('⚠️ Missing version or prompt, skipping evaluation fetch')
    evaluationData.value = null
    return
  }
  
  evaluationLoading.value = true
  
  try {
    // Format: "inbound-qualified-v3" or "outbound-warm-v2"
    const promptVersion = `${activePrompt.value.call_type}-v${currentVersion.value.version_number}`
    console.log('🔍 Querying evaluations for prompt_version:', promptVersion)
    
    // DEBUG: Also query ALL evaluations to see what's in the database
    const { data: allEvals, error: debugError } = await supabase
      .from('call_evaluations')
      .select('prompt_version, evaluated_at, overall_score')
      .order('evaluated_at', { ascending: false })
      .limit(10)
    
    console.log('📊 Recent evaluations in database:')
    console.table(allEvals?.map(e => ({
      'Prompt Version': e.prompt_version,
      'Score': e.overall_score,
      'Time': new Date(e.evaluated_at).toLocaleString()
    })))
    if (debugError) console.error('Debug query error:', debugError)
    
    // Query Supabase for evaluations matching this prompt_version
    const { data, error: queryError } = await supabase
      .from('call_evaluations')
      .select('*')
      .eq('prompt_version', promptVersion)
    
    if (queryError) {
      console.error('❌ Error fetching evaluation data:', queryError)
      evaluationData.value = null
      return
    }
    
    console.log('📊 Evaluation query result:', { count: data?.length || 0, data })
    
    if (!data || data.length === 0) {
      console.log('⚠️ No evaluations found for', promptVersion)
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

// Fetch performance metrics for ALL versions (for activity rings on cards)
async function fetchAllVersionMetrics() {
  if (!activePrompt.value) return
  
  try {
    // Query all evaluations for this prompt type
    const { data, error: queryError } = await supabase
      .from('call_evaluations')
      .select('prompt_version, overall_score, booking_attempt_quality, tone_consistency')
      .like('prompt_version', `${activePrompt.value.call_type}%`)
    
    if (queryError) {
      console.error('❌ Error fetching version metrics:', queryError)
      return
    }
    
    if (!data || data.length === 0) {
      versionMetrics.value = {}
      return
    }
    
    // Group by version and calculate averages
    const grouped = {}
    data.forEach(evaluation => {
      const version = evaluation.prompt_version
      if (!grouped[version]) {
        grouped[version] = {
          overall_scores: [],
          booking_scores: [],
          tone_scores: []
        }
      }
      if (evaluation.overall_score) grouped[version].overall_scores.push(parseFloat(evaluation.overall_score))
      if (evaluation.booking_attempt_quality) grouped[version].booking_scores.push(evaluation.booking_attempt_quality)
      if (evaluation.tone_consistency) grouped[version].tone_scores.push(evaluation.tone_consistency)
    })
    
    // Calculate averages
    const metrics = {}
    Object.keys(grouped).forEach(version => {
      const g = grouped[version]
      metrics[version] = {
        overall: g.overall_scores.length > 0 ? g.overall_scores.reduce((a, b) => a + b, 0) / g.overall_scores.length : null,
        booking: g.booking_scores.length > 0 ? g.booking_scores.reduce((a, b) => a + b, 0) / g.booking_scores.length : null,
        tone: g.tone_scores.length > 0 ? g.tone_scores.reduce((a, b) => a + b, 0) / g.tone_scores.length : null,
        count: g.overall_scores.length
      }
    })
    
    versionMetrics.value = metrics
    console.log('📊 Version metrics loaded:', metrics)
  } catch (err) {
    console.error('❌ Failed to fetch version metrics:', err)
  }
}

// Watch for version changes to fetch evaluation data
watch([currentVersion, activePrompt], () => {
  fetchEvaluationData()
  fetchAllVersionMetrics()
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
    // Load runtime settings
    selectedRuntime.value = promptData.runtime || 'elevenlabs'
    
    // Load Realtime (V3) settings
    selectedVoice.value = promptData.voice || 'shimmer'
    vadThreshold.value = promptData.vad_threshold || 0.5
    vadPrefixPaddingMs.value = promptData.vad_prefix_padding_ms || 300
    vadSilenceDurationMs.value = promptData.vad_silence_duration_ms || 500
    
    // Load ElevenLabs defaults
    const elevenLabsDefaults = promptData.elevenlabs_defaults || {}
    elevenLabsVoiceId.value = elevenLabsDefaults.voice_id || '6aDn1KB0hjpdcocrUkmq'
    elevenLabsFirstMessage.value = elevenLabsDefaults.first_message || 'Hi, this is Barbara with Equity Connect. How are you today?'
    elevenLabsVoiceSpeed.value = elevenLabsDefaults.voice_speed || 0.85
    elevenLabsAgentLanguage.value = elevenLabsDefaults.agent_language || 'en'
    elevenLabsVoiceStability.value = elevenLabsDefaults.voice_stability || 0.5
    elevenLabsVoiceSimilarity.value = elevenLabsDefaults.voice_similarity || 0.75
    
    currentPromptMetadata.value = {
      name: promptData.name,
      purpose: promptData.purpose || '',
      goal: promptData.goal || '',
      call_type: promptData.call_type
    }
    
    settingsHasChanges.value = false
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
    // NOTE: Do NOT reload prompts here - they're already loaded and sorted by loadPrompts()
    // Just use the existing prompts.value array (which is already sorted alphabetically)

    // Use the currently selected prompt, or default to first one (alphabetically)
    const targetPromptId = activePromptId.value || (prompts.value.length > 0 ? prompts.value[0].id : null)
    if (!targetPromptId) {
      throw new Error('No prompts available')
    }
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
    
    // Load applied suggestions from database
    appliedSuggestions.value.clear()
    if (data.applied_suggestions && Array.isArray(data.applied_suggestions)) {
      data.applied_suggestions.forEach(sectionKey => {
        appliedSuggestions.value.add(sectionKey)
      })
    }
    
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
      const currentVersionId = currentVersion.value.id
      
      const { error: updateError } = await supabase
        .from('prompt_versions')
        .update({
          content: currentVersion.value.content,
          variables: extractedVariables.value
        })
        .eq('id', currentVersionId)

      if (updateError) throw updateError

      hasChanges.value = false
      
      // Reload to refresh the version card and stay on the current draft
      await loadVersions()
      await loadVersion(currentVersionId)
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
  aiDiff.value = []
  showAIImproveModal.value = true
}

function closeAIImprove() {
  showAIImproveModal.value = false
  aiImprovingSection.value = null
  aiUserRequest.value = ''
  aiSuggestion.value = ''
  aiChanges.value = []
  aiDiff.value = []
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
        - Common tools: get_lead_context, search_knowledge, check_broker_availability, book_appointment
- Keep descriptions concise but clear about purpose`,

    instructions: `INSTRUCTIONS & RULES GUIDELINES:
- Use numbered or bulleted list format
- Start with "CRITICAL RULES:"
- Include edge cases and error handling
- Qualification logic (if applicable)
- Compliance requirements
- What NOT to do
- When to transfer/escalate
- Non‑repetition policy: Never ask the same question verbatim more than once; after one re‑prompt, summarize and move forward or escalate.
Example format:
"CRITICAL RULES:
1. **Rule Name**: Explanation
2. **Another Rule**: Explanation"`,

    conversation_flow: `CONVERSATION FLOW GUIDELINES (PROVEN IN PRODUCTION):
**USE SIMPLE ACTION FORMAT with arrows (→) - this works better than Goal/Exit/Next:**

# Step Transitions (at top - shows natural progression)
- After Greeting → Purpose: "what brought you to call?"
- After Purpose → Verify: verify email, property, phone
- After Verify → Q&A: "what questions do you have?"
- After Q&A → Booking: "want to set up a time?"
- During Tool Latency: rotate fillers

# Opening (PACED - One Question at a Time)
- "Equity Connect, this is Barbara. Hi {{leadFirstName}}, how are you?"
- (call get_lead_context tool)
- WAIT for their answer
- THEN: "What brought you to call today?"
- If they say "I have questions" / "wanted to ask" → Opening COMPLETE, move to Verify
- Brief acknowledgment: "Got it"
- SAY-ONCE: Don\'t repeat greeting or purpose lines

# Verify Contact (Add Security Transition)
- "Before we dive in, let me make sure I have the right information pulled up for you..."
- Verify email → property → phone
- update_lead_info if needed
- Then → Q&A

# Q&A (HARD LOOP - CRITICAL)
- Answer question (1-2 sentences)
- IMMEDIATELY in SAME turn: "Anything else?" or "What else?"
- MANDATORY - never skip this follow-up
- If user pushes back: Acknowledge ("I hear you"), VARY response, add detail
- Exit only on explicit: "no", "that\'s it", "I\'m good"

**CRITICAL RULES:**
- Use arrows (→) to show flow naturally
- Action bullets with example phrases (AI copies these exactly)
- SAY-ONCE guards prevent loops
- Hard loops need explicit exit phrases
- One question per turn - WAIT for answer before next question

**DO NOT use verbose Goal/Exit/Next format (tested poorly):**
## Section
- Goal: Abstract description
- Exit when: Vague condition
- Next: Proceed to...
(AI gets confused with this format - use simple action bullets instead!)

Reference: Field-tested production format`,

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
      'Add Step Transitions section at top',
      'Use arrows (→) to show flow between sections',
      'Add SAY-ONCE guards to prevent repeating',
      'Add security transition before verification'
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
    const systemPrompt = `Improve this prompt section for OpenAI Realtime API voice calls.

SECTION: ${aiImprovingSection.value.label}
CURRENT CONTENT (${(currentVersion.value.content[aiImprovingSection.value.key] || '').split('\n').length} lines):
${currentVersion.value.content[aiImprovingSection.value.key] || '(empty)'}

USER REQUEST: ${aiUserRequest.value}

REALTIME API BEST PRACTICES (Field-Tested):
- Bullets over paragraphs (clear bullets outperform long text)
- Guide with sample phrases (model copies exact phrases)
- 2-3 sentences per turn MAX
- Stop talking IMMEDIATELY if caller speaks
- Use variety rule (rotate phrasing to avoid robotic repetition)
- Convert numbers to words ("sixty-two" not "62")
- Tool latency fillers ("one moment...", "let me check...")
- Natural micro-utterances ("mm-hmm", "got it", soft breath)

CONVERSATION FLOW STRUCTURE (PROVEN FORMAT):
Use SIMPLE ACTION BULLETS with arrow flow (→) - this works better than verbose Goal/Exit/Next:

# Step Transitions (at top)
- After Greeting → Purpose: "what brought you to call?"
- After Purpose → Verify: verify email, property, phone
- After Verify → Q&A: "what questions do you have?"
- After Q&A → Booking: "want to set up a time?"

# Opening (PACED)
- "Equity Connect, this is Barbara. Hi [FirstName], how are you?"
- (call get_lead_context tool)
- WAIT for answer
- THEN: "What brought you to call today?"
- If "I have questions" → Opening COMPLETE, move to Verify
- Brief: "Got it"
- SAY-ONCE: Don\'t repeat greeting/purpose

# Verify Contact (Security Transition)
- "Before we dive in, let me make sure I have the right information..."
- Email → Property → Phone
- Then → Q&A

# Q&A (HARD LOOP)
- Answer + "Anything else?" in SAME turn (mandatory)
- If pushed: Acknowledge, VARY response
- Until explicit "no"

KEY RULES:
- Use arrows (→) to show flow, not verbose "Next: Proceed to..."
- Action-oriented bullets, not abstract goals
- Explicit phrase examples (AI copies these)
- SAY-ONCE guards to prevent loops
- Hard loops with clear exit phrases ("no", "that\'s it")

Reference: Based on production testing, not just cookbook theory

CONSTRAINTS (CRITICAL - ENFORCE THESE):
1. MAXIMUM 50 LINES total
2. Use BULLETS, not paragraphs
3. SIMPLIFY and CONDENSE (make it SHORTER, not longer)
4. Remove redundancy and repetition
5. Preserve {{variables}} exactly
6. **INCREMENTAL CHANGES ONLY** - Modify/add to the existing content, DO NOT replace the entire section
7. Keep all unrelated parts of the section intact - only change what the user requested
8. If adding content, REMOVE other content to stay under 50 lines
9. Return the FULL section with your modifications (preserve everything the user didn't ask to change)
10. Focus on clarity and actionability
11. **FOR CONVERSATION_FLOW: Use state-based format with Goal/Exit/Next - DO NOT create bullet lists without exit conditions**`

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
            content: 'You are a prompt-refinement assistant specializing in OpenAI Realtime API voice prompts. You ONLY return the improved content for the specific section being edited - NO metadata, NO section headers, NO explanations. Maintain all original formatting, indentation, line breaks, and {{variables}} exactly. Follow Realtime API best practices: ultra-brief responses, interrupt-friendly design, numbers as words, tool latency fillers, micro-utterances.'
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
    
    // Generate redline diff between original and AI-improved content
    const oldText = currentVersion.value.content[aiImprovingSection.value.key] || ''
    const newText = aiSuggestion.value || ''
    aiDiff.value = Diff.diffWords(oldText, newText)
    
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

async function acceptAISuggestion() {
  console.log('🟢 acceptAISuggestion called', {
    hasAiSuggestion: !!aiSuggestion.value,
    improvingSection: aiImprovingSection.value?.key,
    currentContent: currentVersion.value?.content[aiImprovingSection.value?.key]?.substring(0, 50) + '...'
  })
  
  if (!aiSuggestion.value || !aiImprovingSection.value) {
    console.error('❌ Missing aiSuggestion or aiImprovingSection')
    return
  }
  
  // Update the current version content
  currentVersion.value.content[aiImprovingSection.value.key] = aiSuggestion.value
  console.log('✅ Updated content for section:', aiImprovingSection.value.key)
  
  // Mark this suggestion as applied
  appliedSuggestions.value.add(aiImprovingSection.value.key)
  
  // Save applied suggestions to database
  try {
    const appliedArray = Array.from(appliedSuggestions.value)
    const { error: updateError } = await supabase
      .from('prompt_versions')
      .update({ applied_suggestions: appliedArray })
      .eq('id', currentVersion.value.id)
    
    if (updateError) {
      console.error('Failed to save applied suggestions:', updateError)
    } else {
      console.log('✅ Saved applied suggestions to DB')
    }
  } catch (error) {
    console.error('Error updating applied suggestions:', error)
  }
  
  // Update the textarea
  console.log('🔄 Updating UI via populateContentEditableDivs and markAsChanged')
  await nextTick()
  populateContentEditableDivs()
  markAsChanged()
  console.log('✅ UI updated, hasChanges:', hasChanges.value)
  
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
  auditRecommendationDiffs.value = {}
  appliedAuditRecommendations.value = new Set()
  showAuditQuestionsModal.value = true
}

function closeAuditQuestions() {
  showAuditQuestionsModal.value = false
}

function closeAuditResults() {
  showAuditResultsModal.value = false
  auditRecommendationDiffs.value = {}
  // Don't reset appliedAuditRecommendations - keep track of what was applied across opens
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
    
    // Get valid section keys for GPT-5 to use
    const validSectionKeys = Object.keys(currentVersion.value.content).join(', ')
    
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

REALTIME API BEST PRACTICES (Field-Tested):
- Bullets over paragraphs (clear bullets outperform long text)
- Guide with sample phrases (model copies exact phrases)
- 2-3 sentences per turn MAX
- Stop talking IMMEDIATELY if caller speaks
- Use variety rule (rotate phrasing to avoid robotic repetition)
- Convert numbers to words ("sixty-two" not "62")
- Tool latency fillers ("one moment...", "let me check...")
- Natural micro-utterances ("mm-hmm", "got it", soft breath)

CONVERSATION FLOW STRUCTURE (PROVEN IN PRODUCTION):
Use SIMPLE ACTION BULLETS with arrow flow (→):
- Step Transitions section at top showing progression
- Action bullets with example phrases
- Arrows (→) to show natural flow
- SAY-ONCE guards to prevent loops
- Hard loops with explicit exit phrases

DO NOT use verbose Goal/Exit/Next format (causes confusion):
## Section
- Goal: Abstract description
- Exit when: Vague condition
(This format tested poorly - AI gets confused!)

DO use concise action format (works great):
# Opening (PACED)
- "Hi [FirstName], how are you?"
- WAIT for answer
- THEN: "What brought you to call?"
- If "I have questions" → move to Q&A
- SAY-ONCE: Don\'t repeat

Reference: Field-tested production format, not just theory

EVALUATION CRITERIA:
1. Brevity and clarity (shorter is better)
2. Consistency across all sections (tone, terminology, flow)
3. Alignment with stated purpose and conversion goal
4. Handling of target profile and edge cases
5. Variable usage and syntax correctness
6. Known issues addressed

ANTI-BLOAT CONSTRAINTS (CRITICAL):
- Each section recommendation MUST be under 50 lines
- SIMPLIFY and CONDENSE - don't expand
- Use BULLETS, not paragraphs
- Remove redundancy, don't add complexity
- If suggesting additions, ALSO suggest removals to keep length under control
- Focus on making prompts SHORTER and CLEARER
- ONE instruction per bullet
- NO nested structures or loops

CRITICAL: VALID SECTION KEYS
You MUST only provide recommendations for these exact section keys: ${validSectionKeys}
DO NOT invent new sections like "realtime_api_settings" or "system_config" - only use the sections listed above.
If you want to recommend Realtime API settings changes, put them in the "instructions" or "context" section.

REQUIRED OUTPUT FORMAT (MUST BE VALID JSON):
{
  "score": <number 0-100>,
  "strengths": ["strength 1", "strength 2", ...],
  "weaknesses": ["weakness 1", "weakness 2", ...],
  "criticalIssues": ["critical issue 1", "critical issue 2", ...],
  "recommendations": [
    {
      "section": "section_key",  // MUST be one of: ${validSectionKeys}
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
    
    // Generate redline diffs for each recommendation
    auditRecommendationDiffs.value = {}
    auditResults.value.recommendations.forEach((rec, idx) => {
      if (rec.section && rec.suggestion) {
        const oldText = currentVersion.value.content[rec.section] || ''
        const newText = rec.suggestion || ''
        auditRecommendationDiffs.value[idx] = Diff.diffWords(oldText, newText)
      }
    })
    
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

function applyAuditRecommendation(recommendation, recommendationIndex) {
  console.log('🔧 Applying audit recommendation:', recommendation)
  
  if (!recommendation.section || !recommendation.suggestion) {
    console.error('❌ Missing section or suggestion:', recommendation)
    window.$message?.error('Cannot apply recommendation: missing section or suggestion')
    return
  }
  
  // Find the matching section key (case-insensitive)
  const sectionKeys = Object.keys(currentVersion.value.content)
  const matchingKey = sectionKeys.find(key => 
    key.toLowerCase() === recommendation.section.toLowerCase()
  )
  
  if (!matchingKey) {
    console.error('❌ Section not found:', recommendation.section, 'Available keys:', sectionKeys)
    window.$message?.error(`Section "${recommendation.section}" not found in prompt`)
    return
  }
  
  console.log('✅ Found matching section key:', matchingKey)
  
  // Update the current version content with the recommendation
  currentVersion.value.content[matchingKey] = recommendation.suggestion
  
  // Mark this recommendation as applied
  if (recommendationIndex !== undefined) {
    appliedAuditRecommendations.value.add(recommendationIndex)
  }
  
  // Update the textarea
  nextTick(() => {
    populateContentEditableDivs()
    markAsChanged()
  })
  
  window.$message?.success(`Applied recommendation to ${matchingKey}. Don't forget to save.`)
}

function applyAllAuditRecommendations() {
  console.log('🔧 Applying all audit recommendations:', auditResults.value.recommendations.length)
  
  if (!auditResults.value.recommendations || auditResults.value.recommendations.length === 0) {
    window.$message?.warning('No recommendations to apply')
    return
  }
  
  let appliedCount = 0
  let failedCount = 0
  
  auditResults.value.recommendations.forEach((rec, index) => {
    try {
      if (!rec.section || !rec.suggestion) {
        console.warn('⚠️ Skipping invalid recommendation:', rec)
        failedCount++
        return
      }
      
      // Find the matching section key (case-insensitive)
      const sectionKeys = Object.keys(currentVersion.value.content)
      const matchingKey = sectionKeys.find(key => 
        key.toLowerCase() === rec.section.toLowerCase()
      )
      
      if (!matchingKey) {
        console.warn('⚠️ Section not found:', rec.section)
        failedCount++
        return
      }
      
      // Update the current version content with the recommendation
      currentVersion.value.content[matchingKey] = rec.suggestion
      
      // Mark this recommendation as applied
      appliedAuditRecommendations.value.add(index)
      
      appliedCount++
      console.log(`✅ Applied recommendation ${index + 1}/${auditResults.value.recommendations.length}`)
    } catch (error) {
      console.error('❌ Failed to apply recommendation:', error, rec)
      failedCount++
    }
  })
  
  // Update the textarea
  nextTick(() => {
    populateContentEditableDivs()
    markAsChanged()
  })
  
  if (appliedCount > 0) {
    window.$message?.success(`Applied ${appliedCount} recommendation${appliedCount > 1 ? 's' : ''}. Don't forget to save.`)
  }
  
  if (failedCount > 0) {
    window.$message?.warning(`Failed to apply ${failedCount} recommendation${failedCount > 1 ? 's' : ''}. Check console for details.`)
  }
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

// Get color with intensity based on score (0-10 scale)
// Higher score = brighter color, Lower score = dimmer color
function getColorWithIntensity(baseHue, score) {
  if (score === null || score === undefined) {
    return `hsla(${baseHue}, 20%, 70%, 0.3)` // Very dim/gray for no data
  }
  
  // Score 0-10, target is 8
  // 8+ = full brightness
  // 6-7.9 = medium brightness  
  // <6 = low brightness
  
  let saturation, lightness, alpha
  
  if (score >= 8) {
    // Great score - bright, vibrant
    saturation = 85
    lightness = 50
    alpha = 1
  } else if (score >= 6) {
    // Medium score - moderate brightness
    saturation = 60
    lightness = 55
    alpha = 0.8
  } else {
    // Poor score - dim, muted
    saturation = 40
    lightness = 60
    alpha = 0.6
  }
  
  return `hsla(${baseHue}, ${saturation}%, ${lightness}%, ${alpha})`
}

// Get color for performance metrics with varied hues
function getMetricColorWithIntensity(score, metricKey) {
  // Each metric gets its own hue, brightness varies based on score
  const hueMap = {
    'opening_effectiveness': 210,    // Blue
    'property_discussion_quality': 140, // Green
    'objection_handling': 30,        // Orange
    'booking_attempt_quality': 0,    // Red
    'tone_consistency': 270,         // Purple
    'overall_call_flow': 190         // Cyan/Teal
  }
  
  const hue = hueMap[metricKey] || 250 // Default to indigo if not found
  return getColorWithIntensity(hue, score)
}

// Get ring data for a version
function getVersionRings(version) {
  const promptVersion = `${activePrompt.value?.call_type}-v${version.version_number}`
  const metrics = versionMetrics.value[promptVersion]
  
  if (!metrics) {
    // No data yet - show empty/dim rings
    return [
      { value: 0, max: 10, color: getColorWithIntensity(0, null), label: 'Overall' }, // Red hue = 0
      { value: 0, max: 10, color: getColorWithIntensity(120, null), label: 'Booking' }, // Green hue = 120
      { value: 0, max: 10, color: getColorWithIntensity(210, null), label: 'Tone' } // Blue hue = 210
    ]
  }
  
  return [
    { 
      value: metrics.overall || 0, 
      max: 10, 
      color: getColorWithIntensity(0, metrics.overall), // Red hue
      label: 'Overall' 
    },
    { 
      value: metrics.booking || 0, 
      max: 10, 
      color: getColorWithIntensity(120, metrics.booking), // Green hue
      label: 'Booking' 
    },
    { 
      value: metrics.tone || 0, 
      max: 10, 
      color: getColorWithIntensity(210, metrics.tone), // Blue hue
      label: 'Tone' 
    }
  ]
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
  // Just return the database name directly (no abbreviations)
  return callType || 'unknown'
}

function getCallTypeLabel(callType) {
  const labelMap = {
    'inbound-qualified': 'inbound-qualified',
    'inbound-unqualified': 'inbound-unqualified',
    'outbound-warm': 'outbound-warm',
    'outbound-cold': 'outbound-cold',
    'transfer': 'transfer',
    'callback': 'callback',
    'broker-schedule-check': 'broker-schedule-check',
    'broker-connect-appointment': 'broker-connect-appointment',
    'fallback': 'fallback'
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
  
  const variableText = `$${variableKey}`  // Python string.Template syntax for agent-side substitution
  
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

function insertMarkdown(sectionKey, prefix, suffix) {
  if (!currentVersion.value) return
  
  const textarea = textareaRefs.value[sectionKey]
  if (!textarea) return
  
  textarea.focus()
  
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    // No selection - insert at end
    const currentContent = currentVersion.value.content[sectionKey] || ''
    currentVersion.value.content[sectionKey] = currentContent + (currentContent ? '\n' : '') + prefix + suffix
    
    nextTick(() => {
      textarea.innerText = currentVersion.value.content[sectionKey]
      autoResizeTextarea(sectionKey)
    })
    
    markAsChanged()
    return
  }
  
  const range = selection.getRangeAt(0)
  
  // If suffix exists (like bold **text**), wrap selected text
  if (suffix) {
    const selectedText = range.toString()
    if (selectedText) {
      // Wrap selection
      range.deleteContents()
      const wrappedText = prefix + selectedText + suffix
      const textNode = document.createTextNode(wrappedText)
      range.insertNode(textNode)
      range.setStartAfter(textNode)
      range.collapse(true)
    } else {
      // No selection - insert prefix and suffix with cursor in between
      const prefixNode = document.createTextNode(prefix)
      const suffixNode = document.createTextNode(suffix)
      range.insertNode(suffixNode)
      range.insertNode(prefixNode)
      range.setStart(prefixNode, prefix.length)
      range.collapse(true)
    }
  } else {
    // No suffix (like bullet or number) - insert prefix at cursor
    range.deleteContents()
    const textNode = document.createTextNode(prefix)
    range.insertNode(textNode)
    range.setStartAfter(textNode)
    range.collapse(true)
  }
  
  selection.removeAllRanges()
  selection.addRange(range)
  
  // Update the model
  currentVersion.value.content[sectionKey] = textarea.innerText
  
  // Auto-resize
  nextTick(() => {
    autoResizeTextarea(sectionKey)
  })
  
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

// Runtime Settings Handlers
async function saveRuntimeSettings() {
  if (!activePromptId.value) return
  
  loading.value = true
  try {
    const updateData = {
      runtime: selectedRuntime.value
    }
    
    // Save runtime-specific settings
    if (selectedRuntime.value === 'elevenlabs') {
      updateData.elevenlabs_defaults = {
        voice_id: elevenLabsVoiceId.value,
        first_message: elevenLabsFirstMessage.value,
        voice_speed: elevenLabsVoiceSpeed.value,
        agent_language: elevenLabsAgentLanguage.value,
        voice_stability: elevenLabsVoiceStability.value,
        voice_similarity: elevenLabsVoiceSimilarity.value
      }
    } else if (selectedRuntime.value === 'realtime') {
      updateData.voice = selectedVoice.value
      updateData.vad_threshold = vadThreshold.value
      updateData.vad_prefix_padding_ms = vadPrefixPaddingMs.value
      updateData.vad_silence_duration_ms = vadSilenceDurationMs.value
    }
    
    const { error: updateError } = await supabase
      .from('prompts')
      .update(updateData)
      .eq('id', activePromptId.value)
    
    if (updateError) throw updateError
    
    settingsHasChanges.value = false
    window.$message?.success('Runtime settings saved successfully')
  } catch (err) {
    console.error('Failed to save runtime settings:', err)
    window.$message?.error('Failed to save runtime settings')
  } finally {
    loading.value = false
  }
}

async function resetRuntimeToDefaults() {
  if (!activePromptId.value) return
  
  if (selectedRuntime.value === 'elevenlabs') {
    // Reset ElevenLabs defaults
    elevenLabsVoiceId.value = '6aDn1KB0hjpdcocrUkmq' // Tiffany
    elevenLabsFirstMessage.value = 'Hi, this is Barbara with Equity Connect. How are you today?'
    elevenLabsVoiceSpeed.value = 0.85
    elevenLabsAgentLanguage.value = 'en'
    elevenLabsVoiceStability.value = 0.5
    elevenLabsVoiceSimilarity.value = 0.75
  } else if (selectedRuntime.value === 'realtime') {
    // Reset Realtime defaults
    selectedVoice.value = 'shimmer'
    vadThreshold.value = 0.5
    vadPrefixPaddingMs.value = 300
    vadSilenceDurationMs.value = 500
  }
  
  settingsHasChanges.value = true
  window.$message?.info('Settings reset to defaults. Click Save to apply.')
}

function handleRuntimeChange(runtime) {
  selectedRuntime.value = runtime
  settingsHasChanges.value = true
}

function handleElevenLabsSettingChange() {
  settingsHasChanges.value = true
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
    
    // Sort alphabetically by name (A-Z) - force lowercase comparison for consistency
    prompts.value = (data || []).sort((a, b) => {
      const nameA = (a.name || '').toLowerCase()
      const nameB = (b.name || '').toLowerCase()
      if (nameA < nameB) return -1
      if (nameA > nameB) return 1
      return 0
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

// Build a compact snapshot of all other sections to avoid duplication when improving a single section
function getOtherSectionsSnapshot(excludeKey) {
  if (!currentVersion.value || !currentVersion.value.content) return '(no context)'
  const maxChars = 600
  return promptSections
    .filter(s => s.key !== excludeKey)
    .map(s => {
      const text = (currentVersion.value.content[s.key] || '').slice(0, maxChars)
      return `### ${s.label} (${s.key})\n${text || '(empty)'}\n`
    })
    .join('\n')
}

// Add Cleanup flow state
const showCleanupModal = ref(false)
const cleanupIsProcessing = ref(false)
const cleanupResults = ref([])
const cleanupProgress = ref([])

// Generate a cleaned-up version of each section with de-duplication and policy insertion
const runPromptCleanup = async () => {
  if (!currentVersion.value) return
  cleanupResults.value = []
  cleanupProgress.value = []
  cleanupIsProcessing.value = true
  showCleanupModal.value = true

  try {
    const fullPromptContent = Object.entries(currentVersion.value.content)
      .map(([key, value]) => `### ${key.toUpperCase()}\n${value || '(empty)'}`)
      .join('\n\n')

    for (let i = 0; i < promptSections.length; i++) {
      const section = promptSections[i]
      const oldText = currentVersion.value.content[section.key] || ''

      cleanupProgress.value.push({
        type: 'working',
        message: `Cleaning ${section.label}...`,
        section: section.label,
        timestamp: new Date()
      })

      const cleanupPrompt = `Clean this prompt section for OpenAI Realtime API voice calls.

SECTION: ${section.label}
CURRENT CONTENT (${oldText.split('\n').length} lines):
${oldText}

REALTIME API BEST PRACTICES (from OpenAI):
- Bullets over paragraphs
- Guide with sample phrases (model copies them exactly)
- 2-3 sentences per turn MAX
- Variety rule (rotate phrasing to avoid repetition)
- Convert numbers to words
- Tool latency fillers
- Micro-utterances

CLEANUP GOALS:
- Remove duplicate sentences/lines
- SIMPLIFY and CONDENSE (make it shorter)
- Use bullets, not paragraphs
- Keep variables {{likeThis}} intact

ANTI-BLOAT CONSTRAINTS (CRITICAL):
- MAXIMUM 50 LINES for this section (current: ${oldText.split('\n').length} lines)
- CONDENSE and SIMPLIFY - make it SHORTER
- Use BULLETS, not paragraphs
- Remove redundancy and repetition
- ONE instruction per bullet
- NO nested structures
- If adding content, REMOVE other content to stay under 50 lines

RETURN FORMAT:
- Return ONLY the cleaned content for the section ${section.label} (${section.key}). No headers, no extra text.

FULL PROMPT CONTEXT:
${fullPromptContent}

SECTION TO CLEAN: ${section.label} (${section.key})
CURRENT SECTION CONTENT:
${oldText}`

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          messages: [
            { role: 'system', content: 'You return ONLY the cleaned section content. Preserve formatting and variables exactly. No explanations.' },
            { role: 'user', content: cleanupPrompt }
          ],
          max_completion_tokens: 4000
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('OpenAI Cleanup Error:', errorData)
        cleanupProgress.value.push({
          type: 'error',
          message: `❌ Error cleaning ${section.label}: ${response.status}`,
          section: section.label,
          timestamp: new Date()
        })
        continue
      }

      const data = await response.json()
      const cleaned = data.choices[0].message.content || ''

      const diff = Diff.diffWords(oldText, cleaned)
      cleanupResults.value.push({ section, aiContent: cleaned, diff, oldContent: oldText })

      cleanupProgress.value.push({
        type: 'success',
        message: `✓ ${section.label} cleaned`,
        section: section.label,
        timestamp: new Date()
      })
    }

    cleanupIsProcessing.value = false
    if (cleanupResults.value.length === 0) {
      showCleanupModal.value = false
      window.$message?.warning('No cleanup changes were generated.')
    }
  } catch (error) {
    console.error('❌ Cleanup error:', error)
    cleanupIsProcessing.value = false
    showCleanupModal.value = false
    window.$message?.error('Failed to run cleanup. Please try again.')
  }
}

const acceptAllCleanupChanges = async () => {
  let applied = 0
  cleanupResults.value.forEach(result => {
    currentVersion.value.content[result.section.key] = result.aiContent
    applied++
  })
  nextTick(() => {
    populateContentEditableDivs()
    markAsChanged()
  })
  showCleanupModal.value = false
  window.$message?.success(`Applied ${applied} cleanup change${applied === 1 ? '' : 's'}. Don't forget to save.`)
}

const cancelCleanup = () => {
  showCleanupModal.value = false
  cleanupIsProcessing.value = false
  cleanupResults.value = []
  cleanupProgress.value = []
}

// =======================
// NODE-BASED PROMPT MANAGEMENT
// =======================

function getCurrentNodeDescription() {
  const node = nodeList.find(n => n.name === selectedNode.value)
  return node ? node.desc : ''
}

async function loadTheme() {
  if (!selectedVertical.value) {
    themeContent.value = ''
    themeHasChanges.value = false
    return
  }
  
  themeLoading.value = true
  try {
    const { data, error } = await supabase
      .from('theme_prompts')
      .select('content')
      .eq('vertical', selectedVertical.value)
      .eq('is_active', true)
      .maybeSingle()
    
    if (error) throw error
    
    if (data && data.content) {
      themeContent.value = data.content
      themeHasChanges.value = false
    } else {
      // No theme exists - create default
      themeContent.value = `# Barbara - Core Personality

You are Barbara, a warm and professional voice assistant.

## Speaking Style
- Brief, natural responses
- Simple language, no jargon
- Patient with seniors

## Core Rules
- Never pressure
- Use tools for facts
- Listen more than talk`
      themeHasChanges.value = false
    }
  } catch (error) {
    console.error('Error loading theme:', error)
    window.$message?.error('Failed to load theme: ' + error.message)
  } finally {
    themeLoading.value = false
  }
}

async function saveTheme() {
  if (!selectedVertical.value || !themeContent.value.trim()) {
    window.$message?.warning('Please enter theme content')
    return
  }
  
  themeSaving.value = true
  try {
    // Check if theme exists
    const { data: existing, error: checkError } = await supabase
      .from('theme_prompts')
      .select('id')
      .eq('vertical', selectedVertical.value)
      .eq('is_active', true)
      .maybeSingle()
    
    if (checkError) throw checkError
    
    if (existing) {
      // Update existing theme
      const { error: updateError } = await supabase
        .from('theme_prompts')
        .update({
          content: themeContent.value,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
      
      if (updateError) throw updateError
      window.$message?.success('Theme updated successfully!')
    } else {
      // Create new theme
      const { error: insertError } = await supabase
        .from('theme_prompts')
        .insert({
          vertical: selectedVertical.value,
          content: themeContent.value,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      
      if (insertError) throw insertError
      window.$message?.success('Theme created successfully!')
    }
    
    themeHasChanges.value = false
  } catch (error) {
    console.error('Error saving theme:', error)
    window.$message?.error('Failed to save theme: ' + error.message)
  } finally {
    themeSaving.value = false
  }
}

async function loadNodePrompts() {
  if (!selectedVertical.value) return
  
  loading.value = true
  try {
    // Query the active_node_prompts view (created in Plan 2)
    const { data, error } = await supabase
      .from('active_node_prompts')
      .select('*')
      .eq('vertical', selectedVertical.value)
    
    if (error) throw error
    
    // Group by node_name
    const grouped = {}
    for (const np of (data || [])) {
      grouped[np.node_name] = {
        id: np.id,
        vertical: np.vertical,
        node_name: np.node_name,
        name: np.name,
        version_number: np.version_number,
        content: np.content // JSONB object with role, instructions, tools (NO personality)
      }
    }
    
    nodePrompts.value[selectedVertical.value] = grouped
    
    // Load the first node (greet)
    selectedNode.value = 'greet'
    loadCurrentNode()
    
  } catch (error) {
    console.error('Error loading node prompts:', error)
    window.$message?.error('Failed to load node prompts: ' + error.message)
  } finally {
    loading.value = false
  }
}

function loadCurrentNode() {
  if (!selectedVertical.value || !selectedNode.value) return
  
  const np = nodePrompts.value[selectedVertical.value]?.[selectedNode.value]
  
  if (np && np.content) {
    // Node exists - load its content from JSONB
    currentNodePrompt.value = np
    
    // Extract fields from JSONB content object and populate currentVersion structure
    const content = np.content
    
    // Initialize currentVersion if needed
    if (!currentVersion.value) {
      currentVersion.value = {
        id: np.id,
        version_number: np.version_number,
        content: {}
      }
    }
    
    // Populate currentVersion.content with JSONB fields
    // NOTE: personality is now handled by theme_prompts table, not individual nodes
    currentVersion.value.content.role = content.role || ''
    currentVersion.value.content.instructions = content.instructions || ''
    currentVersion.value.content.tools = Array.isArray(content.tools) ? content.tools.join(', ') : (content.tools || '')
    
  } else {
    // Node doesn't exist - create empty template
    currentNodePrompt.value = null
    
    if (!currentVersion.value) {
      currentVersion.value = { content: {} }
    }
    
    currentVersion.value.content.role = ''
    // NOTE: personality is now handled by theme_prompts table, not individual nodes
    currentVersion.value.content.instructions = ''
    currentVersion.value.content.tools = ''
  }
  
  // Update the editor UI
  nextTick(() => {
    populateContentEditableDivs()
  })
}

async function saveCurrentNode() {
  if (!selectedVertical.value || !selectedNode.value) {
    window.$message?.error('No vertical or node selected')
    return
  }
  
  if (!currentVersion.value?.content) {
    window.$message?.error('No content to save')
    return
  }
  
  try {
    saving.value = true
    
    // Build JSONB content object from currentVersion.content
    // NOTE: personality is now handled by theme_prompts table, not individual nodes
    const contentObj = {
      role: currentVersion.value.content.role || '',
      instructions: currentVersion.value.content.instructions || '',
      tools: currentVersion.value.content.tools ? currentVersion.value.content.tools.split(',').map(t => t.trim()) : []
    }
    
    // Check if this node already exists
    const existingNode = currentNodePrompt.value
    
    if (existingNode) {
      // UPDATE existing prompt version
      // Increment version number and create new version
      const newVersionNumber = existingNode.version_number + 1
      
      const { error: versionError } = await supabase
        .from('prompt_versions')
        .insert({
          prompt_id: existingNode.id,
          version_number: newVersionNumber,
          content: contentObj,
          is_active: true,
          is_draft: false,
          created_by: 'portal',
          change_summary: `Updated ${selectedNode.value} node from Vue portal`
        })
      
      if (versionError) throw versionError
      
      // Deactivate old version
      await supabase
        .from('prompt_versions')
        .update({ is_active: false })
        .eq('prompt_id', existingNode.id)
        .eq('version_number', existingNode.version_number)
      
      // Update prompt current_version
      await supabase
        .from('prompts')
        .update({ current_version: newVersionNumber })
        .eq('id', existingNode.id)
      
    } else {
      // INSERT new prompt + version
      // First create the prompt record
      const { data: newPrompt, error: promptError } = await supabase
        .from('prompts')
        .insert({
          name: selectedNode.value.charAt(0).toUpperCase() + selectedNode.value.slice(1),
          description: `${selectedNode.value} node for ${selectedVertical.value}`,
          vertical: selectedVertical.value,
          node_name: selectedNode.value,
          current_version: 1,
          is_active: true
        })
        .select()
        .single()
      
      if (promptError) throw promptError
      
      // Then create the first version
      const { error: versionError } = await supabase
        .from('prompt_versions')
        .insert({
          prompt_id: newPrompt.id,
          version_number: 1,
          content: contentObj,
          is_active: true,
          is_draft: false,
          created_by: 'portal',
          change_summary: `Created ${selectedNode.value} node from Vue portal`
        })
      
      if (versionError) throw versionError
      
      // Update local cache
      if (!nodePrompts.value[selectedVertical.value]) {
        nodePrompts.value[selectedVertical.value] = {}
      }
      nodePrompts.value[selectedVertical.value][selectedNode.value] = {
        id: newPrompt.id,
        vertical: selectedVertical.value,
        node_name: selectedNode.value,
        name: newPrompt.name,
        version_number: 1,
        content: contentObj
      }
      currentNodePrompt.value = nodePrompts.value[selectedVertical.value][selectedNode.value]
    }
    
    hasChanges.value = false
    window.$message?.success(`Node "${selectedNode.value}" saved for ${selectedVertical.value}`)
    
    // Reload to get latest version
    await loadNodePrompts()
    
  } catch (error) {
    console.error('Error saving node:', error)
    window.$message?.error('Failed to save node: ' + error.message)
  } finally {
    saving.value = false
  }
}

// Watchers for node-based routing
watch(selectedVertical, async (newVertical) => {
  if (!newVertical) {
    themeContent.value = ''
    themeHasChanges.value = false
    return
  }
  
  // Load theme first (must complete before node prompts to ensure consistency)
  await loadTheme()
  
  // Then load node prompts if not already loaded
  if (!nodePrompts.value[newVertical]) {
    await loadNodePrompts()
  } else {
    // Already loaded, just switch to first node
    selectedNode.value = 'greet'
    loadCurrentNode()
  }
})

watch(selectedNode, () => {
  loadCurrentNode()
})

</script>

<style scoped>
.prompt-workspace {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-left: 0;
  max-width: 100%;
  min-height: 600px;
  position: relative;
}

.meta-card {
  background: var(--surface);
  border-radius: 10px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-soft);
  padding: 0.55rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  align-items: flex-start;
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  height: fit-content;
  max-height: 400px;
  min-width: 0;
  container-type: inline-size;
}

/* When card is wide, enable vertical scroll and fill vertical space */
@container (min-width: 400px) {
  .meta-card {
    overflow-y: auto;
    overflow-x: hidden;
    max-height: none;
    height: 100%;
    min-height: 500px;
  }
  
  /* Purple scrollbar */
  .meta-card::-webkit-scrollbar {
    width: 6px;
  }
  
  .meta-card::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .meta-card::-webkit-scrollbar-thumb {
    background: rgba(99, 102, 241, 0.3);
    border-radius: 3px;
  }
  
  .meta-card::-webkit-scrollbar-thumb:hover {
    background: rgba(99, 102, 241, 0.5);
  }
}

.meta-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
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
  color: var(--text-secondary);
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
  background: var(--nav-hover);
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
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  color: var(--color-primary-600);
  padding: 0;
}

.scroll-arrow:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.scroll-arrow:not(:disabled):hover {
  background: var(--nav-hover);
  border-color: rgba(99, 102, 241, 0.35);
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

.meta-item {
  flex-shrink: 0;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 0.45rem 1.1rem;
  background: var(--surface);
  font-size: 0.62rem;
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.1rem;
  transition: border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
  min-width: 180px;
  width: 180px;
  height: 70px;
  scroll-snap-align: start;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.meta-item.version {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-width: 200px;
  width: 200px;
  height: 70px;
}

.meta-item.version .version-content {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  flex: 1;
  min-width: 0;
  align-items: flex-start;
}

.meta-item.version .activity-rings {
  flex-shrink: 0;
  opacity: 0.9;
  transition: opacity 0.2s ease;
}

.meta-item.version:hover .activity-rings {
  opacity: 1;
}

/* Rings Tooltip */
.rings-tooltip {
  padding: 0.5rem;
  min-width: 200px;
}

.rings-tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.rings-tooltip-calls {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: normal;
}

.rings-tooltip-legend {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-label {
  flex: 1;
  font-weight: 500;
}

.legend-value {
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.8rem;
}


.meta-item.active {
  border-color: rgba(99, 102, 241, 0.65);
  background: var(--nav-selected);
}

.meta-item:hover {
  border-color: rgba(99, 102, 241, 0.55);
  background: var(--nav-hover);
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
  color: var(--text-secondary);
  font-size: 0.58rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  line-height: 1.2;
}

.meta-badge {
  display: inline-block;
  padding: 0; /* remove pill */
  margin-top: 2px;
  font-size: 0.55rem;
  font-weight: 500;
  color: var(--text-inverse);
  background: transparent !important; /* remove pill */
  border-radius: 0; /* remove pill */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

:root[data-theme='dark'] .meta-badge {
  background: transparent !important;
}

.meta-item:not(.version) .meta-item-sub {
  text-align: center;
}

.meta-item.version .meta-item-sub {
  text-align: left;
}

.meta-item.version .meta-item-title {
  font-weight: 700;
  font-size: 0.9rem;
  min-width: 0;
  color: var(--text-primary);
  margin-bottom: 0.1rem;
}

/* Ensure prompt subtext badge and its icon are readable in both themes */
.meta-item .meta-badge {
  color: var(--text-secondary);
}
.meta-item .meta-badge :deep(.n-icon) {
  color: var(--text-secondary);
}

.meta-date {
  font-size: 0.62rem;
  color: var(--text-secondary);
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

.meta-status-top {
  background: rgba(34, 197, 94, 0.15);
  color: #15803d;
  border-radius: 999px;
  padding: 0 0.35rem;
  font-size: 0.55rem;
  font-weight: 600;
  white-space: nowrap;
  width: fit-content;
  margin-bottom: 0.15rem;
}

.meta-status-top.draft {
  background: rgba(250, 204, 21, 0.2);
  color: #92400e;
}

.editor-pane {
  min-width: 0;
}

.editor-card {
  border-radius: 14px;
  padding: 0.75rem;
  background: var(--surface);
  box-shadow: var(--shadow-soft);
  gap: 0.8rem;
}

.editor-card :deep(.n-tabs-nav) {
  padding-left: 0;
  margin-left: -10px;
}

.metrics-card {
  margin-bottom: 16px;
  padding: 1rem 1.5rem;
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  border-radius: 12px;
}

.ai-suggestions-card {
  margin-bottom: 16px;
  background: rgba(139, 92, 246, 0.12);
  border: 1px solid rgba(139, 92, 246, 0.28);
}

:root[data-theme='dark'] .ai-suggestions-card {
  background: rgba(99, 102, 241, 0.18);
  border-color: rgba(139, 92, 246, 0.35);
}

.ai-audit-btn {
  background: rgba(139, 92, 246, 0.12);
  color: #5b21b6;
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.ai-audit-btn:disabled {
  opacity: 0.6;
}

:root[data-theme='dark'] .ai-audit-btn {
  background: rgba(99, 102, 241, 0.28);
  color: #c4b5fd;
  border-color: rgba(139, 92, 246, 0.45);
}

.apply-all-btn {
  background: rgba(139, 92, 246, 0.12);
  color: #5b21b6;
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.apply-all-btn:disabled {
  opacity: 0.6;
}

:root[data-theme='dark'] .apply-all-btn {
  background: rgba(99, 102, 241, 0.28);
  color: #c4b5fd;
  border-color: rgba(139, 92, 246, 0.45);
}

.progress-log {
  background: var(--surface-muted);
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid var(--border-color);
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

/* Force white text on enabled primary/info buttons */
.compact-toolbar :deep(.n-button.n-button--primary-type:not(.n-button--disabled)),
.compact-toolbar :deep(.n-button.n-button--info-type:not(.n-button--disabled)),
.prompt-workspace :deep(.n-button.n-button--primary-type:not(.n-button--disabled)),
.prompt-workspace :deep(.n-button.n-button--info-type:not(.n-button--disabled)) {
  --n-text-color: var(--text-inverse);
  --n-icon-color: var(--text-inverse);
}

/* Dark mode: lighter disabled buttons */
:root[data-theme='dark'] .compact-toolbar :deep(.n-button.n-button--disabled) {
  --n-color: rgba(99, 102, 241, 0.24);
  --n-border: rgba(99, 102, 241, 0.28);
  --n-text-color: rgba(203, 213, 245, 0.85);
  --n-icon-color: rgba(203, 213, 245, 0.85);
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
  color: var(--text-primary);
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

/* Markdown Helper Toolbar */
.markdown-helper-toolbar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
}

.md-btn {
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.15s ease;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.md-btn:hover {
  background: var(--bg-hover);
  border-color: var(--primary-color);
}

.md-btn:active {
  transform: scale(0.95);
}

.md-btn strong {
  font-weight: 700;
}

.notion-textarea {
  width: 100%;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0.5rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  line-height: 1.6;
  background: var(--card-color);
  color: var(--text-primary);
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
  color: var(--text-secondary);
  pointer-events: none;
}

.notion-textarea:focus {
  outline: none;
  border-color: rgba(99, 102, 241, 0.65);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
  background: var(--card-color);
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
  color: var(--text-primary);
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
  color: var(--text-primary);
  margin: 0;
}

.variables-section .text-muted {
  font-size: 0.75rem;
  color: var(--text-secondary);
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
  color: var(--text-secondary);
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
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 160ms ease;
}

.variable-item:hover {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.45);
}

.variable-item-readonly {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.5rem 0.75rem;
  background: rgba(248, 250, 255, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 8px;
  cursor: default;
  opacity: 0.85;
}

.variable-name {
  font-family: 'Fira Code', monospace;
  font-size: 0.72rem;
  color: #4f46e5;
  font-weight: 600;
}

.variable-desc {
  font-size: 0.68rem;
  color: var(--text-secondary);
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
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.preview-section-content {
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0.75rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--text-primary);
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

.unchanged-badge {
  margin-left: 0.5rem;
  font-size: 0.65rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: rgba(107, 114, 128, 0.12);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
}

.diff-content-tab {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.diff-section-tab {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
}

.diff-section-tab:last-child {
  border-bottom: none;
}

.changes-container {
  padding: 0.5rem 0;
}

.diff-text {
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
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
  color: var(--text-primary);
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
  color: var(--text-secondary);
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
  color: var(--text-primary);
  margin: 0;
}

.guide-subsection h4 {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.guide-subsection ul {
  margin: 0;
  padding-left: 1.5rem;
  color: var(--text-secondary);
}

.guide-subsection li {
  margin-bottom: 0.35rem;
}

.guide-example {
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0.75rem;
  font-family: 'Fira Code', monospace;
  font-size: 0.72rem;
  line-height: 1.5;
  color: var(--text-primary);
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
  padding: 8px 0;
}

/* Summary Info Bar */
.summary-info-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
  padding: 0;
  flex-wrap: wrap;
}

.summary-info-item {
  display: flex;
  align-items: center;
  font-size: 0.85rem;
  color: #475569;
}

.summary-info-label {
  font-weight: 500;
}

.summary-info-divider {
  width: 1px;
  height: 20px;
  background: rgba(148, 163, 184, 0.3);
}

/* Metrics Ring Grid */
.metrics-ring-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.75rem 1rem;
  padding: 0;
}

.metric-ring-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  position: relative;
}

.metric-ring {
  width: 100px;
  height: 100px;
}

.metric-ring-score {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-top: -10px;
}

.metric-ring-suffix {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.metric-ring-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 500;
  text-align: center;
  max-width: 120px;
}

/* Allow the metrics section to adapt based on its own width */
.metrics-card {
  container-type: inline-size;
}

@container (max-width: 600px) {
  .metric-ring {
    width: 88px;
    height: 88px;
  }
  .metrics-ring-grid {
    gap: 0.5rem 0.75rem;
  }
  .metric-ring-label {
    font-size: 0.7rem;
  }
}

/* AI Analysis dark/light adaptive styles */
.ai-analysis-card {
  /* inherit card theming; ensure readable text */
  color: var(--text-primary);
  background: var(--surface-muted) !important;
  border: 1px solid var(--border-color) !important;
}

.ai-analysis-card :deep(.n-card-header__main) {
  color: var(--text-primary) !important;
}

.ai-analysis-card :deep(.n-card__content) {
  background: transparent !important;
}

.ai-analysis-list :deep(.n-list-item) {
  color: var(--text-primary) !important;
  background: transparent !important;
  border-color: var(--border-color) !important;
}

.ai-analysis-list :deep(.n-list) {
  background: transparent !important;
}

.ai-analysis-card :deep(.n-collapse-item) {
  border-color: var(--border-color) !important;
}

.ai-analysis-card :deep(.n-collapse-item__header) {
  color: var(--text-primary) !important;
}

.ai-analysis-card :deep(.n-collapse) {
  background: transparent !important;
}

.metric-score {
  font-size: 1.3rem;
  font-weight: 600;
  margin-bottom: 6px;
  line-height: 1;
}

.metric-suffix {
  font-size: 0.8rem;
  font-weight: 400;
  color: var(--text-secondary);
  margin-left: 2px;
}

.score-good { 
  color: rgba(34, 197, 94, 0.85);
}

.score-fair { 
  color: rgba(251, 146, 60, 0.9);
}

.score-poor { 
  color: rgba(239, 68, 68, 0.8);
}

/* AI Suggestions Styling */
.suggestions-list :deep(.n-list-item) {
  align-items: center;
  padding-left: 16px !important;
  padding-right: 16px !important;
}

.suggestion-item :deep(.n-list-item__prefix) {
  display: flex;
  align-items: center;
  margin-right: 12px;
  min-width: 70px;
}

.suggestion-badge :deep(.n-badge-sup) {
  position: static !important;
  transform: none !important;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  min-width: 60px;
  min-height: 22px;
  text-align: center;
  line-height: 1.4;
  padding: 3px 8px;
}

/* Pastel colors for priority badges */
.suggestion-badge :deep(.n-badge-sup.n-badge-sup--error) {
  background-color: rgba(239, 68, 68, 0.15) !important;
  color: rgba(153, 27, 27, 0.9) !important;
}

.suggestion-badge :deep(.n-badge-sup.n-badge-sup--warning) {
  background-color: rgba(251, 191, 36, 0.15) !important;
  color: rgba(146, 64, 14, 0.9) !important;
}

.suggestion-badge :deep(.n-badge-sup.n-badge-sup--info) {
  background-color: rgba(59, 130, 246, 0.15) !important;
  color: rgba(30, 64, 175, 0.9) !important;
}

/* Empty State Styling */
.evaluation-empty-state {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  min-height: 400px;
  padding: 80px 20px 60px;
}

.empty-icon-wrapper {
  margin-bottom: 32px;
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

/* Dark Mode Overrides for AI Analysis and Modals */
/* Dark mode n-card styling */
:root[data-theme='dark'] :deep(.n-card) {
  background: rgba(17, 24, 39, 0.6) !important;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
}

:root[data-theme='dark'] :deep(.n-card-header) {
  color: white !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
}

:root[data-theme='dark'] :deep(.n-card__content) {
  color: white !important;
}

/* Light mode n-card styling - use Naive UI defaults */
:root[data-theme='light'] :deep(.n-card) {
  background: var(--surface) !important;
}

:deep(.n-collapse) {
  background: transparent !important;
}

:deep(.n-collapse-item) {
  background: transparent !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

:deep(.n-collapse-item__header) {
  color: white !important;
  background: transparent !important;
}

:deep(.n-list) {
  background: transparent !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

:deep(.n-list-item) {
  background: transparent !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.n-modal .n-card) {
  background: rgba(17, 24, 39, 0.95) !important;
}

:deep(.n-divider) {
  background-color: rgba(255, 255, 255, 0.1) !important;
}
/* Responsive three-pane layout: desktop/tablet */
@media (min-width: 768px) {
  .prompt-workspace {
    display: grid;
    grid-template-columns: 195px 195px 1fr;
    gap: 0.75rem;
    align-items: stretch;
  }

  .prompt-workspace.prompts-collapsed {
    grid-template-columns: 195px 1fr;
    padding-left: 24px; /* create a left gutter for the expand handle */
  }

  .prompt-workspace.prompts-collapsed > .meta-card:first-of-type {
    display: none;
  }

  /* When prompts are collapsed, move editor to column 2 to fill space */
  .prompt-workspace.prompts-collapsed .editor-pane {
    grid-column: 2;
  }

  /* Left and middle meta cards fill height and scroll vertically */
  .prompt-workspace > .meta-card {
    height: calc(100vh - 180px);
    max-height: none;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0.5rem 0.6rem;
  }

  /* Turn lists vertical on wider screens */
  .meta-list {
    flex-direction: column;
    width: 100%;
  }

  .meta-list-wrapper {
    overflow-y: auto;
    overflow-x: hidden;
    width: 100%;
  }

  /* Make list items stretch full width in vertical lists */
  .meta-item {
    width: 100%;
    min-width: 0;
    height: auto;
    min-height: 70px; /* match version card height */
    padding: 0.4rem 0.75rem;
  }

  .meta-item.version {
    width: 100%;
    min-width: 0;
    height: auto;
    padding: 0.5rem 0.75rem;
  }

  /* Ensure editor pane occupies the right column */
  .editor-pane {
    grid-column: 3;
    min-width: 320px; /* keep at least two 140px rings + gaps */
  }
  .editor-card {
    min-width: 320px;
  }

  /* Narrower vertical scrollbars for Prompts/Versions in vertical layout */
  .prompt-workspace > .meta-card { 
    scrollbar-width: thin; /* Firefox */
    scrollbar-color: rgba(99, 102, 241, 0.5) transparent; /* Firefox: purple thumb, transparent track */
  }
  .prompt-workspace > .meta-card::-webkit-scrollbar {
    width: 3px; /* half the earlier 6px */
  }
  .prompt-workspace > .meta-card::-webkit-scrollbar-button {
    width: 0;
    height: 0;
    display: none; /* hide up/down arrows */
  }
  .prompt-workspace > .meta-card::-webkit-scrollbar-button:start:decrement,
  .prompt-workspace > .meta-card::-webkit-scrollbar-button:end:increment,
  .prompt-workspace > .meta-card::-webkit-scrollbar-button:vertical:increment,
  .prompt-workspace > .meta-card::-webkit-scrollbar-button:vertical:decrement {
    width: 0;
    height: 0;
    display: none;
    background: transparent;
  }
  .prompt-workspace > .meta-card::-webkit-scrollbar-button:single-button {
    width: 0;
    height: 0;
    display: none; /* extra safety */
  }
  .prompt-workspace > .meta-card::-webkit-scrollbar-track {
    background: transparent;
  }
  .prompt-workspace > .meta-card::-webkit-scrollbar-thumb {
    background: rgba(99, 102, 241, 0.3); /* purple to match horizontal */
    border-radius: 3px;
  }
  .prompt-workspace > .meta-card::-webkit-scrollbar-thumb:hover {
    background: rgba(99, 102, 241, 0.5);
  }
  .prompt-workspace > .meta-card::-webkit-scrollbar-corner {
    background: transparent;
  }

  /* In case inner wrapper scrolls */
  .prompt-workspace .meta-list-wrapper { 
    scrollbar-width: thin; 
    scrollbar-color: rgba(99, 102, 241, 0.5) transparent; /* Firefox */
  }
  .prompt-workspace .meta-list-wrapper::-webkit-scrollbar { 
    width: 3px; 
  }
  .prompt-workspace .meta-list-wrapper::-webkit-scrollbar-button { 
    width: 0; 
    height: 0; 
    display: none; 
  }
  .prompt-workspace .meta-list-wrapper::-webkit-scrollbar-button:start:decrement,
  .prompt-workspace .meta-list-wrapper::-webkit-scrollbar-button:end:increment,
  .prompt-workspace .meta-list-wrapper::-webkit-scrollbar-button:vertical:increment,
  .prompt-workspace .meta-list-wrapper::-webkit-scrollbar-button:vertical:decrement { 
    width: 0; 
    height: 0; 
    display: none; 
    background: transparent; 
  }
  .prompt-workspace .meta-list-wrapper::-webkit-scrollbar-button:single-button { 
    width: 0; 
    height: 0; 
    display: none; 
  }
  .prompt-workspace .meta-list-wrapper::-webkit-scrollbar-track { 
    background: transparent; 
  }
  .prompt-workspace .meta-list-wrapper::-webkit-scrollbar-thumb { 
    background: rgba(99, 102, 241, 0.3); /* purple to match horizontal */
    border-radius: 3px; 
  }
  .prompt-workspace .meta-list-wrapper::-webkit-scrollbar-thumb:hover { 
    background: rgba(99, 102, 241, 0.5); 
  }
  .prompt-workspace .meta-list-wrapper::-webkit-scrollbar-corner { 
    background: transparent; 
  }

  /* Collapse controls */
  .collapse-trigger {
    display: inline-flex;
  }
  .expand-prompts-btn {
    display: none;
  }
  .prompt-workspace.prompts-collapsed .expand-prompts-btn {
    position: absolute;
    top: 8px;
    left: 6px;
    transform: none;
    z-index: 20;
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: var(--shadow-sm);
    pointer-events: auto;
    width: 28px;
    height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
}

/* Ensure AI suggestions text uses theme colors */
.ai-suggestions-card { color: var(--text-primary); }
.ai-suggestions-card :deep(.n-card-header__main) { color: var(--text-primary) !important; }
.suggestion-title { font-weight: 500; margin-bottom: 4px; color: var(--text-primary); }
</style>