# Knowledge Base Upload - Quick Start

**Goal**: Upload your 4 reverse mortgage KB sections to vector store for Barbara (AI voice agent)

---

## ✅ What You Have

📁 **Files**:
- `reverse_mortgage_kb_section_1.md` (12KB - Eligibility & Mechanics)
- `reverse_mortgage_kb_section_2.md` (12KB - Psychology & Rapport)
- `reverse_mortgage_kb_section_3.md` (13KB - Objections & FAQs)
- `reverse_mortgage_kb_section_4.md` (20KB - Appointment Flow)

---

## 🚀 Fastest Method: n8n Import

### Step 1: Import Workflow
1. Open n8n
2. Go to **Workflows** → **Import from File**
3. Import: `workflows-to-build/kb-vector-upload-langchain.json`

### Step 2: Edit the "Load KB Files" Node
Open the Code node and you'll see two options:

**Option A - If file paths work** (they might not in n8n cloud):
```javascript
const docsPath = 'C:/Users/alex/OneDrive/Desktop/Cursor/equity-connect/docs/REVERSE_MORTGAGE_VECTOR_DATABASE';
```
✅ If this works, you're done! Skip to Step 3.

**Option B - Paste content directly** (more reliable):
Replace the embedded content section with your actual file content:
```javascript
return [
  {
    json: {
      content: `[PASTE ENTIRE reverse_mortgage_kb_section_1.md HERE]`,
      section: 'section_1',
      filename: 'section_1.md'
    }
  },
  {
    json: {
      content: `[PASTE ENTIRE reverse_mortgage_kb_section_2.md HERE]`,
      section: 'section_2',
      filename: 'section_2.md'
    }
  },
  // ... sections 3 and 4
];
```

### Step 3: Configure Credentials
Make sure you have:
- ✅ **OpenAI API** credentials configured
- ✅ **Supabase Service Role** key configured (not just anon key!)

### Step 4: Run It!
Click **Execute Workflow**

**Expected Output**:
```
✅ Knowledge Base Upload Complete
Total chunks processed: 60-80
Successful: 60-80
Failed: 0
```

---

## 🎯 Alternative: Simple HTTP Method (No LangChain)

If LangChain nodes aren't working, here's a dead-simple workflow:

### Workflow:
1. **Manual Trigger**
2. **Code Node** → Prepare documents (see `SIMPLE_KB_UPLOAD_GUIDE.md`)
3. **HTTP Request** → OpenAI embeddings API
4. **HTTP Request** → Supabase insert

---

## 📊 Verify Upload

After upload, run this in Supabase SQL Editor:

```sql
-- Check upload
SELECT 
  count(*) as total_chunks,
  metadata->>'section' as section
FROM vector_embeddings
WHERE content_type = 'reverse_mortgage_kb'
GROUP BY metadata->>'section'
ORDER BY section;
```

**Expected Result**:
```
total_chunks | section
-------------|----------
    ~20      | section_1
    ~15      | section_2
    ~25      | section_3
    ~20      | section_4
```

---

## 🔍 Test Barbara Can Find Info

Try a semantic search:

```sql
-- First, generate an embedding for a test query using OpenAI
-- Then run this (replace YOUR_QUERY_EMBEDDING with actual embedding):

SELECT 
  metadata->>'chunk_heading' as heading,
  metadata->>'section' as section,
  substring(content_text, 1, 150) as preview,
  1 - (embedding <=> '[YOUR_QUERY_EMBEDDING]') as similarity
FROM vector_embeddings
WHERE content_type = 'reverse_mortgage_kb'
ORDER BY embedding <=> '[YOUR_QUERY_EMBEDDING]'
LIMIT 5;
```

Or use the helper function:

```sql
-- This requires you to pass an embedding vector
SELECT * FROM find_similar_content(
  '[QUERY_EMBEDDING]'::vector(1536),
  'reverse_mortgage_kb',
  0.7,
  10
);
```

---

## 🎓 Next Steps After Upload

1. **Update Barbara's VAPI prompt** to include:
   ```
   When answering questions about reverse mortgages, you have access to 
   a comprehensive knowledge base. Search the knowledge base before answering 
   to ensure accuracy and compliance.
   ```

2. **Add RAG retrieval** to your Barbara workflow:
   - User asks question
   - Generate embedding of question
   - Search vector store for relevant KB chunks
   - Include top 3-5 chunks in Barbara's context
   - Barbara answers using KB content

3. **Test common questions**:
   - "What are the eligibility requirements?"
   - "Will I lose my home?"
   - "How much can I get?"
   - "What if my kids lose the house?"

---

## 💡 Pro Tips

1. **Chunking Strategy**: Documents are split by `###` headers automatically
   - Each header becomes a searchable chunk
   - Typical chunk size: 200-500 words
   - Perfect for semantic search

2. **Cost Estimate**:
   - ~70 chunks × $0.0001 per embedding = **$0.007 total**
   - One-time cost, embeddings stored forever

3. **Updates**: When KB content changes:
   - Delete old chunks: `DELETE FROM vector_embeddings WHERE content_type = 'reverse_mortgage_kb'`
   - Re-run upload workflow
   - Or update specific chunks individually

4. **Performance**: 
   - First upload takes 2-3 minutes
   - 70 OpenAI API calls (rate limited)
   - 70 Supabase inserts

---

## 🚨 Troubleshooting

**"OpenAI rate limit error"**:
- Add delay between requests (200ms)
- Or use batch embeddings (up to 2048 inputs)

**"Supabase insert failed"**:
- Check you're using **Service Role** key (not anon key)
- Verify table exists: `SELECT * FROM vector_embeddings LIMIT 1`
- Check embedding dimensions match (1536)

**"No chunks created"**:
- Verify content is pasted correctly
- Check `###` headers exist in markdown
- Look at console logs for chunk count

**"Can't read files from disk"**:
- Use Option B (paste content directly)
- n8n cloud doesn't have file system access

---

## 📞 Support

If you get stuck:
1. Check the detailed guide: `SIMPLE_KB_UPLOAD_GUIDE.md`
2. Review n8n execution logs
3. Test Supabase connection with simple query
4. Verify OpenAI API key works

---

**Ready to go?** Just import the workflow and click Execute! 🚀

