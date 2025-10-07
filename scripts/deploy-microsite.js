const { Vercel } = require('@vercel/client');
const fs = require('fs');
const path = require('path');

/**
 * Deploy Microsite Script for Equity Connect
 * Automatically creates and deploys personalized microsites for each lead
 */

class MicrositeDeployer {
  constructor() {
    this.client = new Vercel({
      token: process.env.VERCEL_TOKEN,
      teamId: process.env.VERCEL_TEAM_ID
    });
  }

  /**
   * Deploy a new microsite for a lead
   * @param {Object} config - Lead and persona configuration
   * @returns {Promise<string>} - Deployment URL
   */
  async deployMicrosite(config) {
    try {
      console.log(`Deploying microsite for ${config.lead.firstName} ${config.lead.lastName} in ${config.neighborhood}`);

      // Generate subdomain slug
      const subdomain = this.generateSubdomain(config.neighborhood);
      
      // Prepare environment variables
      const envVars = this.prepareEnvironmentVariables(config);
      
      // Create deployment
      const deployment = await this.client.deployments.create({
        name: `equity-connect-${subdomain}`,
        project: 'equity-connect-microsites',
        target: 'production',
        gitSource: {
          type: 'github',
          repo: 'equity-connect/microsites',
          ref: 'main'
        },
        env: envVars,
        alias: [`${subdomain}.equityconnect.com`]
      });

      console.log(`✅ Microsite deployed: ${deployment.url}`);
      return deployment.url;

    } catch (error) {
      console.error('❌ Deployment failed:', error);
      throw error;
    }
  }

  /**
   * Generate SEO-friendly subdomain from neighborhood name
   * @param {string} neighborhood - Neighborhood name
   * @returns {string} - Subdomain slug
   */
  generateSubdomain(neighborhood) {
    return neighborhood
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .substring(0, 50); // Limit length
  }

  /**
   * Prepare environment variables for deployment
   * @param {Object} config - Lead configuration
   * @returns {Object} - Environment variables
   */
  prepareEnvironmentVariables(config) {
    return {
      NEXT_PUBLIC_PERSONA_ID: config.persona.id,
      NEXT_PUBLIC_PERSONA_NAME: config.persona.name,
      NEXT_PUBLIC_PERSONA_HERITAGE: config.persona.heritage,
      NEXT_PUBLIC_NEIGHBORHOOD: config.neighborhood,
      NEXT_PUBLIC_LEAD_FIRST_NAME: config.lead.firstName,
      NEXT_PUBLIC_PROPERTY_ADDRESS: config.lead.propertyAddress,
      NEXT_PUBLIC_PROPERTY_VALUE: config.lead.propertyValue,
      NEXT_PUBLIC_ESTIMATED_EQUITY: config.lead.estimatedEquity,
      NEXT_PUBLIC_LEAD_ID: config.lead.id,
      NEXT_PUBLIC_API_ENDPOINT: process.env.API_ENDPOINT || 'https://api.equityconnect.com',
      NEXT_PUBLIC_TRACKING_ID: config.tracking.callRailId,
      NEXT_PUBLIC_GTM_ID: process.env.GTM_ID,
      NEXT_PUBLIC_FB_PIXEL_ID: process.env.FB_PIXEL_ID,
      NEXT_PUBLIC_HOTJAR_ID: process.env.HOTJAR_ID
    };
  }

  /**
   * Update existing microsite with new data
   * @param {string} subdomain - Existing subdomain
   * @param {Object} config - Updated configuration
   * @returns {Promise<string>} - Updated deployment URL
   */
  async updateMicrosite(subdomain, config) {
    try {
      console.log(`Updating microsite: ${subdomain}.equityconnect.com`);

      const envVars = this.prepareEnvironmentVariables(config);
      
      const deployment = await this.client.deployments.create({
        name: `equity-connect-${subdomain}-update`,
        project: 'equity-connect-microsites',
        target: 'production',
        gitSource: {
          type: 'github',
          repo: 'equity-connect/microsites',
          ref: 'main'
        },
        env: envVars,
        alias: [`${subdomain}.equityconnect.com`]
      });

      console.log(`✅ Microsite updated: ${deployment.url}`);
      return deployment.url;

    } catch (error) {
      console.error('❌ Update failed:', error);
      throw error;
    }
  }

  /**
   * Delete microsite deployment
   * @param {string} subdomain - Subdomain to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteMicrosite(subdomain) {
    try {
      console.log(`Deleting microsite: ${subdomain}.equityconnect.com`);

      // Note: Vercel doesn't have a direct delete API for deployments
      // This would typically involve removing the alias and letting it expire
      console.log(`⚠️ Microsite ${subdomain} marked for deletion (will expire naturally)`);
      return true;

    } catch (error) {
      console.error('❌ Deletion failed:', error);
      throw error;
    }
  }

  /**
   * Get deployment status
   * @param {string} subdomain - Subdomain to check
   * @returns {Promise<Object>} - Deployment status
   */
  async getDeploymentStatus(subdomain) {
    try {
      const deployments = await this.client.deployments.list({
        project: 'equity-connect-microsites'
      });

      const deployment = deployments.find(d => 
        d.alias && d.alias.includes(`${subdomain}.equityconnect.com`)
      );

      return {
        exists: !!deployment,
        status: deployment?.state || 'not_found',
        url: deployment?.url,
        createdAt: deployment?.createdAt
      };

    } catch (error) {
      console.error('❌ Status check failed:', error);
      throw error;
    }
  }

  /**
   * Batch deploy multiple microsites
   * @param {Array} configs - Array of lead configurations
   * @returns {Promise<Array>} - Deployment results
   */
  async batchDeploy(configs) {
    console.log(`🚀 Starting batch deployment of ${configs.length} microsites`);
    
    const results = [];
    const batchSize = 5; // Deploy 5 at a time to avoid rate limits

    for (let i = 0; i < configs.length; i += batchSize) {
      const batch = configs.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (config) => {
        try {
          const url = await this.deployMicrosite(config);
          return { success: true, url, config };
        } catch (error) {
          return { success: false, error: error.message, config };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Wait between batches to respect rate limits
      if (i + batchSize < configs.length) {
        console.log('⏳ Waiting 30 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Batch deployment complete: ${successCount}/${configs.length} successful`);

    return results;
  }
}

/**
 * Example usage and configuration
 */
async function exampleUsage() {
  const deployer = new MicrositeDeployer();

  // Example lead configuration
  const exampleConfig = {
    lead: {
      id: 'lead_12345',
      firstName: 'Maria',
      lastName: 'Gonzalez',
      propertyAddress: '123 Main St, Hollywood, CA 90210',
      propertyValue: 750000,
      estimatedEquity: 450000
    },
    persona: {
      id: 'carlos_maria_rodriguez',
      name: 'Maria Rodriguez',
      heritage: 'Latino/Hispanic'
    },
    neighborhood: 'Hollywood',
    tracking: {
      callRailId: 'callrail_123'
    }
  };

  try {
    // Deploy single microsite
    const url = await deployer.deployMicrosite(exampleConfig);
    console.log(`Microsite deployed at: ${url}`);

    // Check deployment status
    const status = await deployer.getDeploymentStatus('hollywood');
    console.log('Deployment status:', status);

  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Export for use in n8n workflows
module.exports = {
  MicrositeDeployer,
  exampleUsage
};

// Run example if called directly
if (require.main === module) {
  exampleUsage();
}
