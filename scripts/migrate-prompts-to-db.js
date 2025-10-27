/**
 * Migrate Existing Markdown Prompts to Database
 * 
 * This script:
 * 1. Reads all .md files from prompts/ directory
 * 2. Parses them into structured sections
 * 3. Extracts template variables
 * 4. Creates prompt records in Supabase
 * 5. Creates version 1 for each prompt
 * 6. Marks one as base/default prompt
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Section keywords mapping
const SECTION_KEYWORDS = {
  role: ['role', 'objective', 'you are', 'identity'],
  personality: ['personality', 'voice', 'tone', 'style', 'response length'],
  lead_context: ['lead context', 'caller context', 'caller information', 'lead information'],
  broker_context: ['broker context', 'broker information', 'your broker'],
  conversation_flow: ['conversation flow', 'call flow', 'interaction flow', 'structure', 'steps'],
  tools: ['tools', 'functions', 'available tools', 'function calling'],
  objection_handling: ['objection', 'handling', 'common objections'],
  safety: ['safety', 'escalation', 'transfer', 'compliance'],
  compliance: ['tcpa', 'compliance', 'disclaimer', 'legal']
};

/**
 * Parse markdown content into structured sections
 */
function parseMarkdownIntoSections(markdown, filename) {
  const sections = {};
  const lines = markdown.split('\n');
  
  let currentSection = null;
  let currentContent = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this is a header line (# or ##)
    if (line.match(/^#+\s+(.+)/)) {
      // Save previous section if it exists
      if (currentSection && currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n').trim();
        currentContent = [];
      }
      
      // Determine which section this header belongs to
      const headerText = line.replace(/^#+\s+/, '').toLowerCase();
      currentSection = mapHeaderToSection(headerText);
      
      continue; // Don't include the header in content
    }
    
    // Add line to current section
    if (currentSection) {
      currentContent.push(line);
    } else {
      // Before any section header, assume it's role/objective
      if (!sections.role) {
        if (!currentContent) currentContent = [];
        currentContent.push(line);
        currentSection = 'role';
      }
    }
  }
  
  // Save last section
  if (currentSection && currentContent.length > 0) {
    sections[currentSection] = currentContent.join('\n').trim();
  }
  
  // If no sections found, put everything in role
  if (Object.keys(sections).length === 0) {
    sections.role = markdown.trim();
  }
  
  return sections;
}

/**
 * Map header text to section ID
 */
function mapHeaderToSection(headerText) {
  for (const [sectionId, keywords] of Object.entries(SECTION_KEYWORDS)) {
    if (keywords.some(keyword => headerText.includes(keyword))) {
      return sectionId;
    }
  }
  
  // Default to role if no match
  return 'role';
}

/**
 * Extract template variables from content
 */
function extractVariables(content) {
  const variables = new Set();
  const regex = /{{(\w+)}}/g;
  
  const text = typeof content === 'object' ? JSON.stringify(content) : content;
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    variables.add(match[1]);
  }
  
  return Array.from(variables);
}

/**
 * Migrate a single prompt file
 */
async function migratePromptFile(filepath, filename) {
  console.log(`\n📄 Processing: ${filename}`);
  
  try {
    // Read file content
    const markdown = fs.readFileSync(filepath, 'utf8');
    
    // Parse into sections
    const sections = parseMarkdownIntoSections(markdown, filename);
    console.log(`   ✓ Parsed into ${Object.keys(sections).length} sections`);
    
    // Extract variables
    const variables = extractVariables(sections);
    console.log(`   ✓ Found ${variables.length} variables:`, variables.join(', '));
    
    // Generate prompt name from filename
    const promptName = filename.replace('.md', '').replace(/([A-Z])/g, ' $1').trim();
    
    // Create prompt record
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .insert({
        name: promptName,
        description: `Migrated from ${filename}`,
        category: 'barbara',
        current_version: 1,
        is_base_prompt: filename === 'BarbaraRealtimePrompt.md', // Mark Barbara as base
        is_active: true
      })
      .select()
      .single();
    
    if (promptError) {
      // Check if already exists
      if (promptError.code === '23505') {
        console.log(`   ⚠️  Prompt "${promptName}" already exists, skipping...`);
        return { skipped: true };
      }
      throw promptError;
    }
    
    console.log(`   ✓ Created prompt: ${prompt.id}`);
    
    // Create version 1
    const { data: version, error: versionError } = await supabase
      .from('prompt_versions')
      .insert({
        prompt_id: prompt.id,
        version_number: 1,
        content: sections,
        variables: variables,
        change_summary: 'Initial migration from markdown file',
        is_active: true,
        is_draft: false,
        created_by: 'migration_script'
      })
      .select()
      .single();
    
    if (versionError) throw versionError;
    
    console.log(`   ✓ Created version 1: ${version.id}`);
    
    // Log deployment
    await supabase.from('prompt_deployments').insert({
      prompt_id: prompt.id,
      version_number: 1,
      deployed_by: 'migration_script',
      deployment_reason: 'Initial migration from markdown',
      status: 'deployed'
    });
    
    // Log audit trail
    await supabase.from('prompt_audit_log').insert({
      prompt_id: prompt.id,
      version_number: 1,
      action: 'created',
      performed_by: 'migration_script',
      change_details: {
        source: 'migration',
        filename: filename,
        sections: Object.keys(sections),
        variables: variables
      }
    });
    
    console.log(`   ✅ Successfully migrated: ${promptName}`);
    
    return { success: true, prompt, version };
    
  } catch (error) {
    console.error(`   ❌ Error migrating ${filename}:`, error.message);
    return { error: error.message };
  }
}

/**
 * Main migration function
 */
async function migrateAllPrompts() {
  console.log('🚀 Starting Prompt Migration to Database\n');
  console.log('=' .repeat(60));
  
  const promptsDir = path.join(__dirname, '../prompts');
  
  // Check if directory exists
  if (!fs.existsSync(promptsDir)) {
    console.error(`❌ Prompts directory not found: ${promptsDir}`);
    process.exit(1);
  }
  
  // Get all .md files (excluding Archived)
  const files = fs.readdirSync(promptsDir)
    .filter(file => file.endsWith('.md'))
    .filter(file => !file.toLowerCase().includes('archived'));
  
  console.log(`\nFound ${files.length} prompt files to migrate:\n`);
  files.forEach((file, i) => console.log(`  ${i + 1}. ${file}`));
  
  const results = {
    success: 0,
    skipped: 0,
    failed: 0,
    total: files.length
  };
  
  // Migrate each file
  for (const file of files) {
    const filepath = path.join(promptsDir, file);
    const result = await migratePromptFile(filepath, file);
    
    if (result.success) results.success++;
    else if (result.skipped) results.skipped++;
    else if (result.error) results.failed++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary:\n');
  console.log(`   Total files:     ${results.total}`);
  console.log(`   ✅ Migrated:     ${results.success}`);
  console.log(`   ⚠️  Skipped:      ${results.skipped}`);
  console.log(`   ❌ Failed:       ${results.failed}`);
  console.log('\n' + '='.repeat(60));
  
  // Check base prompt
  const { data: basePrompt } = await supabase
    .from('prompts')
    .select('name')
    .eq('is_base_prompt', true)
    .single();
  
  if (basePrompt) {
    console.log(`\n🌟 Base/Default Prompt: "${basePrompt.name}"`);
  }
  
  console.log('\n✅ Migration complete!\n');
}

// Run migration
migrateAllPrompts().catch(error => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});

