# Test Your Vector Search

Your KB is now live with 80 searchable chunks! Here's how to test it.

---

## 🧪 Quick Test in Supabase SQL Editor

### Test 1: Check the data
```sql
SELECT 
  COUNT(*) as total_chunks,
  AVG(LENGTH(content)) as avg_chunk_size,
  MIN(LENGTH(content)) as min_size,
  MAX(LENGTH(content)) as max_size
FROM vector_embeddings
WHERE content_type = 'reverse_mortgage_kb';
```

**Expected**: 80 chunks, ~750 char average

---

### Test 2: See sample content
```sql
SELECT 
  substring(content, 1, 200) as preview
FROM vector_embeddings
WHERE content_type = 'reverse_mortgage_kb'
  AND content ILIKE '%eligibility%'
LIMIT 5;
```

**Should show**: Eligibility requirements and qualification criteria

---

### Test 3: Find {{broker_name}} placeholders
```sql
SELECT 
  COUNT(*) as chunks_with_broker_placeholder
FROM vector_embeddings
WHERE content_type = 'reverse_mortgage_kb'
  AND content LIKE '%{{broker_name}}%';
```

**Expected**: Multiple chunks (should be broker-agnostic)

---

## 🔍 Test Semantic Search (n8n Workflow)

Create a simple workflow to test vector search:

### Nodes:
1. **Manual Trigger**
2. **Code Node** - Prepare test question
3. **HTTP Request** - OpenAI Embeddings
4. **Supabase Vector Store** - Mode: "Get Many"
5. **Code Node** - Display results

### Code Node 1 (Test Question):
```javascript
return [{
  json: {
    question: "What are the eligibility requirements for reverse mortgage?"
  }
}];
```

### HTTP Request (OpenAI):
```
POST https://api.openai.com/v1/embeddings
Authorization: Bearer YOUR_KEY

Body:
{
  "model": "text-embedding-ada-002",
  "input": "{{ $json.question }}"
}
```

### Supabase Vector Store:
- Mode: **Get Many**
- Table: `vector_embeddings`
- Prompt: `{{ $json.question }}`
- Limit: 5

### Code Node 2 (Results):
```javascript
const results = $input.all();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔍 Vector Search Results');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━');

results.forEach((result, index) => {
  console.log(`\n${index + 1}. ${result.json.content.substring(0, 200)}...`);
});

return results;
```

---

## 🎯 Test Questions to Try

1. **"What are the eligibility requirements for reverse mortgage?"**
   - Should return chunks about age, residence, equity, etc.

2. **"Can I get a reverse mortgage if I still owe on my home?"**
   - Should return chunks about mortgage status and eligibility

3. **"What if the caller doesn't want to lose their home?"**
   - Should return objection handling for home loss myth

4. **"How should Barbara handle an angry caller?"**
   - Should return the aggressive caller handling section

5. **"What are the costs and fees?"**
   - Should return the costs & fees section

---

## 🎓 Next Steps: Connect to Barbara

### In Your VAPI/Voice Agent:

When a caller asks a question:

1. **Generate embedding** of the question:
   ```javascript
   const questionEmbedding = await openai.embeddings.create({
     model: 'text-embedding-ada-002',
     input: callerQuestion
   });
   ```

2. **Search vector store**:
   ```javascript
   const { data } = await supabase.rpc('find_similar_content', {
     query_embedding: questionEmbedding.data[0].embedding,
     content_type_filter: 'reverse_mortgage_kb',
     match_threshold: 0.7,
     match_count: 3
   });
   ```

3. **Replace {{broker_name}}**:
   ```javascript
   const kbContext = data
     .map(r => r.content_text)
     .join('\n\n')
     .replace(/\{\{broker_name\}\}/g, lead.assigned_broker_name);
   ```

4. **Add to Barbara's prompt**:
   ```javascript
   const systemPrompt = `You are Barbara, a pre-qualification specialist...

Knowledge Base Context:
${kbContext}

Use the knowledge base to answer the caller's question accurately and compliantly.`;
   ```

---

## 📊 Your Vector Store Stats

- **Total chunks**: 80 ✅
- **Content type**: `reverse_mortgage_kb` ✅
- **Avg chunk size**: ~750 characters ✅
- **Searchable topics**: All sections ✅
- **Broker-agnostic**: {{broker_name}} variables ✅
- **Objection handling**: Included ✅

---

## 🎉 You're Ready!

Barbara can now answer:
- ✅ Any reverse mortgage eligibility question
- ✅ Objection handling
- ✅ Costs and fees questions
- ✅ Compliance-approved language
- ✅ With broker-specific names dynamically inserted

**Your KB is live!** 🚀

