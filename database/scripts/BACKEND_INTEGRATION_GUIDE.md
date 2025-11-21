# Step Criteria Auto-Generation - Backend Integration Guide

## Overview

This guide shows how to integrate automatic step_criteria generation into your backend API.

**What it does:**
1. Detects which nodes have changed `step_criteria_source`
2. Auto-generates `step_criteria_sw` and `step_criteria_lk`
3. Uses smart fallbacks (mini → full → manual)
4. Returns detailed report for frontend modal

---

## Architecture

```
Vue Frontend
    ↓ (saves vertical)
FastAPI/Flask Backend
    ↓ (calls StepCriteriaGenerator)
Model Selector
    ↓ (tries mini → full → manual)
OpenAI API
    ↓ (returns generated criteria)
Database
    ↓ (saves all three fields)
Frontend Modal
    (shows generation report)
```

---

## Files Created

```
database/scripts/
├── backend_integration.py          # Main integration module
├── model_selector.py               # Smart model selection
├── prompts/
│   ├── extraction_prompt.py        # Phase 1: Clean input
│   ├── signalwire_prompt.py        # Phase 2: SW conversion
│   ├── livekit_prompt.py           # Phase 3: LK conversion
│   └── fallbacks.py                # Manual fallbacks
└── vue_components/
    └── GenerationReportModal.vue   # Dark mode modal
```

---

## Quick Start

### 1. Install Dependencies

```bash
pip install openai supabase
```

### 2. Set Environment Variables

```bash
export OPENAI_API_KEY="sk-..."
export SUPABASE_URL="https://..."
export SUPABASE_KEY="..."
```

### 3. Import in Your API

```python
from database.scripts.backend_integration import StepCriteriaGenerator
from openai import OpenAI

# Initialize
openai_client = OpenAI()
generator = StepCriteriaGenerator(openai_client, supabase_client)

# In your save endpoint
generation_report = await generator.process_vertical_save(
    nodes=request_data['nodes'],
    vertical='reverse_mortgage'
)
```

---

## FastAPI Integration (Recommended)

### File: `api/routes/verticals.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAI
from supabase import create_client, Client
import os
import logging

from database.scripts.backend_integration import StepCriteriaGenerator

router = APIRouter()
logger = logging.getLogger(__name__)


# Dependency injection
def get_openai_client() -> OpenAI:
    """Get OpenAI client."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set")
    return OpenAI(api_key=api_key)


def get_supabase_client() -> Client:
    """Get Supabase client."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE credentials not set")
    return create_client(url, key)


@router.post("/api/verticals/{vertical}")
async def save_vertical(
    vertical: str,
    data: dict,
    openai_client: OpenAI = Depends(get_openai_client),
    supabase: Client = Depends(get_supabase_client)
):
    """
    Save vertical configuration with automatic step_criteria generation.
    
    Request body:
    {
        "nodes": [
            {
                "node_name": "greet",
                "step_criteria_source": "Complete after greeting and rapport",
                "prompt": "...",
                "tools": [...]
            },
            ...
        ],
        "stt_config": {...},
        "llm_config": {...},
        "tts_config": {...}
    }
    
    Response:
    {
        "success": true,
        "message": "Vertical saved successfully",
        "generation_report": {
            "nodes": [
                {
                    "node_name": "greet",
                    "sw_method": "mini",
                    "lk_method": "full",
                    "has_warning": true,
                    "warning_message": "LiveKit: Required GPT-4o for validation"
                }
            ],
            "stats": {
                "total_processed": 9,
                "mini_success": 7,
                "full_used": 2,
                "manual_used": 0,
                "cost_estimate": "$0.003"
            }
        }
    }
    """
    try:
        # Validate input
        if 'nodes' not in data:
            raise HTTPException(status_code=400, detail="Missing 'nodes' in request")
        
        # Initialize generator
        generator = StepCriteriaGenerator(openai_client, supabase)
        
        # Process nodes and auto-generate criteria
        logger.info(f"Processing {len(data['nodes'])} nodes for vertical: {vertical}")
        generation_report = await generator.process_vertical_save(
            nodes=data['nodes'],
            vertical=vertical
        )
        
        # Save to database
        # NOTE: The generator modifies data['nodes'] in-place,
        # adding step_criteria_sw and step_criteria_lk
        await save_vertical_to_database(supabase, vertical, data)
        
        logger.info(f"Vertical saved: {vertical}, processed {generation_report['stats']['total_processed']} nodes")
        
        # Return success with generation report
        return {
            "success": True,
            "message": "Vertical saved successfully",
            "generation_report": generation_report
        }
    
    except Exception as e:
        logger.error(f"Failed to save vertical {vertical}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


async def save_vertical_to_database(supabase: Client, vertical: str, data: dict):
    """
    Save vertical data to Supabase.
    
    This is your existing save logic. The generator has already
    updated data['nodes'] with generated step_criteria_sw and step_criteria_lk.
    """
    # Example implementation
    for node in data['nodes']:
        # Update prompt_versions table
        result = (
            supabase
            .table('prompt_versions')
            .update({
                'content': {
                    'node_name': node['node_name'],
                    'prompt': node.get('prompt'),
                    'tools': node.get('tools', []),
                    'step_criteria_source': node.get('step_criteria_source'),
                    'step_criteria_sw': node.get('step_criteria_sw'),
                    'step_criteria_lk': node.get('step_criteria_lk'),
                    'valid_contexts': node.get('valid_contexts', [])
                }
            })
            .eq('vertical', vertical)
            .eq('is_active', True)
            .execute()
        )
    
    # Save other vertical config (STT, LLM, TTS, etc.)
    # ... your existing logic ...
```

---

## Flask Integration (Alternative)

### File: `api/routes/verticals.py`

```python
from flask import Blueprint, request, jsonify
from openai import OpenAI
from supabase import create_client
import os
import logging
import asyncio

from database.scripts.backend_integration import StepCriteriaGenerator

verticals_bp = Blueprint('verticals', __name__)
logger = logging.getLogger(__name__)


@verticals_bp.route('/api/verticals/<vertical>', methods=['POST'])
def save_vertical(vertical):
    """
    Save vertical configuration with automatic step_criteria generation.
    """
    try:
        data = request.get_json()
        
        if 'nodes' not in data:
            return jsonify({"success": False, "error": "Missing 'nodes' in request"}), 400
        
        # Initialize clients
        openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        supabase = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_KEY")
        )
        
        # Initialize generator
        generator = StepCriteriaGenerator(openai_client, supabase)
        
        # Process nodes (needs async)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        generation_report = loop.run_until_complete(
            generator.process_vertical_save(
                nodes=data['nodes'],
                vertical=vertical
            )
        )
        loop.close()
        
        # Save to database
        save_vertical_to_database(supabase, vertical, data)
        
        logger.info(f"Vertical saved: {vertical}")
        
        return jsonify({
            "success": True,
            "message": "Vertical saved successfully",
            "generation_report": generation_report
        })
    
    except Exception as e:
        logger.error(f"Failed to save vertical: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500
```

---

## Frontend Integration

### Update Your Vue Component

```vue
<!-- VerticalSettings.vue -->

<template>
  <div class="vertical-settings">
    <!-- Your existing form fields -->
    
    <button @click="saveVertical" :disabled="saving">
      {{ saving ? 'Saving...' : 'Save Vertical' }}
    </button>
    
    <!-- Generation Report Modal (always shows on save) -->
    <GenerationReportModal
      :visible="showReportModal"
      :report="generationReport"
      @close="showReportModal = false"
    />
  </div>
</template>

<script>
import GenerationReportModal from '@/components/GenerationReportModal.vue'

export default {
  components: {
    GenerationReportModal
  },
  
  data() {
    return {
      nodes: [],
      saving: false,
      showReportModal: false,
      generationReport: null
    }
  },
  
  methods: {
    async saveVertical() {
      this.saving = true
      
      try {
        const response = await this.$api.post('/api/verticals/reverse_mortgage', {
          nodes: this.nodes,
          // ... other config
        })
        
        if (response.data.success) {
          // Show generation report modal (3a: always show)
          this.generationReport = response.data.generation_report
          this.showReportModal = true
          
          // Update node warnings (2b: tooltips)
          this.updateNodeWarnings(response.data.generation_report)
        }
      } catch (error) {
        this.$toast.error('Failed to save vertical')
        console.error(error)
      } finally {
        this.saving = false
      }
    },
    
    updateNodeWarnings(report) {
      // Update warning tooltips for each node
      report.nodes.forEach(nodeReport => {
        const node = this.nodes.find(n => n.node_name === nodeReport.node_name)
        if (node && nodeReport.has_warning) {
          node.generationWarning = nodeReport.warning_message
        } else if (node) {
          node.generationWarning = null
        }
      })
    }
  }
}
</script>
```

### Add Warning Tooltip to Node Headers

```vue
<!-- NodeEditor.vue -->

<template>
  <div class="node-editor">
    <div class="node-header">
      <h3>
        {{ nodeName }}
        <span class="required">*</span>
        
        <!-- Generation warning tooltip (2b) -->
        <span 
          v-if="generationWarning"
          class="warning-tooltip"
          :title="generationWarning"
        >
          ⚠️
        </span>
      </h3>
    </div>
    
    <!-- Node fields -->
  </div>
</template>

<script>
export default {
  props: ['nodeName', 'generationWarning']
}
</script>

<style scoped>
.warning-tooltip {
  cursor: help;
  margin-left: 5px;
  font-size: 16px;
  color: #ff9800;
}

.warning-tooltip:hover {
  filter: drop-shadow(0 0 4px rgba(255, 152, 0, 0.6));
}
</style>
```

---

## Database Schema

Ensure your `prompt_versions.content` JSONB includes these fields:

```sql
-- Run migration: database/migrations/20251121_add_step_criteria_variants.sql

UPDATE prompt_versions
SET content = jsonb_set(
    jsonb_set(
        jsonb_set(
            content,
            '{step_criteria_source}',
            content->'step_criteria'
        ),
        '{step_criteria_sw}',
        '""'::jsonb
    ),
    '{step_criteria_lk}',
    '""'::jsonb
)
WHERE content ? 'step_criteria';
```

---

## Testing

### 1. Test Backend Integration Standalone

```bash
cd database/scripts
export OPENAI_API_KEY="sk-..."
python backend_integration.py
```

### 2. Test API Endpoint

```bash
curl -X POST http://localhost:8000/api/verticals/reverse_mortgage \
  -H "Content-Type: application/json" \
  -d '{
    "nodes": [
      {
        "node_name": "greet",
        "step_criteria_source": "Complete after greeting and rapport"
      }
    ]
  }'
```

### 3. Test Full Flow in Vue

1. Go to `/verticals` page
2. Edit a node's `step_criteria_source`
3. Click "Save Vertical"
4. Modal should appear with generation report
5. Check node for warning tooltip if fallback was used

---

## Cost Estimates

**Per 9-node vertical:**
- Best case (all mini): ~$0.0009
- Typical (7 mini, 2 full): ~$0.003
- Worst case (all full): ~$0.009

**Even running 100 times: < $1.00**

---

## Troubleshooting

### Issue: "OPENAI_API_KEY not set"

**Fix:**
```bash
export OPENAI_API_KEY="sk-..."
```

### Issue: Generation fails, no fallback

**Fix:** Check that `database/scripts/prompts/fallbacks.py` is present and contains all 9 nodes.

### Issue: Modal doesn't show

**Fix:** Check browser console for errors. Ensure `generation_report` is in API response.

### Issue: Tooltips don't appear

**Fix:** Verify `updateNodeWarnings()` is called after save and that `generationWarning` is passed to NodeEditor component.

---

## Next Steps

1. ✅ Integrate `backend_integration.py` into your API
2. ✅ Add `GenerationReportModal.vue` to your Vue components
3. ✅ Update save endpoint to return `generation_report`
4. ✅ Add warning tooltips to node headers
5. ✅ Test with a few nodes
6. ✅ Deploy to production

---

## Support

If you encounter issues, check:
1. OpenAI API key is valid
2. All dependencies are installed
3. Migration has been run on database
4. Logs for generation errors

For debugging, enable debug logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

