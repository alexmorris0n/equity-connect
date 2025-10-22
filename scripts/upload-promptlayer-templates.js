#!/usr/bin/env node

/**
 * Upload PromptLayer Templates Script
 *
 * Reads templates from PROMPTLAYER_TEMPLATES_TO_UPLOAD.md
 * and uploads them to PromptLayer via API
 */

const fs = require('fs');
const path = require('path');

// Check if we have the required environment variables
if (!process.env.PROMPTLAYER_API_KEY) {
  console.error('❌ Missing PROMPTLAYER_API_KEY environment variable');
  process.exit(1);
}

const PROMPTLAYER_API_KEY = process.env.PROMPTLAYER_API_KEY;
const API_BASE = 'https://api.promptlayer.com/rest';

/**
 * Parse templates from markdown file
 */
function parseTemplates() {
  const filePath = path.join(__dirname, '..', 'PROMPTLAYER_TEMPLATES_TO_UPLOAD.md');

  if (!fs.existsSync(filePath)) {
    console.error('❌ PROMPTLAYER_TEMPLATES_TO_UPLOAD.md not found');
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const templates = [];

  // Split by template sections
  const sections = content.split(/^---$/gm).slice(1); // Skip header section

  for (const section of sections) {
    const lines = section.trim().split('\n');

    let currentTemplate = null;
    let inTemplateContent = false;
    let templateContent = '';

    for (const line of lines) {
      if (line.startsWith('**Name:** `')) {
        const nameMatch = line.match(/\*\*Name:\*\*\s+`([^`]+)`/);
        if (nameMatch) {
          currentTemplate = { name: nameMatch[1] };
        }
      } else if (line.startsWith('**Description:**')) {
        // Skip description
      } else if (line.startsWith('**Template Content:**')) {
        inTemplateContent = true;
      } else if (line.startsWith('```') && inTemplateContent) {
        if (line === '```') {
          // End of template content
          inTemplateContent = false;
        } else {
          // Start of template content
          templateContent = '';
        }
      } else if (inTemplateContent && line.trim()) {
        templateContent += line + '\n';
      } else if (line.startsWith('---') && currentTemplate && templateContent.trim()) {
        // End of template - save it
        currentTemplate.template = templateContent.trim();
        templates.push(currentTemplate);
        currentTemplate = null;
        templateContent = '';
        inTemplateContent = false;
      }
    }

    // Save last template if we have one
    if (currentTemplate && templateContent.trim()) {
      currentTemplate.template = templateContent.trim();
      templates.push(currentTemplate);
    }
  }

  return templates;
}

/**
 * Upload template to PromptLayer
 */
async function uploadTemplate(template) {
  console.log(`📤 Uploading template: ${template.name}`);

  try {
    const response = await fetch(`${API_BASE}/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': PROMPTLAYER_API_KEY
      },
      body: JSON.stringify({
        prompt_name: template.name,
        prompt_template: {
          template: template.template,
          input_variables: [] // We'll handle variables in the template
        },
        model: 'gpt-4o-mini',
        metadata: {
          description: `Barbara prompt template: ${template.name}`,
          uploaded_by: 'equity-connect-script'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to upload ${template.name}: ${response.status} - ${errorText}`);
      return false;
    }

    const data = await response.json();
    console.log(`✅ Uploaded ${template.name} (ID: ${data.id})`);
    return true;

  } catch (error) {
    console.error(`❌ Error uploading ${template.name}:`, error.message);
    return false;
  }
}

/**
 * Add production label to template
 */
async function addProductionLabel(templateId, templateName) {
  try {
    // First check if label exists, create if not
    const labelResponse = await fetch(`${API_BASE}/labels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': PROMPTLAYER_API_KEY
      },
      body: JSON.stringify({
        label_name: 'production'
      })
    });

    let labelId;
    if (labelResponse.ok) {
      const labelData = await labelResponse.json();
      labelId = labelData.id;
    } else if (labelResponse.status === 400) {
      // Label might already exist, try to get it
      const getLabelsResponse = await fetch(`${API_BASE}/labels`, {
        headers: { 'X-API-KEY': PROMPTLAYER_API_KEY }
      });

      if (getLabelsResponse.ok) {
        const labels = await getLabelsResponse.json();
        const productionLabel = labels.find(l => l.label_name === 'production');
        if (productionLabel) {
          labelId = productionLabel.id;
        }
      }
    }

    if (!labelId) {
      console.warn(`⚠️ Could not create/get production label for ${templateName}`);
      return;
    }

    // Assign label to template
    const assignResponse = await fetch(`${API_BASE}/templates/${templateId}/labels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': PROMPTLAYER_API_KEY
      },
      body: JSON.stringify({
        label_id: labelId
      })
    });

    if (assignResponse.ok) {
      console.log(`🏷️ Added production label to ${templateName}`);
    } else {
      console.warn(`⚠️ Failed to add production label to ${templateName}`);
    }

  } catch (error) {
    console.warn(`⚠️ Error adding production label to ${templateName}:`, error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting PromptLayer template upload...');

  // Parse templates from markdown file
  const templates = parseTemplates();
  console.log(`📋 Found ${templates.length} templates to upload:`);
  templates.forEach(t => console.log(`  - ${t.name}`));

  if (templates.length === 0) {
    console.error('❌ No templates found in PROMPTLAYER_TEMPLATES_TO_UPLOAD.md');
    process.exit(1);
  }

  // Upload each template
  let successCount = 0;
  for (const template of templates) {
    const success = await uploadTemplate(template);
    if (success) {
      successCount++;
      // Small delay between uploads
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`\n🎉 Upload complete: ${successCount}/${templates.length} templates uploaded successfully`);

  if (successCount < templates.length) {
    console.error('❌ Some templates failed to upload. Check errors above.');
    process.exit(1);
  } else {
    console.log('✅ All templates uploaded successfully!');
    console.log('📝 Note: You may want to manually add production labels in the PromptLayer dashboard');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { parseTemplates, uploadTemplate };
