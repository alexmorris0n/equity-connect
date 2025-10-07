// ============================================
// WATERFALL REVENUE MODEL - LEAD MONETIZATION MACHINE
// ============================================
// Primary: Booking → Secondary: Rework → Tertiary: Lead Sales

const waterfallRevenueModel = {
  // ============================================
  // LEAD PRODUCT HIERARCHY
  // ============================================
  
  leadProducts: {
    tier1: {
      product: "BOOKED & SHOWED APPOINTMENT",
      value: 500,
      verification: "CallRail 20+ min call during appointment window",
      percentage: "8-10% of leads",
      broker_payment: {
        booking_fee: 100,
        show_bonus: 400,
        total: 500
      }
    },
    
    tier2: {
      product: "BOOKED BUT NO-SHOW",
      value: 100,
      action: "Rebook or resell",
      percentage: "3-5% of leads",
      broker_payment: {
        booking_fee: 100,
        show_bonus: 0,
        total: 100
      }
    },
    
    tier3: {
      product: "ENGAGED BUT NOT BOOKED",
      value: 75,
      criteria: "Replied, answered call, but didn't book",
      percentage: "10-15% of leads",
      action: "Rework campaign or sell to secondary brokers"
    },
    
    tier4: {
      product: "WARM UNRESPONSIVE",
      value: 25,
      criteria: "Opened 3+ emails, clicked link, no reply",
      percentage: "20-30% of leads",
      action: "SMS campaign or sell as warm leads"
    },
    
    tier5: {
      product: "COLD DATA",
      value: 5,
      criteria: "Valid contact info, no engagement",
      percentage: "40-50% of leads",
      action: "Sell to data companies or call centers"
    }
  },

  // ============================================
  // CALLRAIL SHOW VERIFICATION SYSTEM
  // ============================================
  
  callRailVerification: {
    // Each broker gets unique tracking numbers
    trackingNumbers: {
      broker1: "555-100-0001",
      broker2: "555-100-0002",
      broker3: "555-100-0003"
      // Dynamic number pools for scale
    },
    
    // Appointment verification logic
    verifyShow: async (appointmentId) => {
      const appointment = await getAppointment(appointmentId);
      
      // Query CallRail API for calls during appointment window
      const calls = await callRail.getCalls({
        start_time: appointment.time - 30*60*1000,  // 30 min before
        end_time: appointment.time + 90*60*1000,    // 90 min after
        tracking_number: appointment.broker.tracking_number
      });
      
      // Check for qualifying call
      const showCall = calls.find(call => {
        return (
          call.duration >= 1200 &&  // 20+ minutes
          call.customer_phone === appointment.lead.phone
        );
      });
      
      if (showCall) {
        return {
          verified: true,
          duration: showCall.duration,
          recording_url: showCall.recording_url,
          transcript: showCall.transcript,
          confidence: 0.95,
          show_bonus_earned: 400
        };
      }
      
      return { 
        verified: false,
        show_bonus_earned: 0
      };
    },
    
    // Additional verification signals
    additionalVerification: {
      keywordDetection: [
        "reverse mortgage",
        "home equity",
        "application",
        "next steps",
        "paperwork",
        "documents"
      ],
      sentimentThreshold: 0.6,  // Positive conversation
      talkTimeRatio: 0.4,       // Lead talked 40%+ of time
      callQuality: {
        minDuration: 1200,      // 20 minutes minimum
        maxDuration: 7200,      // 2 hours maximum (reasonable)
        recordingQuality: 0.8   // Clear audio quality
      }
    }
  },

  // ============================================
  // REWORK FUNNEL SYSTEM
  // ============================================
  
  reworkFunnel: {
    day8_14: {
      segment: "Opened but didn't reply",
      strategy: "SMS campaign + different persona",
      message: "Text message from 'assistant' about missed opportunity",
      expected_booking_rate: "5%",
      revenue_per_conversion: 500
    },
    
    day15_21: {
      segment: "Replied but didn't book",
      strategy: "Direct human call from 'manager'",
      script: "I saw you were interested but haven't connected with {broker}...",
      expected_booking_rate: "15%",
      revenue_per_conversion: 500
    },
    
    day22_30: {
      segment: "All engaged leads",
      strategy: "Final offer email + urgency",
      message: "Rates increasing next month, last chance",
      expected_booking_rate: "3%",
      revenue_per_conversion: 500
    },
    
    day31: {
      action: "Package and sell as aged exclusive",
      buyers: "Secondary broker network",
      price: 25,
      volume_discount: {
        "100+": 0.8,  // 20% discount for bulk
        "500+": 0.7,  // 30% discount for large volume
        "1000+": 0.6  // 40% discount for enterprise
      }
    }
  },

  // ============================================
  // LEAD MARKETPLACE PRICING
  // ============================================
  
  leadMarketplace: {
    pricing: {
      exclusive_booking: 500,      // One broker only
      shared_warm: 75,            // Up to 3 brokers
      aged_exclusive: 25,         // 30+ days old
      data_append: 3,             // Just the data
      bulk_warm: 15,              // 100+ warm leads
      bulk_cold: 5                // 100+ cold leads
    },
    
    buyerTypes: {
      tier1_brokers: {
        description: "Premium reverse mortgage brokers",
        pricing: "exclusive_booking",
        volume: "10-50 leads/month",
        requirements: "NMLS licensed, 2+ years experience"
      },
      
      tier2_brokers: {
        description: "Standard reverse mortgage brokers",
        pricing: "shared_warm",
        volume: "20-100 leads/month",
        requirements: "NMLS licensed"
      },
      
      call_centers: {
        description: "Outbound call centers",
        pricing: "bulk_warm",
        volume: "500+ leads/month",
        requirements: "TCPA compliant, recorded calls"
      },
      
      data_companies: {
        description: "Lead aggregators and data companies",
        pricing: "bulk_cold",
        volume: "1000+ leads/month",
        requirements: "Data processing agreement"
      }
    }
  },

  // ============================================
  // REVENUE CALCULATION ENGINE
  // ============================================
  
  calculateRevenue: (leadBatch) => {
    const batchSize = leadBatch.length;
    
    // Primary Revenue (Booking)
    const shows = Math.floor(batchSize * 0.09); // 9% show rate
    const noShows = Math.floor(batchSize * 0.04); // 4% no-show rate
    const primaryRevenue = (shows * 500) + (noShows * 100);
    
    // Secondary Revenue (Rework)
    const reworkedShows = Math.floor(noShows * 0.3); // 30% of no-shows rebook
    const secondaryRevenue = reworkedShows * 500;
    
    // Tertiary Revenue (Lead Sales)
    const engagedNotBooked = Math.floor(batchSize * 0.12); // 12% engaged
    const warmUnresponsive = Math.floor(batchSize * 0.25); // 25% warm
    const coldData = Math.floor(batchSize * 0.45); // 45% cold
    
    const tertiaryRevenue = 
      (engagedNotBooked * 75) +    // $75 per engaged lead
      (warmUnresponsive * 25) +    // $25 per warm lead
      (coldData * 5);              // $5 per cold lead
    
    const totalRevenue = primaryRevenue + secondaryRevenue + tertiaryRevenue;
    const revenuePerLead = totalRevenue / batchSize;
    
    return {
      batchSize,
      primaryRevenue,
      secondaryRevenue,
      tertiaryRevenue,
      totalRevenue,
      revenuePerLead,
      breakdown: {
        shows,
        noShows,
        reworkedShows,
        engagedNotBooked,
        warmUnresponsive,
        coldData
      }
    };
  },

  // ============================================
  // BROKER TIER SYSTEM
  // ============================================
  
  brokerTiers: {
    premium: {
      name: "Premium Brokers",
      requirements: {
        minExperience: 3,
        minVolume: 50,
        conversionRate: 0.12,
        paymentHistory: "excellent"
      },
      benefits: {
        leadQuality: "highest",
        pricing: "exclusive_booking",
        support: "dedicated_account_manager",
        territory: "exclusive"
      },
      pricing: {
        booking_fee: 100,
        show_bonus: 400,
        total_per_show: 500
      }
    },
    
    standard: {
      name: "Standard Brokers",
      requirements: {
        minExperience: 1,
        minVolume: 20,
        conversionRate: 0.08,
        paymentHistory: "good"
      },
      benefits: {
        leadQuality: "high",
        pricing: "shared_warm",
        support: "standard_support",
        territory: "shared"
      },
      pricing: {
        booking_fee: 75,
        show_bonus: 325,
        total_per_show: 400
      }
    },
    
    volume: {
      name: "Volume Brokers",
      requirements: {
        minExperience: 0,
        minVolume: 100,
        conversionRate: 0.05,
        paymentHistory: "acceptable"
      },
      benefits: {
        leadQuality: "standard",
        pricing: "bulk_pricing",
        support: "self_service",
        territory: "open"
      },
      pricing: {
        booking_fee: 50,
        show_bonus: 200,
        total_per_show: 250
      }
    }
  },

  // ============================================
  // AUTOMATED REWORK WORKFLOW
  // ============================================
  
  reworkWorkflow: {
    triggers: {
      day8: "Lead not replied to emails",
      day15: "Lead replied but didn't book",
      day22: "Lead engaged but no booking",
      day30: "Lead aged out - package for sale"
    },
    
    actions: {
      day8: {
        type: "SMS_campaign",
        persona: "different_persona",
        message: "Hi {name}, I noticed you were interested in reverse mortgage info but haven't connected with {broker}. Rates are changing next week. Can I have {broker} call you today?",
        expected_response: "5%"
      },
      
      day15: {
        type: "human_call",
        script: "Hi {name}, this is {manager_name} from Equity Connect. I saw you were interested in reverse mortgage information but haven't been able to connect with {broker}. I wanted to personally ensure you get the information you need. Can I have {broker} call you today?",
        expected_response: "15%"
      },
      
      day22: {
        type: "urgency_email",
        subject: "Final Notice: Reverse Mortgage Rates Increasing",
        message: "Hi {name}, this is your final notice that reverse mortgage rates are increasing next month. {broker} has reserved time to call you today. This is your last chance at current rates.",
        expected_response: "3%"
      },
      
      day30: {
        type: "package_for_sale",
        criteria: "All non-converted leads",
        pricing: "aged_exclusive",
        buyers: "secondary_broker_network"
      }
    }
  }
};

// ============================================
// EXPORT FOR N8N WORKFLOW INTEGRATION
// ============================================

module.exports = {
  waterfallRevenueModel,
  
  // Helper functions for n8n workflows
  helpers: {
    calculateLeadValue: (lead) => {
      const score = lead.engagement_score || 0;
      if (score >= 80) return 500; // Booked & showed
      if (score >= 60) return 100; // Booked but no-show
      if (score >= 40) return 75;  // Engaged but not booked
      if (score >= 20) return 25;  // Warm unresponsive
      return 5; // Cold data
    },
    
    determineReworkStrategy: (lead) => {
      const daysSinceFirstContact = lead.days_since_first_contact || 0;
      const engagementLevel = lead.engagement_score || 0;
      
      if (daysSinceFirstContact >= 30) return "package_for_sale";
      if (daysSinceFirstContact >= 22) return "urgency_email";
      if (daysSinceFirstContact >= 15) return "human_call";
      if (daysSinceFirstContact >= 8) return "SMS_campaign";
      return "continue_primary_campaign";
    },
    
    getBrokerTier: (broker) => {
      const experience = broker.years_experience || 0;
      const volume = broker.monthly_volume || 0;
      const conversionRate = broker.conversion_rate || 0;
      
      if (experience >= 3 && volume >= 50 && conversionRate >= 0.12) {
        return "premium";
      } else if (experience >= 1 && volume >= 20 && conversionRate >= 0.08) {
        return "standard";
      } else {
        return "volume";
      }
    }
  }
};
