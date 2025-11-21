<!-- GenerationReportModal.vue - Dark Mode -->

<template>
  <div class="modal-overlay" v-if="visible" @click="close">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>✓ Vertical Saved Successfully</h2>
      </div>
      
      <div class="modal-body">
        <h3>Step Criteria Generation Report</h3>
        
        <table class="report-table">
          <thead>
            <tr>
              <th>Node</th>
              <th>SignalWire</th>
              <th>LiveKit</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="node in report.nodes" 
              :key="node.node_name"
              :class="{ 'has-warning': node.has_warning }"
            >
              <td>{{ node.node_name }}</td>
              <td>
                <span class="badge" :class="node.sw_method">
                  {{ node.sw_method }}
                </span>
              </td>
              <td>
                <span class="badge" :class="node.lk_method">
                  {{ node.lk_method }}
                </span>
              </td>
              <td>
                <span v-if="!node.has_warning">✓</span>
                <span v-else class="warning" :title="node.warning_message">
                  ⚠️
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        
        <div class="summary">
          <h4>Summary</h4>
          <ul>
            <li>{{ report.stats.total_processed }} nodes processed</li>
            <li>{{ report.stats.mini_success }} used gpt-4o-mini (fast & cheap)</li>
            <li v-if="report.stats.full_used > 0">
              {{ report.stats.full_used }} required gpt-4o (complex input)
            </li>
            <li v-if="report.stats.manual_used > 0" class="warning">
              ⚠️ {{ report.stats.manual_used }} used manual fallback (review recommended)
            </li>
          </ul>
          <p class="cost">Estimated cost: {{ report.stats.cost_estimate }}</p>
        </div>
      </div>
      
      <div class="modal-footer">
        <button @click="close" class="btn-primary">Close</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: ['visible', 'report'],
  methods: {
    close() {
      this.$emit('close')
    }
  }
}
</script>

<style scoped>
/* Dark Mode Theme */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: #1e1e1e;
  color: #e0e0e0;
  border-radius: 12px;
  padding: 24px;
  max-width: 700px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  border: 1px solid #333;
}

.modal-header {
  border-bottom: 1px solid #333;
  padding-bottom: 16px;
  margin-bottom: 20px;
}

.modal-header h2 {
  margin: 0;
  color: #4caf50;
  font-size: 24px;
  font-weight: 600;
}

.modal-body h3 {
  color: #e0e0e0;
  font-size: 18px;
  margin-bottom: 16px;
  font-weight: 500;
}

/* Table Styles */
.report-table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  background: #252525;
  border-radius: 8px;
  overflow: hidden;
}

.report-table thead {
  background: #2d2d2d;
}

.report-table th {
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: #fff;
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 0.5px;
  border-bottom: 2px solid #333;
}

.report-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #2d2d2d;
  color: #e0e0e0;
}

.report-table tbody tr {
  transition: background 0.2s;
}

.report-table tbody tr:hover {
  background: #2d2d2d;
}

.report-table tr.has-warning {
  background: rgba(255, 152, 0, 0.1);
  border-left: 3px solid #ff9800;
}

.report-table tr.has-warning:hover {
  background: rgba(255, 152, 0, 0.15);
}

/* Badge Styles */
.badge {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: inline-block;
}

.badge.mini {
  background: #4caf50;
  color: #000;
}

.badge.full {
  background: #ff9800;
  color: #000;
}

.badge.manual {
  background: #f44336;
  color: #fff;
}

/* Warning Icon */
.warning {
  cursor: help;
  font-size: 18px;
  filter: drop-shadow(0 0 2px rgba(255, 152, 0, 0.5));
}

/* Summary Section */
.summary {
  margin-top: 24px;
  padding: 16px;
  background: #252525;
  border-radius: 8px;
  border: 1px solid #333;
}

.summary h4 {
  margin: 0 0 12px 0;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}

.summary ul {
  margin: 8px 0;
  padding-left: 20px;
  list-style: none;
}

.summary li {
  margin: 8px 0;
  color: #b0b0b0;
  line-height: 1.6;
  position: relative;
  padding-left: 20px;
}

.summary li::before {
  content: "•";
  position: absolute;
  left: 0;
  color: #4caf50;
  font-weight: bold;
}

.summary li.warning {
  color: #ff9800;
  font-weight: 500;
}

.summary li.warning::before {
  content: "⚠";
  color: #ff9800;
}

.cost {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #333;
  font-size: 14px;
  color: #888;
  text-align: right;
}

/* Footer */
.modal-footer {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #333;
  text-align: right;
}

.btn-primary {
  padding: 10px 24px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(33, 150, 243, 0.3);
}

.btn-primary:hover {
  background: #1976d2;
  box-shadow: 0 4px 12px rgba(33, 150, 243, 0.4);
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(33, 150, 243, 0.3);
}

/* Scrollbar Styling (Dark Mode) */
.modal-content::-webkit-scrollbar {
  width: 8px;
}

.modal-content::-webkit-scrollbar-track {
  background: #1e1e1e;
}

.modal-content::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 4px;
}

.modal-content::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* Animation */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-content {
  animation: fadeIn 0.2s ease-out;
}
</style>

