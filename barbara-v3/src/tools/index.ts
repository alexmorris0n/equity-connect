/**
 * Tool Index
 * Export all available tools for Barbara
 */

import { timeTool } from './time.tool.js';
import { weatherTool } from './weather.tool.js';

// Business tools
import {
  getLeadContextTool,
  checkConsentDNCTool,
  updateLeadInfoTool,
  findBrokerByTerritoryTool,
  checkBrokerAvailabilityTool,
  bookAppointmentTool,
  assignTrackingNumberTool,
  sendAppointmentConfirmationTool,
  verifyAppointmentConfirmationTool,
  saveInteractionTool,
  searchKnowledgeTool
} from './business/index.js';

// Export all tools as an array
export const allTools = [
  // Demo tools
  timeTool,
  weatherTool,
  
  // Business tools
  getLeadContextTool,
  checkConsentDNCTool,
  updateLeadInfoTool,
  findBrokerByTerritoryTool,
  checkBrokerAvailabilityTool,
  bookAppointmentTool,
  assignTrackingNumberTool,
  sendAppointmentConfirmationTool,
  verifyAppointmentConfirmationTool,
  saveInteractionTool,
  searchKnowledgeTool
];

