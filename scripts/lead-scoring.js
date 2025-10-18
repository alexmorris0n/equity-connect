/**
 * Lead Scoring Algorithm for Equity Connect
 * Calculates lead quality scores based on multiple factors
 */

class LeadScoringEngine {
  constructor() {
    this.weights = {
      property: 0.40,      // 40% - Property value and equity
      demographics: 0.30,  // 30% - Age, ownership, location
      enrichment: 0.20,    // 20% - Contact info and data quality
      behavioral: 0.10     // 10% - Engagement and response patterns
    };
  }

  /**
   * Calculate comprehensive lead score
   * @param {Object} lead - Lead data object
   * @returns {Object} - Score breakdown and total
   */
  calculateLeadScore(lead) {
    const scores = {
      property: this.calculatePropertyScore(lead),
      demographics: this.calculateDemographicsScore(lead),
      enrichment: this.calculateEnrichmentScore(lead),
      behavioral: this.calculateBehavioralScore(lead)
    };

    // Calculate weighted total score
    const totalScore = Object.keys(scores).reduce((total, category) => {
      return total + (scores[category] * this.weights[category]);
    }, 0);

    return {
      totalScore: Math.round(totalScore),
      breakdown: scores,
      grade: this.getScoreGrade(totalScore),
      priority: this.getPriority(totalScore),
      recommendations: this.getRecommendations(scores, lead)
    };
  }

  /**
   * Calculate property-based score (40% weight)
   * @param {Object} lead - Lead data
   * @returns {number} - Property score (0-100)
   */
  calculatePropertyScore(lead) {
    let score = 0;

    // Equity amount (20 points max)
    if (lead.estimatedEquity >= 500000) score += 20;
    else if (lead.estimatedEquity >= 300000) score += 18;
    else if (lead.estimatedEquity >= 200000) score += 15;
    else if (lead.estimatedEquity >= 100000) score += 10;
    else if (lead.estimatedEquity >= 50000) score += 5;

    // Property value (15 points max)
    if (lead.propertyValue >= 1000000) score += 15;
    else if (lead.propertyValue >= 750000) score += 12;
    else if (lead.propertyValue >= 500000) score += 10;
    else if (lead.propertyValue >= 300000) score += 7;
    else if (lead.propertyValue >= 200000) score += 5;

    // Property type (5 points max)
    const propertyTypes = {
      'single_family': 5,
      'condo': 4,
      'townhouse': 4,
      'multi_family': 3,
      'mobile_home': 1
    };
    score += propertyTypes[lead.propertyType] || 0;

    return Math.min(score, 40);
  }

  /**
   * Calculate demographics-based score (30% weight)
   * @param {Object} lead - Lead data
   * @returns {number} - Demographics score (0-100)
   */
  calculateDemographicsScore(lead) {
    let score = 0;

    // Age factor (15 points max)
    if (lead.age >= 75) score += 15;
    else if (lead.age >= 70) score += 12;
    else if (lead.age >= 65) score += 10;
    else if (lead.age >= 62) score += 7;

    // Ownership status (10 points max)
    if (lead.ownerOccupied === true) score += 10;
    else if (lead.ownerOccupied === false) score += 0;

    // Location desirability (5 points max)
    const desirableStates = ['CA', 'FL', 'TX', 'WA', 'OR', 'AZ', 'NV', 'CO'];
    if (desirableStates.includes(lead.state)) score += 5;

    return Math.min(score, 30);
  }

  /**
   * Calculate enrichment-based score (20% weight)
   * @param {Object} lead - Lead data
   * @returns {number} - Enrichment score (0-100)
   */
  calculateEnrichmentScore(lead) {
    let score = 0;

    // Contact information (10 points max)
    if (lead.email && lead.phone) score += 10;
    else if (lead.email || lead.phone) score += 5;

    // Data quality (5 points max)
    if (lead.enrichmentConfidence >= 0.9) score += 5;
    else if (lead.enrichmentConfidence >= 0.7) score += 3;
    else if (lead.enrichmentConfidence >= 0.5) score += 1;

    // Demographics completeness (5 points max)
    const demographicFields = ['ethnicity', 'income', 'education', 'maritalStatus'];
    const completedFields = demographicFields.filter(field => lead[field]).length;
    score += (completedFields / demographicFields.length) * 5;

    return Math.min(score, 20);
  }

  /**
   * Calculate behavioral-based score (10% weight)
   * @param {Object} lead - Lead data
   * @returns {number} - Behavioral score (0-100)
   */
  calculateBehavioralScore(lead) {
    let score = 0;

    // Previous engagement (5 points max)
    if (lead.previousEngagement) {
      if (lead.previousEngagement.replied) score += 5;
      else if (lead.previousEngagement.opened) score += 3;
      else if (lead.previousEngagement.clicked) score += 2;
    }

    // Interest indicators (5 points max)
    const interestKeywords = ['retirement', 'healthcare', 'debt', 'family', 'home improvement'];
    const interests = lead.interests || [];
    const matchingInterests = interests.filter(interest => 
      interestKeywords.some(keyword => 
        interest.toLowerCase().includes(keyword)
      )
    ).length;
    score += Math.min(matchingInterests, 5);

    return Math.min(score, 10);
  }

  /**
   * Get score grade based on total score
   * @param {number} score - Total score
   * @returns {string} - Grade (A+, A, B+, B, C, D, F)
   */
  getScoreGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'B+';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  /**
   * Get priority level based on score
   * @param {number} score - Total score
   * @returns {string} - Priority (High, Medium, Low)
   */
  getPriority(score) {
    if (score >= 80) return 'High';
    if (score >= 60) return 'Medium';
    return 'Low';
  }

  /**
   * Get recommendations for lead improvement
   * @param {Object} scores - Score breakdown
   * @param {Object} lead - Lead data
   * @returns {Array} - Array of recommendations
   */
  getRecommendations(scores, lead) {
    const recommendations = [];

    if (scores.property < 20) {
      recommendations.push('Consider targeting higher-value properties');
    }

    if (scores.demographics < 15) {
      recommendations.push('Focus on older homeowners (70+)');
    }

    if (scores.enrichment < 10) {
      recommendations.push('Improve data enrichment for better contact info');
    }

    if (scores.behavioral < 5) {
      recommendations.push('Enhance engagement tracking and interest profiling');
    }

    return recommendations;
  }

  /**
   * Batch score multiple leads
   * @param {Array} leads - Array of lead objects
   * @returns {Array} - Array of scored leads
   */
  batchScoreLeads(leads) {
    return leads.map(lead => ({
      ...lead,
      score: this.calculateLeadScore(lead)
    })).sort((a, b) => b.score.totalScore - a.score.totalScore);
  }

  /**
   * Filter leads by minimum score
   * @param {Array} leads - Array of scored leads
   * @param {number} minScore - Minimum score threshold
   * @returns {Array} - Filtered leads
   */
  filterLeadsByScore(leads, minScore = 70) {
    return leads.filter(lead => lead.score.totalScore >= minScore);
  }

  /**
   * Get lead statistics
   * @param {Array} leads - Array of scored leads
   * @returns {Object} - Statistics object
   */
  getLeadStatistics(leads) {
    const scores = leads.map(lead => lead.score.totalScore);
    
    return {
      total: leads.length,
      average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      median: this.getMedian(scores),
      highQuality: leads.filter(lead => lead.score.totalScore >= 80).length,
      mediumQuality: leads.filter(lead => lead.score.totalScore >= 60 && lead.score.totalScore < 80).length,
      lowQuality: leads.filter(lead => lead.score.totalScore < 60).length,
      gradeDistribution: this.getGradeDistribution(leads)
    };
  }

  /**
   * Calculate median value
   * @param {Array} values - Array of numbers
   * @returns {number} - Median value
   */
  getMedian(values) {
    const sorted = values.sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    
    return sorted[middle];
  }

  /**
   * Get grade distribution
   * @param {Array} leads - Array of scored leads
   * @returns {Object} - Grade distribution
   */
  getGradeDistribution(leads) {
    const grades = leads.map(lead => lead.score.grade);
    const distribution = {};
    
    grades.forEach(grade => {
      distribution[grade] = (distribution[grade] || 0) + 1;
    });
    
    return distribution;
  }
}

/**
 * Campaign Timing Optimization
 */
class CampaignTimingOptimizer {
  constructor() {
    this.optimalTimings = {
      "Latino": {
        email: ["10:00 AM", "2:00 PM", "7:00 PM"],
        calls: ["10:00 AM - 12:00 PM", "2:00 PM - 4:00 PM", "7:00 PM - 8:00 PM"]
      },
      "South Asian": {
        email: ["11:00 AM", "5:00 PM", "8:00 PM"],
        calls: ["11:00 AM - 1:00 PM", "5:00 PM - 7:00 PM", "8:00 PM - 9:00 PM"]
      },
      "African American": {
        email: ["9:00 AM", "12:00 PM", "6:00 PM"],
        calls: ["9:00 AM - 11:00 AM", "12:00 PM - 2:00 PM", "6:00 PM - 8:00 PM"]
      },
      "General": {
        email: ["10:00 AM", "2:00 PM", "5:00 PM"],
        calls: ["10:00 AM - 12:00 PM", "2:00 PM - 4:00 PM", "5:00 PM - 7:00 PM"]
      }
    };
  }

  /**
   * Get optimal send time for lead
   * @param {Object} lead - Lead data with persona info
   * @returns {Object} - Optimal timing recommendations
   */
  getOptimalTiming(lead) {
    const persona = lead.persona || {};
    const heritage = persona.heritage || "General";
    
    // Map heritage to timing category
    let timingCategory = "General";
    if (heritage.includes("Latino") || heritage.includes("Hispanic")) {
      timingCategory = "Latino";
    } else if (heritage.includes("South Asian") || heritage.includes("Indian")) {
      timingCategory = "South Asian";
    } else if (heritage.includes("African American") || heritage.includes("Black")) {
      timingCategory = "African American";
    }

    return {
      email: this.optimalTimings[timingCategory].email,
      calls: this.optimalTimings[timingCategory].calls,
      timezone: lead.timezone || "America/Los_Angeles"
    };
  }

  /**
   * Calculate sequence delays
   * @param {Object} lead - Lead data
   * @returns {Array} - Array of delay days
   */
  getSequenceDelays(lead) {
    const baseDelays = [0, 3, 7, 12]; // days
    
    // Adjust based on lead score
    if (lead.score && lead.score.totalScore >= 80) {
      return [0, 2, 5, 8]; // Faster sequence for high-quality leads
    } else if (lead.score && lead.score.totalScore < 60) {
      return [0, 5, 10, 15]; // Slower sequence for lower-quality leads
    }
    
    return baseDelays;
  }
}

// Export classes for use in n8n workflows
module.exports = {
  LeadScoringEngine,
  CampaignTimingOptimizer
};

// Example usage
if (require.main === module) {
  const scorer = new LeadScoringEngine();
  const optimizer = new CampaignTimingOptimizer();

  // Example lead
  const exampleLead = {
    firstName: "Maria",
    lastName: "Gonzalez",
    age: 68,
    propertyValue: 750000,
    estimatedEquity: 450000,
    propertyType: "single_family",
    ownerOccupied: true,
    state: "CA",
    email: "maria@example.com",
    phone: "555-123-4567",
    enrichmentConfidence: 0.85,
    ethnicity: "Latino",
    income: 75000,
    education: "High School",
    maritalStatus: "Married",
    interests: ["retirement", "family", "healthcare"],
    persona: {
      heritage: "Latino/Hispanic"
    }
  };

  // Calculate score
  const score = scorer.calculateLeadScore(exampleLead);
  console.log("Lead Score:", score);

  // Get optimal timing
  const timing = optimizer.getOptimalTiming(exampleLead);
  console.log("Optimal Timing:", timing);
}
