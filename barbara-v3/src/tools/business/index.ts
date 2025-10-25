/**
 * Business Tools Index
 * Export all business tools for Barbara
 */

// Lead Management
export { getLeadContextTool } from './get-lead-context.tool.js';
export { checkConsentDNCTool } from './check-consent-dnc.tool.js';
export { updateLeadInfoTool } from './update-lead-info.tool.js';

// Broker Assignment
export { findBrokerByTerritoryTool } from './find-broker-by-territory.tool.js';
export { checkBrokerAvailabilityTool } from './check-broker-availability.tool.js';

// Appointments
export { bookAppointmentTool } from './book-appointment.tool.js';
export { assignTrackingNumberTool } from './assign-tracking-number.tool.js';
export { 
  sendAppointmentConfirmationTool, 
  verifyAppointmentConfirmationTool 
} from './send-appointment-confirmation.tool.js';

// Data & Knowledge
export { saveInteractionTool } from './save-interaction.tool.js';
export { searchKnowledgeTool } from './search-knowledge.tool.js';

