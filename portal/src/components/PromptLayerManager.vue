<template>
  <div class="promptlayer-manager">
    <div class="header">
      <h1>PromptLayer Management</h1>
      <p class="subtitle">Manage prompts, view analytics, and monitor AI performance</p>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        :class="['tab', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Prompt Registry Tab -->
    <div v-if="activeTab === 'prompts'" class="tab-content">
      <div class="section-header">
        <h2>Prompt Templates</h2>
        <button @click="createNewPrompt" class="btn-primary">+ New Prompt</button>
      </div>

      <div class="prompt-list">
        <div v-for="prompt in prompts" :key="prompt.id" class="prompt-card">
          <div class="prompt-header">
            <div class="prompt-title">
              <h3>{{ prompt.name }}</h3>
              <span class="badge" :class="prompt.status">{{ prompt.status }}</span>
            </div>
            <div class="prompt-actions">
              <button @click="editPrompt(prompt)" class="btn-icon">✏️</button>
              <button @click="viewHistory(prompt)" class="btn-icon">📊</button>
              <button @click="deployPrompt(prompt)" class="btn-secondary">Deploy</button>
            </div>
          </div>
          
          <div class="prompt-meta">
            <span>Version: {{ prompt.version }}</span>
            <span>Last Modified: {{ formatDate(prompt.updated_at) }}</span>
            <span>Requests: {{ prompt.request_count || 0 }}</span>
          </div>

          <div v-if="editingPrompt?.id === prompt.id" class="prompt-editor">
            <div class="form-group">
              <label>Prompt Template</label>
              <textarea 
                v-model="editingPrompt.template"
                rows="10"
                placeholder="Enter your prompt template here..."
              ></textarea>
            </div>

            <div class="form-group">
              <label>Input Variables (comma-separated)</label>
              <input 
                type="text"
                v-model="editingPrompt.input_variables"
                placeholder="user_name, user_age, purpose"
              >
            </div>

            <div class="form-group">
              <label>Model</label>
              <select v-model="editingPrompt.model">
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              </select>
            </div>

            <div class="editor-actions">
              <button @click="savePrompt" class="btn-primary">Save Changes</button>
              <button @click="testPrompt" class="btn-secondary">Test Prompt</button>
              <button @click="cancelEdit" class="btn-text">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Analytics Tab -->
    <div v-if="activeTab === 'analytics'" class="tab-content">
      <h2>Performance Analytics</h2>

      <div class="date-range">
        <label>Time Range:</label>
        <select v-model="analyticsRange" @change="loadAnalytics">
          <option value="1h">Last Hour</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Total Requests</div>
          <div class="metric-value">{{ analytics.total_requests }}</div>
          <div class="metric-change" :class="analytics.requests_change >= 0 ? 'positive' : 'negative'">
            {{ analytics.requests_change >= 0 ? '↑' : '↓' }} {{ Math.abs(analytics.requests_change) }}%
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Avg. Latency</div>
          <div class="metric-value">{{ analytics.avg_latency }}ms</div>
          <div class="metric-change" :class="analytics.latency_change <= 0 ? 'positive' : 'negative'">
            {{ analytics.latency_change <= 0 ? '↓' : '↑' }} {{ Math.abs(analytics.latency_change) }}%
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Total Tokens</div>
          <div class="metric-value">{{ formatNumber(analytics.total_tokens) }}</div>
          <div class="metric-change">
            ~${{ (analytics.estimated_cost || 0).toFixed(2) }}
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Success Rate</div>
          <div class="metric-value">{{ analytics.success_rate }}%</div>
          <div class="metric-change" :class="analytics.success_change >= 0 ? 'positive' : 'negative'">
            {{ analytics.success_change >= 0 ? '↑' : '↓' }} {{ Math.abs(analytics.success_change) }}%
          </div>
        </div>
      </div>

      <div class="analytics-section">
        <h3>Prompt Performance Breakdown</h3>
        <div class="table-container">
          <table class="analytics-table">
            <thead>
              <tr>
                <th>Prompt Name</th>
                <th>Requests</th>
                <th>Avg Latency</th>
                <th>Tokens</th>
                <th>Cost</th>
                <th>Success Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="stat in promptStats" :key="stat.prompt_name">
                <td>{{ stat.prompt_name }}</td>
                <td>{{ stat.request_count }}</td>
                <td>{{ stat.avg_latency }}ms</td>
                <td>{{ formatNumber(stat.total_tokens) }}</td>
                <td>${{ stat.cost.toFixed(2) }}</td>
                <td>
                  <span :class="['rate-badge', getRateClass(stat.success_rate)]">
                    {{ stat.success_rate }}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Request History Tab -->
    <div v-if="activeTab === 'history'" class="tab-content">
      <div class="section-header">
        <h2>Request History</h2>
        <div class="filters">
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="Search requests..."
            class="search-input"
          >
          <select v-model="filterPrompt" @change="loadHistory">
            <option value="">All Prompts</option>
            <option v-for="prompt in prompts" :key="prompt.id" :value="prompt.name">
              {{ prompt.name }}
            </option>
          </select>
        </div>
      </div>

      <div class="history-list">
        <div v-for="request in filteredHistory" :key="request.id" class="history-item">
          <div class="history-header">
            <div class="history-info">
              <span class="history-prompt">{{ request.prompt_name }}</span>
              <span class="history-time">{{ formatTimestamp(request.created_at) }}</span>
              <span class="history-status" :class="request.status">{{ request.status }}</span>
            </div>
            <button @click="toggleDetails(request)" class="btn-icon">
              {{ expandedRequest === request.id ? '▼' : '▶' }}
            </button>
          </div>

          <div v-if="expandedRequest === request.id" class="history-details">
            <div class="detail-section">
              <h4>Input</h4>
              <pre>{{ JSON.stringify(request.input, null, 2) }}</pre>
            </div>

            <div class="detail-section">
              <h4>Output</h4>
              <pre>{{ request.output }}</pre>
            </div>

            <div class="detail-section">
              <h4>Metadata</h4>
              <div class="metadata-grid">
                <div>Model: {{ request.model }}</div>
                <div>Latency: {{ request.latency }}ms</div>
                <div>Tokens: {{ request.tokens }}</div>
                <div>Cost: ${{ request.cost?.toFixed(4) }}</div>
              </div>
            </div>

            <div class="detail-actions">
              <button @click="scoreRequest(request)" class="btn-secondary">Add Score</button>
              <button @click="replayRequest(request)" class="btn-secondary">Replay</button>
              <button @click="exportRequest(request)" class="btn-text">Export</button>
            </div>
          </div>
        </div>
      </div>

      <div class="pagination">
        <button 
          @click="loadMoreHistory" 
          :disabled="!hasMoreHistory"
          class="btn-secondary"
        >
          Load More
        </button>
      </div>
    </div>

    <!-- Settings Tab -->
    <div v-if="activeTab === 'settings'" class="tab-content">
      <h2>PromptLayer Settings</h2>

      <div class="form-group">
        <label>API Key</label>
        <input 
          type="password"
          v-model="settings.apiKey"
          placeholder="pl-api-xxxxxxxxxxxxx"
        >
        <p class="help-text">Your PromptLayer API key from promptlayer.com</p>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" v-model="settings.enableTracking">
          Enable Request Tracking
        </label>
        <p class="help-text">Automatically log all AI requests to PromptLayer</p>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" v-model="settings.enableScoring">
          Enable Auto-Scoring
        </label>
        <p class="help-text">Automatically score requests based on success metrics</p>
      </div>

      <div class="form-group">
        <label>Default Tags (comma-separated)</label>
        <input 
          type="text"
          v-model="settings.defaultTags"
          placeholder="production, barbara, voice-calls"
        >
        <p class="help-text">Tags to add to all tracked requests</p>
      </div>

      <div class="form-group">
        <label>Return Prompt ID</label>
        <select v-model="settings.returnPromptId">
          <option value="true">Yes - Include request ID in responses</option>
          <option value="false">No - Don't return request ID</option>
        </select>
      </div>

      <div class="actions">
        <button @click="testConnection" class="btn-secondary">Test Connection</button>
        <button @click="saveSettings" class="btn-primary">Save Settings</button>
      </div>

      <div v-if="connectionStatus" class="status-message" :class="connectionStatus.type">
        {{ connectionStatus.message }}
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PromptLayerManager',
  
  data() {
    return {
      activeTab: 'prompts',
      
      tabs: [
        { id: 'prompts', label: 'Prompt Registry' },
        { id: 'analytics', label: 'Analytics' },
        { id: 'history', label: 'Request History' },
        { id: 'settings', label: 'Settings' }
      ],

      // Prompts
      prompts: [],
      editingPrompt: null,

      // Analytics
      analyticsRange: '24h',
      analytics: {
        total_requests: 0,
        requests_change: 0,
        avg_latency: 0,
        latency_change: 0,
        total_tokens: 0,
        estimated_cost: 0,
        success_rate: 0,
        success_change: 0
      },
      promptStats: [],

      // History
      history: [],
      searchQuery: '',
      filterPrompt: '',
      expandedRequest: null,
      hasMoreHistory: true,
      historyPage: 1,

      // Settings
      settings: {
        apiKey: '',
        enableTracking: true,
        enableScoring: false,
        defaultTags: 'production,barbara',
        returnPromptId: 'true'
      },
      connectionStatus: null
    };
  },

  computed: {
    filteredHistory() {
      let filtered = this.history;
      
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(r => 
          r.prompt_name?.toLowerCase().includes(query) ||
          r.output?.toLowerCase().includes(query)
        );
      }

      if (this.filterPrompt) {
        filtered = filtered.filter(r => r.prompt_name === this.filterPrompt);
      }

      return filtered;
    }
  },

  methods: {
    // Prompt Management
    async loadPrompts() {
      try {
        const response = await fetch('/api/promptlayer/prompts', {
          headers: this.getAuthHeaders()
        });
        if (response.ok) {
          this.prompts = await response.json();
        }
      } catch (error) {
        console.error('Failed to load prompts:', error);
      }
    },

    createNewPrompt() {
      this.editingPrompt = {
        id: null,
        name: 'New Prompt',
        template: '',
        input_variables: '',
        model: 'gpt-4o-mini',
        status: 'draft',
        version: 1
      };
    },

    editPrompt(prompt) {
      this.editingPrompt = { ...prompt };
    },

    async savePrompt() {
      try {
        const endpoint = this.editingPrompt.id 
          ? `/api/promptlayer/prompts/${this.editingPrompt.id}`
          : '/api/promptlayer/prompts';
        
        const response = await fetch(endpoint, {
          method: this.editingPrompt.id ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders()
          },
          body: JSON.stringify(this.editingPrompt)
        });

        if (response.ok) {
          await this.loadPrompts();
          this.editingPrompt = null;
          alert('Prompt saved successfully!');
        }
      } catch (error) {
        console.error('Failed to save prompt:', error);
        alert('Failed to save prompt');
      }
    },

    async deployPrompt(prompt) {
      if (!confirm(`Deploy "${prompt.name}" to production?`)) return;

      try {
        const response = await fetch(`/api/promptlayer/prompts/${prompt.id}/deploy`, {
          method: 'POST',
          headers: this.getAuthHeaders()
        });

        if (response.ok) {
          await this.loadPrompts();
          alert('Prompt deployed successfully!');
        }
      } catch (error) {
        console.error('Failed to deploy prompt:', error);
        alert('Failed to deploy prompt');
      }
    },

    cancelEdit() {
      this.editingPrompt = null;
    },

    async testPrompt() {
      alert('Prompt testing feature coming soon!');
    },

    // Analytics
    async loadAnalytics() {
      try {
        const response = await fetch(
          `/api/promptlayer/analytics?range=${this.analyticsRange}`,
          { headers: this.getAuthHeaders() }
        );
        
        if (response.ok) {
          const data = await response.json();
          this.analytics = data.summary;
          this.promptStats = data.by_prompt || [];
        }
      } catch (error) {
        console.error('Failed to load analytics:', error);
      }
    },

    getRateClass(rate) {
      if (rate >= 95) return 'excellent';
      if (rate >= 80) return 'good';
      if (rate >= 60) return 'fair';
      return 'poor';
    },

    // History
    async loadHistory() {
      try {
        const params = new URLSearchParams({
          page: this.historyPage,
          prompt: this.filterPrompt || ''
        });

        const response = await fetch(
          `/api/promptlayer/history?${params}`,
          { headers: this.getAuthHeaders() }
        );

        if (response.ok) {
          const data = await response.json();
          this.history = data.items;
          this.hasMoreHistory = data.has_more;
        }
      } catch (error) {
        console.error('Failed to load history:', error);
      }
    },

    async loadMoreHistory() {
      this.historyPage++;
      const response = await fetch(
        `/api/promptlayer/history?page=${this.historyPage}`,
        { headers: this.getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        this.history.push(...data.items);
        this.hasMoreHistory = data.has_more;
      }
    },

    toggleDetails(request) {
      this.expandedRequest = this.expandedRequest === request.id ? null : request.id;
    },

    viewHistory(prompt) {
      this.activeTab = 'history';
      this.filterPrompt = prompt.name;
      this.loadHistory();
    },

    async scoreRequest(request) {
      const score = prompt('Enter score (0-100):');
      if (!score) return;

      try {
        await fetch(`/api/promptlayer/requests/${request.id}/score`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders()
          },
          body: JSON.stringify({ score: parseInt(score) })
        });
        
        alert('Score added successfully!');
      } catch (error) {
        console.error('Failed to score request:', error);
      }
    },

    async replayRequest(request) {
      alert('Replay feature coming soon!');
    },

    exportRequest(request) {
      const blob = new Blob([JSON.stringify(request, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `request-${request.id}.json`;
      a.click();
    },

    // Settings
    async loadSettings() {
      try {
        const response = await fetch('/api/promptlayer/settings');
        if (response.ok) {
          this.settings = await response.json();
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    },

    async saveSettings() {
      try {
        const response = await fetch('/api/promptlayer/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.settings)
        });

        if (response.ok) {
          this.connectionStatus = {
            type: 'success',
            message: 'Settings saved successfully!'
          };
        }
      } catch (error) {
        this.connectionStatus = {
          type: 'error',
          message: 'Failed to save settings'
        };
      }
    },

    async testConnection() {
      try {
        const response = await fetch('/api/promptlayer/test', {
          headers: this.getAuthHeaders()
        });

        if (response.ok) {
          this.connectionStatus = {
            type: 'success',
            message: '✓ Connected to PromptLayer successfully!'
          };
        } else {
          throw new Error('Connection failed');
        }
      } catch (error) {
        this.connectionStatus = {
          type: 'error',
          message: '✗ Failed to connect. Check your API key.'
        };
      }
    },

    // Utilities
    getAuthHeaders() {
      return {
        'X-PromptLayer-API-Key': this.settings.apiKey
      };
    },

    formatDate(date) {
      return new Date(date).toLocaleDateString();
    },

    formatTimestamp(timestamp) {
      return new Date(timestamp).toLocaleString();
    },

    formatNumber(num) {
      return num?.toLocaleString() || '0';
    }
  },

  mounted() {
    this.loadSettings();
    this.loadPrompts();
    this.loadAnalytics();
    this.loadHistory();
  }
};
</script>

<style scoped>
.promptlayer-manager {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #666;
  font-size: 1.1rem;
}

/* Tabs */
.tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 2px solid #e0e0e0;
  margin-bottom: 2rem;
}

.tab {
  padding: 0.75rem 1.5rem;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-size: 1rem;
  color: #666;
  transition: all 0.2s;
}

.tab:hover {
  color: #333;
}

.tab.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
}

.tab-content {
  min-height: 500px;
}

/* Section Headers */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-header h2 {
  font-size: 1.5rem;
  margin: 0;
}

/* Prompt List */
.prompt-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.prompt-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
}

.prompt-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 1rem;
}

.prompt-title {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.prompt-title h3 {
  margin: 0;
  font-size: 1.25rem;
}

.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.badge.active {
  background: #10b981;
  color: white;
}

.badge.draft {
  background: #f59e0b;
  color: white;
}

.prompt-actions {
  display: flex;
  gap: 0.5rem;
}

.prompt-meta {
  display: flex;
  gap: 1.5rem;
  color: #666;
  font-size: 0.875rem;
}

.prompt-editor {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e0e0e0;
}

.editor-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

/* Analytics */
.date-range {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.metric-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
}

.metric-label {
  color: #666;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.metric-value {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.metric-change {
  font-size: 0.875rem;
  font-weight: 600;
}

.metric-change.positive {
  color: #10b981;
}

.metric-change.negative {
  color: #ef4444;
}

.analytics-section {
  margin-top: 2rem;
}

.analytics-section h3 {
  margin-bottom: 1rem;
}

.table-container {
  overflow-x: auto;
}

.analytics-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}

.analytics-table th,
.analytics-table td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

.analytics-table th {
  background: #f9fafb;
  font-weight: 600;
}

.rate-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 600;
}

.rate-badge.excellent {
  background: #d1fae5;
  color: #065f46;
}

.rate-badge.good {
  background: #dbeafe;
  color: #1e40af;
}

.rate-badge.fair {
  background: #fef3c7;
  color: #92400e;
}

.rate-badge.poor {
  background: #fee2e2;
  color: #991b1b;
}

/* History */
.filters {
  display: flex;
  gap: 1rem;
}

.search-input {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  min-width: 300px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.history-item {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-info {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.history-prompt {
  font-weight: 600;
}

.history-time {
  color: #666;
  font-size: 0.875rem;
}

.history-status {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.history-status.success {
  background: #d1fae5;
  color: #065f46;
}

.history-status.error {
  background: #fee2e2;
  color: #991b1b;
}

.history-details {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
}

.detail-section {
  margin-bottom: 1rem;
}

.detail-section h4 {
  margin-bottom: 0.5rem;
  color: #666;
  font-size: 0.875rem;
  text-transform: uppercase;
}

.detail-section pre {
  background: #f9fafb;
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.875rem;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 4px;
}

.detail-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.pagination {
  margin-top: 2rem;
  text-align: center;
}

/* Form Elements */
.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.form-group input[type="text"],
.form-group input[type="password"],
.form-group input[type="number"],
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.form-group textarea {
  font-family: monospace;
}

.help-text {
  color: #666;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

/* Buttons */
.btn-primary,
.btn-secondary,
.btn-icon,
.btn-text {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #2563eb;
  color: white;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  background: none;
  padding: 0.25rem;
  font-size: 1.25rem;
}

.btn-text {
  background: none;
  color: #666;
}

.btn-text:hover {
  color: #333;
}

.actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #e0e0e0;
}

/* Status Messages */
.status-message {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 4px;
  font-weight: 600;
}

.status-message.success {
  background: #d1fae5;
  color: #065f46;
}

.status-message.error {
  background: #fee2e2;
  color: #991b1b;
}
</style>


