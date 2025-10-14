# Simple Knowledge Base Upload to Vector Store

**Recommended Method**: Copy-paste approach using n8n Code node

---

## 🚀 n8n Workflow Setup

### **Nodes**:
1. Manual Trigger
2. Code Node - Prepare KB Documents
3. HTTP Request - OpenAI Embeddings
4. HTTP Request - Supabase Insert

---

## 📋 Node 1: Manual Trigger
Just click to start.

---

## 📋 Node 2: Code Node - Prepare Documents

```javascript
// REVERSE MORTGAGE KNOWLEDGE BASE DOCUMENTS
// Copy each section content from your markdown files

const kbDocuments = [
  {
    section: 'section_1',
    title: 'Eligibility, Program Mechanics & Core Facts',
    content: `# 🏠 Reverse Mortgage Knowledge Base
## **Section 1 — Eligibility, Program Mechanics & Core Facts**

[PASTE FULL CONTENT OF reverse_mortgage_kb_section_1.md HERE]`
  },
  {
    section: 'section_2',
    title: 'Emotional Psychology & Rapport Building',
    content: `# 💬 Reverse Mortgage Knowledge Base
## **Section 2 — Emotional Psychology & Rapport Building**

[PASTE FULL CONTENT OF reverse_mortgage_kb_section_2.md HERE]`
  },
  {
    section: 'section_3',
    title: 'Objections, FAQs & Compliance Guardrails',
    content: `# 🛡️ Reverse Mortgage Knowledge Base
## **Section 3 — Objections, FAQs & Compliance Guardrails**

[PASTE FULL CONTENT OF reverse_mortgage_kb_section_3.md HERE]`
  },
  {
    section: 'section_4',
    title: 'Appointment Flow & Archetype Integration',
    content: `# 📞 Reverse Mortgage Knowledge Base
## **Section 4 — Appointment Flow & Archetype Integration**

[PASTE FULL CONTENT OF reverse_mortgage_kb_section_4.md HERE]`
  }
];

// Split each section into semantic chunks by ### headers
const allChunks = [];

kbDocuments.forEach(doc => {
  // Split by ### headings (semantic sections)
  const chunks = doc.content.split(/(?=###\s)/);
  
  chunks.forEach((chunk, index) => {
    const cleanChunk = chunk.trim();
    
    // Only process chunks with substantial content
    if (cleanChunk.length > 100) {
      // Extract heading for metadata
      const headingMatch = cleanChunk.match(/###\s+(.+?)(?:\n|$)/);
      const heading = headingMatch ? headingMatch[1].trim() : `${doc.title} - Part ${index + 1}`;
      
      allChunks.push({
        pageContent: cleanChunk,
        section: doc.section,
        section_title: doc.title,
        chunk_heading: heading,
        chunk_index: index
      });
    }
  });
});

console.log(`✅ Prepared ${allChunks.length} KB chunks for embedding`);

// Return as separate items for n8n
return allChunks.map(chunk => ({ json: chunk }));
```

---

## 📋 Node 3: HTTP Request - Generate Embeddings

**Method**: POST  
**URL**: `https://api.openai.com/v1/embeddings`

**Authentication**: Bearer Token
- **Header Name**: `Authorization`
- **Header Value**: `Bearer {{$credentials.openAiApi.apiKey}}`

**Headers**:
```json
{
  "Content-Type": "application/json"
}
```

**Body** (JSON):
```json
{
  "model": "text-embedding-ada-002",
  "input": "={{$json.pageContent}}"
}
```

**After this node, add a Code node to extract embedding**:

```javascript
const input = $input.first().json;
const originalData = $('Code').item.json; // Get original data

return [{
  json: {
    pageContent: originalData.pageContent,
    embedding: input.data[0].embedding,
    section: originalData.section,
    section_title: originalData.section_title,
    chunk_heading: originalData.chunk_heading,
    chunk_index: originalData.chunk_index
  }
}];
```

---

## 📋 Node 4: HTTP Request - Insert to Supabase

**Method**: POST  
**URL**: `https://mxnqfwuhvurajrgoefyg.supabase.co/rest/v1/vector_embeddings`

**Authentication**: Header Auth
- **Header Name**: `apikey`
- **Header Value**: `{{$credentials.supabaseApi.serviceRole}}`
- **Also add**: `Authorization: Bearer {{$credentials.supabaseApi.serviceRole}}`

**Headers**:
```json
{
  "Content-Type": "application/json",
  "Prefer": "return=minimal"
}
```

**Body** (JSON):
```json
{
  "content_type": "reverse_mortgage_kb",
  "content_text": "={{$json.pageContent}}",
  "embedding": "={{$json.embedding}}",
  "metadata": {
    "section": "={{$json.section}}",
    "section_title": "={{$json.section_title}}",
    "chunk_heading": "={{$json.chunk_heading}}",
    "chunk_index": "={{$json.chunk_index}}",
    "source": "barbara_knowledge_base",
    "created_at": "={{new Date().toISOString()}}"
  }
}
```

---

## 📋 Final Node: Summary

```javascript
const items = $input.all();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Knowledge Base Upload Complete');
console.log(`Total chunks uploaded: ${items.length}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Group by section
const bySection = {};
items.forEach(item => {
  const section = item.json.section || 'unknown';
  bySection[section] = (bySection[section] || 0) + 1;
});

console.log('Chunks per section:');
Object.entries(bySection).forEach(([section, count]) => {
  console.log(`  ${section}: ${count} chunks`);
});

return [{
  json: {
    success: true,
    total_chunks: items.length,
    by_section: bySection,
    timestamp: new Date().toISOString()
  }
}];
```

---

## 🎯 Even Simpler: Use LangChain Nodes (If Available)

If your n8n has LangChain nodes installed:

### **Workflow**:
1. **Manual Trigger**
2. **Read Binary Files** node → Point to your `/docs/REVERSE_MORTGAGE_VECTOR_DATABASE/` folder
3. **Extract from File** node → Extract text from .md files
4. **Markdown Text Splitter** (LangChain) → Chunk by headers
5. **OpenAI Embeddings** (LangChain) → Auto-generate embeddings
6. **Supabase Vector Store** (LangChain) → Insert operation

### **LangChain Settings**:

**Markdown Text Splitter**:
- **Chunk Size**: 1000
- **Chunk Overlap**: 200
- **Split by**: Headers (`###`)

**Supabase Vector Store**:
- **Operation**: Insert Documents
- **Table Name**: `vector_embeddings`
- **Content Column**: `content_text`
- **Embedding Column**: `embedding`
- **Metadata Column**: `metadata`

---

## 💡 Easiest Method: Single Code Node Upload

If you just want to get it done quickly:

```javascript
const { Configuration, OpenAIApi } = require('openai');
const { createClient } = require('@supabase/supabase-js');

// Initialize
const openai = new OpenAIApi(new Configuration({
  apiKey: 'YOUR_OPENAI_KEY'
}));

const supabase = createClient(
  'https://mxnqfwuhvurajrgoefyg.supabase.co',
  'YOUR_SERVICE_ROLE_KEY'
);

// Your KB documents (paste full content)
const kbSections = [
  {
    section: 'section_1',
    title: 'Eligibility & Mechanics',
    content: `[PASTE SECTION 1 HERE]`
  },
  {
    section: 'section_2',
    title: 'Psychology & Rapport',
    content: `[PASTE SECTION 2 HERE]`
  },
  {
    section: 'section_3',
    title: 'Objections & FAQs',
    content: `[PASTE SECTION 3 HERE]`
  },
  {
    section: 'section_4',
    title: 'Appointment Flow',
    content: `[PASTE SECTION 4 HERE]`
  }
];

const results = [];

// Process each section
for (const section of kbSections) {
  // Split by ### headers
  const chunks = section.content.split(/(?=###\s)/).filter(c => c.trim().length > 100);
  
  console.log(`Processing ${section.section}: ${chunks.length} chunks`);
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i].trim();
    
    // Generate embedding
    const embeddingResponse = await openai.createEmbedding({
      model: 'text-embedding-ada-002',
      input: chunk
    });
    
    const embedding = embeddingResponse.data.data[0].embedding;
    
    // Extract heading
    const headingMatch = chunk.match(/###\s+(.+?)(?:\n|$)/);
    const heading = headingMatch ? headingMatch[1].trim() : `Chunk ${i + 1}`;
    
    // Insert to Supabase
    const { data, error } = await supabase
      .from('vector_embeddings')
      .insert({
        content_type: 'reverse_mortgage_kb',
        content_text: chunk,
        embedding: embedding,
        metadata: {
          section: section.section,
          section_title: section.title,
          chunk_heading: heading,
          chunk_index: i,
          source: 'barbara_kb',
          created_at: new Date().toISOString()
        }
      });
    
    if (error) {
      console.error(`Error: ${heading}`, error);
      results.push({ heading, status: 'error', error: error.message });
    } else {
      console.log(`✅ ${heading}`);
      results.push({ heading, status: 'success' });
    }
    
    // Rate limit pause (OpenAI has limits)
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

console.log(`\n✅ Upload complete: ${results.filter(r => r.status === 'success').length} chunks`);

return results.map(r => ({ json: r }));
```

---

## 📊 Expected Results

You should get approximately **60-80 chunks** total:
- Section 1: ~20 chunks (eligibility, mechanics)
- Section 2: ~15 chunks (psychology, rapport)
- Section 3: ~25 chunks (objections, FAQs)
- Section 4: ~20 chunks (appointment flow)

Each chunk will be searchable by Barbara when she needs specific information!

---

## 🔍 Test Your Upload

After uploading, test with a query:

```sql
SELECT 
  metadata->>'chunk_heading' as heading,
  metadata->>'section' as section,
  substring(content_text, 1, 200) as preview
FROM vector_embeddings
WHERE content_type = 'reverse_mortgage_kb'
ORDER BY created_at DESC
LIMIT 20;
```

---

**Which method do you want to use?**
1. Simple HTTP requests (most reliable)
2. LangChain nodes (if available)
3. Single code node (fastest)

