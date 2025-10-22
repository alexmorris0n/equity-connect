/**
 * Generate embeddings for knowledge base content
 * This script can be run in production (Northflank) to populate embeddings
 */

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

async function generateKnowledgeBaseEmbeddings() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    console.error('This script should be run in production (Northflank) where env vars are configured');
    return;
  }
  
  if (!openaiKey) {
    console.error('❌ Missing OPENAI_API_KEY');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🔧 Generating embeddings for knowledge base content...\n');
  
  try {
    // Get all knowledge base content without embeddings
    const { data: content, error: fetchError } = await supabase
      .from('vector_embeddings')
      .select('id, content')
      .eq('content_type', 'reverse_mortgage_kb')
      .is('embedding', null);
    
    if (fetchError) {
      console.error('❌ Error fetching content:', fetchError.message);
      return;
    }
    
    if (!content || content.length === 0) {
      console.log('✅ All knowledge base content already has embeddings!');
      return;
    }
    
    console.log(`📝 Found ${content.length} pieces of content to embed\n`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < content.length; i++) {
      const item = content[i];
      const preview = item.content.substring(0, 60);
      console.log(`${i + 1}/${content.length} Processing: ${preview}...`);
      
      try {
        // Get embedding from OpenAI
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: item.content
          })
        });
        
        if (!embeddingResponse.ok) {
          const errorText = await embeddingResponse.text();
          console.error(`  ❌ OpenAI API failed (${embeddingResponse.status}):`, errorText);
          failCount++;
          continue;
        }
        
        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;
        
        // Update the record with the embedding
        const { error: updateError } = await supabase
          .from('vector_embeddings')
          .update({ 
            embedding: embedding,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);
        
        if (updateError) {
          console.error(`  ❌ Database update failed:`, updateError.message);
          failCount++;
          continue;
        }
        
        console.log(`  ✅ Embedded successfully`);
        successCount++;
        
        // Small delay to avoid rate limits (100ms between requests)
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`  ❌ Error:`, error.message);
        failCount++;
      }
    }
    
    console.log('\n🎯 Embedding Generation Complete!');
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    
    if (successCount > 0) {
      console.log('\n🧪 Testing knowledge base search...');
      
      const testQuestion = "What if they still have a mortgage?";
      console.log(`Question: "${testQuestion}"`);
      
      // Get embedding for test question
      const questionEmbeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: testQuestion
        })
      });
      
      if (!questionEmbeddingResponse.ok) {
        console.error('❌ Failed to get question embedding');
        return;
      }
      
      const questionEmbeddingData = await questionEmbeddingResponse.json();
      const questionEmbedding = questionEmbeddingData.data[0].embedding;
      
      // Search knowledge base
      const { data: searchResults, error: searchError } = await supabase.rpc('find_similar_content', {
        query_embedding: questionEmbedding,
        content_type_filter: 'reverse_mortgage_kb',
        match_threshold: 0.7,
        match_count: 3
      });
      
      if (searchError) {
        console.error('❌ Search error:', searchError.message);
        return;
      }
      
      console.log(`✅ Found ${searchResults.length} relevant results\n`);
      
      if (searchResults.length > 0) {
        console.log('📚 Top Results:');
        searchResults.forEach((result, index) => {
          console.log(`\n${index + 1}. Similarity: ${Math.round(result.similarity * 100)}%`);
          console.log(`   ${result.content.substring(0, 150)}...`);
        });
      }
      
      console.log('\n✅ Knowledge base is now fully functional!');
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error(error.stack);
  }
}

// Run if called directly
if (require.main === module) {
  generateKnowledgeBaseEmbeddings()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { generateKnowledgeBaseEmbeddings };
