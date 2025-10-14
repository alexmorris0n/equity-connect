# Vector Store Usage Guide

**Setup Date**: 2025-10-13  
**Status**: ✅ Active in Production  
**Extension**: pgvector v0.8.0  
**Project**: Equity Connect (Supabase)

---

## 🎯 What's Installed

Your Supabase database now has:

1. **pgvector extension** enabled (v0.8.0)
2. **`vector_embeddings` table** with 1536-dimensional vectors
3. **HNSW index** for fast similarity search
4. **4 helper functions** for common AI operations
5. **Row-level security** policies for data protection

---

## 📊 Table Structure: `vector_embeddings`

```sql
CREATE TABLE vector_embeddings (
  id UUID PRIMARY KEY,
  
  -- What type of content is this?
  content_type TEXT CHECK (content_type IN (
    'lead_profile',           -- Lead demographics & behavior
    'email_reply',            -- Email responses from leads
    'interaction_transcript', -- Call transcripts
    'property_description',   -- Property details
    'neighborhood_info',      -- Neighborhood data
    'persona_profile',        -- Persona characteristics
    'email_template'          -- Email template content
  )),
  
  -- Link to your existing data
  lead_id UUID REFERENCES leads(id),
  interaction_id UUID REFERENCES interactions(id),
  
  -- The actual content
  content_text TEXT,          -- Original text
  metadata JSONB,             -- Extra info (sentiment, keywords, etc.)
  
  -- The AI embedding (1536 dimensions for OpenAI ada-002)
  embedding vector(1536),
  
  -- Timestamps
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

---

## 🚀 How to Use It

### 1. **Store a Lead Profile Embedding**

```javascript
// In your n8n workflow or API call
const response = await fetch('https://api.openai.com/v1/embeddings', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${openai_api_key}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'text-embedding-ada-002',
    input: `${lead.first_name} ${lead.last_name}, age ${lead.age}, 
            ${lead.property_city}, ${lead.property_state}, 
            equity: ${lead.estimated_equity}, score: ${lead.lead_score}`
  })
});

const embedding = await response.json();

// Store in Supabase
await supabase.from('vector_embeddings').insert({
  content_type: 'lead_profile',
  lead_id: lead.id,
  content_text: `Lead profile for ${lead.first_name} ${lead.last_name}`,
  embedding: embedding.data[0].embedding,
  metadata: {
    age: lead.age,
    city: lead.property_city,
    lead_score: lead.lead_score
  }
});
```

### 2. **Find Similar Leads**

```sql
-- Find 20 leads similar to lead ID 'abc-123-def'
SELECT * FROM find_similar_leads(
  'abc-123-def',  -- target_lead_id
  0.75,           -- match_threshold (75% similarity)
  20              -- match_count
);

-- Returns:
-- similar_lead_id | similarity | lead_data (JSONB with name, city, score, etc.)
```

### 3. **Analyze Email Reply Sentiment**

```javascript
// When a lead replies to an email
const replyText = "Yes, I'm interested in learning more about this!";

// Get embedding
const embedding = await getOpenAIEmbedding(replyText);

// Store the reply
await supabase.from('vector_embeddings').insert({
  content_type: 'email_reply',
  lead_id: lead.id,
  interaction_id: interaction.id,
  content_text: replyText,
  embedding: embedding,
  metadata: {
    detected_sentiment: 'positive',
    keywords: ['interested', 'learning more']
  }
});

// Find similar past replies
const { data } = await supabase.rpc('analyze_reply_similarity', {
  reply_embedding: embedding,
  match_count: 5
});

// Returns similar replies with their sentiment metadata
```

### 4. **AI-Powered Persona Assignment**

```sql
-- First, create persona profile embeddings (one-time setup)
-- For each persona (Carlos, Maria, Rahul, etc.), create an embedding
-- describing their characteristics, target demographics, etc.

-- Then, for any new lead, find the best matching persona
SELECT * FROM suggest_best_persona(
  'lead-uuid-here',  -- target_lead_id
  3                  -- return top 3 matches
);

-- Returns:
-- persona_name | similarity | reasoning
```

### 5. **General Similarity Search**

```sql
-- Find any content similar to a query embedding
SELECT * FROM find_similar_content(
  query_embedding,           -- vector(1536)
  'email_reply',            -- filter by content_type (optional)
  0.7,                      -- match_threshold
  10                        -- match_count
);
```

---

## 🔧 Available Helper Functions

### 1. `find_similar_content()`
General-purpose similarity search across all content types.

**Parameters:**
- `query_embedding` vector(1536) - The embedding to search for
- `content_type_filter` TEXT - Optional filter (e.g., 'email_reply')
- `match_threshold` FLOAT - Minimum similarity (0.0 to 1.0)
- `match_count` INT - Max results to return

### 2. `find_similar_leads()`
Find leads with similar profiles/characteristics.

**Parameters:**
- `target_lead_id` UUID - Lead to find matches for
- `match_threshold` FLOAT - Minimum similarity (default 0.75)
- `match_count` INT - Max results (default 20)

### 3. `analyze_reply_similarity()`
Find similar past email replies to understand sentiment patterns.

**Parameters:**
- `reply_embedding` vector(1536) - Embedding of the reply text
- `match_count` INT - Max results (default 5)

### 4. `suggest_best_persona()`
AI-powered persona recommendation based on lead profile.

**Parameters:**
- `target_lead_id` UUID - Lead to assign persona to
- `match_count` INT - Top N persona matches (default 3)

---

## 💡 Use Cases for Your Business

### 1. **Smart Lead Routing**
```
Store embeddings of past successful conversions → 
When new lead comes in → 
Find most similar successful leads → 
Route to same broker/use same approach
```

### 2. **Email Reply Classification**
```
Store all positive/negative reply embeddings → 
When new reply comes in → 
Instantly classify sentiment → 
Auto-escalate positive replies to brokers
```

### 3. **Persona Optimization**
```
Create embeddings for each persona's ideal lead profile → 
For each new lead → 
Find best matching persona automatically → 
Better than simple demographic rules
```

### 4. **Content Recommendations**
```
Store neighborhood descriptions, property types → 
Based on lead's property → 
Recommend similar success stories → 
Include in email templates
```

### 5. **Duplicate Detection**
```
Beyond address matching → 
Find leads with nearly identical profiles → 
Even if different addresses → 
Catch move-ins, relatives, etc.
```

---

## 📝 Example n8n Integration

### Workflow: "Store Lead Embedding on New Lead"

1. **Trigger**: New lead inserted into `leads` table
2. **OpenAI Node**: Generate embedding
   ```
   Model: text-embedding-ada-002
   Input: Concatenate lead profile fields
   ```
3. **Supabase Insert**: Store in `vector_embeddings`
   ```json
   {
     "content_type": "lead_profile",
     "lead_id": "{{$json.id}}",
     "content_text": "{{$json.profile_summary}}",
     "embedding": "{{$json.embedding}}",
     "metadata": {
       "age": "{{$json.age}}",
       "score": "{{$json.lead_score}}"
     }
   }
   ```

### Workflow: "Find Similar Successful Leads"

1. **Trigger**: Lead reaches "qualified" status
2. **Supabase Function**: Call `find_similar_leads()`
3. **Filter**: Only leads where status = 'funded'
4. **HTTP Request**: Send analysis to broker via SMS/email

---

## 🔒 Security Notes

- **RLS Enabled**: Brokers can only see embeddings for their assigned leads
- **Service Role Access**: Your n8n workflows have full access
- **Auto-cleanup**: No cleanup currently configured (add if needed)

---

## 📊 Performance

- **Index Type**: HNSW (Hierarchical Navigable Small World)
  - Fast approximate nearest neighbor search
  - Good for 100K+ vectors
  - ~10-50ms query time at scale

- **Vector Dimensions**: 1536 (OpenAI ada-002 standard)
  - If using different model, adjust table schema
  - Change: `ALTER TABLE vector_embeddings ALTER COLUMN embedding TYPE vector(YOUR_SIZE)`

---

## 🚨 Important Notes

1. **Always use the same embedding model** for consistency
   - Recommended: `text-embedding-ada-002` ($0.0001 per 1K tokens)
   - Never mix different models in the same table

2. **Cost consideration**: 
   - Each embedding call costs ~$0.0001
   - For 10K leads = ~$1.00
   - Budget accordingly for your scale

3. **Bulk operations**:
   - OpenAI allows up to 2,048 inputs per request
   - Batch your embedding requests for efficiency

4. **Metadata is your friend**:
   - Store extra context in the `metadata` JSONB field
   - Makes filtering and analysis much easier

---

## 🎓 Next Steps

1. **Create persona profile embeddings** (one-time)
   - Describe each persona's ideal lead
   - Store as `content_type = 'persona_profile'`

2. **Backfill existing leads** (optional)
   - Generate embeddings for your 524 existing leads
   - Enables similarity search immediately

3. **Add to enrichment workflow**
   - After skip-trace completes
   - Generate and store lead embedding
   - Use for instant persona matching

4. **Set up reply analysis**
   - In your Instantly webhook handler
   - Generate embedding of each reply
   - Auto-classify and route

---

## 📚 Additional Resources

- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [Supabase Vector Guide](https://supabase.com/docs/guides/ai/vector-columns)

---

**Questions?** Check the migration that was applied:
- Migration name: `enable_pgvector_and_create_vector_store`
- Applied: 2025-10-13
- All functions and indexes included

