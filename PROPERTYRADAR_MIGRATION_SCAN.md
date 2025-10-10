# PropertyRadar Migration - Complete Project Scan

**Date:** 2025-10-10  
**Task:** Replace BatchData & ATTOM references with PropertyRadar  
**Workflows to Update:**
- Property Pull: https://n8n.instaroute.com/workflow/HnPhfA6KCq5VjTCy
- Enrichment Waterfall: https://n8n.instaroute.com/workflow/Fjx1BYwrVsqHdNjK

---

## 📊 SCAN RESULTS SUMMARY

### Files with BatchData References: **34 files**
### Files with ATTOM References: **10 files**
### Files with Estated References: **9 files**
### Files with PropStream References: **32 files** (mostly historical)

---

## 🗂️ CATEGORIZED UPDATE LIST

### 🔴 **CRITICAL - Must Update (Core Functionality)**

#### **1. Database Schema Files**
| File | Why Critical | References |
|------|-------------|-----------|
| `config/batchdata-dedup-migration.sql` | Creates BatchData-specific columns (mak, apn, batchdata_payload) | BatchData, MAK, APN |
| `config/attom-migration.sql` | Creates ATTOM columns (attom_property_id) | ATTOM, Estated |
| `config/supabase-production-migration.sql` | Main production schema with BatchData/ATTOM columns | mak, apn, attom_property_id |
| `apply-migrations.sql` | Master migration runner | Likely references above files |

**Action Required:** Create new `config/propertyradar-migration.sql` with:
- `radar_id TEXT` (unique)
- `radar_property_data JSONB`
- Update deduplication hierarchy
- Update `upsert_lead` function

---

#### **2. Active n8n Workflow Files**
| File | Status | References |
|------|--------|-----------|
| `workflows/batchdata-pull-worker.json` | ✅ ACTIVE IN PRODUCTION | BatchData MCP, MAK dedup |
| `workflows/enrichment-pipeline-waterfall.json` | ⚠️ NEEDS WATERFALL | Skip-trace logic |

**Action Required:**
- Replace `batchdata-pull-worker.json` with PropertyRadar pull logic
- Update `enrichment-pipeline-waterfall.json` with PropertyRadar → PDL → Melissa waterfall

---

#### **3. Master Documentation Files**
| File | Why Critical | References |
|------|-------------|-----------|
| `plan.md` | Master plan - shows ATTOM strategy | ATTOM, PDL, Melissa waterfall |
| `docs/PRODUCTION_PLAN.md` | Production deployment plan | BatchData MCP, dedupe strategy |
| `config/api-configurations.json` | API endpoint configs | BatchData MCP URLs, ATTOM endpoints |

**Action Required:** Update all three to reflect PropertyRadar strategy

---

### 🟡 **IMPORTANT - Should Update (Documentation)**

#### **4. Integration Documentation**
| File | Type | Action |
|------|------|--------|
| `docs/BATCHDATA_MCP_INTEGRATION.md` | Active integration guide | Archive or mark deprecated |
| `docs/ATTOM_API_MIGRATION.md` | Planned integration (never used) | Delete or archive |
| `docs/DATA_SOURCING_WATERFALL_STRATEGY.md` | ATTOM + PDL + Melissa strategy | Replace with PropertyRadar version |
| `docs/BATCHDATA_FIRST_WATERFALL.md` | BatchData strategy doc | Archive |
| `docs/BATCHDATA_COST_ANALYSIS.md` | Why BatchData failed | Keep for reference (historical) |

**Action Required:** Create new `docs/PROPERTYRADAR_INTEGRATION.md`

---

#### **5. Workflow Documentation**
| File | Type | Action |
|------|------|--------|
| `workflows/ATTOM-property-pull-worker.md` | ATTOM workflow design (never deployed) | Delete or archive |
| `workflows/UPDATED-batchdata-pull-worker-dynamic.md` | BatchData workflow variant | Archive |

**Action Required:** Create new `workflows/PROPERTYRADAR-property-pull-worker.md`

---

#### **6. Status/Summary Files**
| File | Type | Action |
|------|------|--------|
| `ATTOM_MIGRATION_SUMMARY.md` | ATTOM quick-start (never used) | Delete |
| `ATTOM_READY_TO_TEST.md` | Testing instructions for ATTOM | Delete |
| `COMPLETE_IMPLEMENTATION_SUMMARY.md` | Lists ATTOM completion | Update |
| `IMMEDIATE_NEXT_STEPS.md` | Next steps for ATTOM | Update or delete |
| `WORKFLOW_UPDATE_COMPLETE.md` | Workflow completion status | Update |
| `BROKER_SCALING_IMPLEMENTATION.md` | Broker scaling with BatchData | Update |

---

### 🟢 **OPTIONAL - Can Archive (Historical)**

#### **7. Archived Workflows**
| File | Action |
|------|--------|
| `workflows-archive/batchdata-dedup-workflow.json` | Keep as archive (already archived) |
| `workflows-archive/propstream-supabase-workflow.json` | Keep as archive (PropStream != PropertyRadar) |
| `workflows-archive/README.md` | Update to mention BatchData/ATTOM archived |

---

#### **8. Phase Documentation (Historical)**
| File | Action |
|------|--------|
| `PHASE_1_COMPLETE.md` | Keep as historical record |
| `docs/PHASE_2_COMPLETE.md` | Keep as historical record |
| `docs/PHASE_2_N8N_WORKFLOWS.md` | Keep as historical record |

---

#### **9. Helper Functions (May Reference Old Columns)**
| File | Check For |
|------|-----------|
| `supabase-helper-functions.sql` | `mak`, `apn`, `attom_property_id` references |
| `config/supabase-database-schema.json` | Column definitions |

**Action Required:** Review and update function signatures

---

### ⚪ **NO ACTION NEEDED (Unrelated)**

#### **10. Other Integration Docs (Not Data Source Related)**
- `docs/CALCOM_INTEGRATION.md` ✅
- `docs/SIGNALWIRE_INTEGRATION_GUIDE.md` ✅
- `docs/VAPI_AI_VOICE_INTEGRATION.md` ✅
- `docs/ZAPMAIL_MAILBOX_CONFIGURATION.md` ✅
- All files in `equity-connect-v2/` ✅
- All files in `frontend/` ✅
- All files in `templates/` ✅
- All files in `prompts/` ✅

---

## 📋 **STEP 2: PRIORITIZED UPDATE CHECKLIST**

### **Phase 1: Database Foundation (Do First)**
- [ ] Create `config/propertyradar-migration.sql`
  - Add `radar_id` column
  - Add `radar_property_data` JSONB column
  - Create unique index on `radar_id`
  - Update `upsert_lead` function to support PropertyRadar
  - Update dedup hierarchy: radar_id → mak → apn → addr_hash
- [ ] Apply migration to Supabase
- [ ] Test with sample INSERT

---

### **Phase 2: Core Documentation (Do Second)**
- [ ] Create `docs/PROPERTYRADAR_INTEGRATION.md`
  - API endpoints
  - Filtering criteria (age 62+, equity, owner-occupied)
  - Contact append pricing (free 2,500, then $0.04 each)
  - Deduplication strategy
- [ ] Update `plan.md`
  - Replace ATTOM sections with PropertyRadar
  - Update cost analysis ($0.092 vs $0.21)
  - Update waterfall logic (PropertyRadar → PDL → Melissa)
- [ ] Update `docs/PRODUCTION_PLAN.md`
  - Replace BatchData MCP section with PropertyRadar
  - Update cost projections
  - Update launch checklist

---

### **Phase 3: n8n Workflows (Do Third)**
- [ ] Update `workflows/batchdata-pull-worker.json` → PropertyRadar
  - Replace BatchData AI Agent node with PropertyRadar HTTP node
  - Add PropertyRadar filtering params (age, equity, occupancy)
  - Update extraction/normalization code for PropertyRadar response
  - Update upsert to use `radar_id` instead of `mak`
  - Test with 10 properties
- [ ] Update `workflows/enrichment-pipeline-waterfall.json`
  - Add "Check PropertyRadar Contact" conditional
  - IF PropertyRadar has email/phone → skip enrichment
  - IF PropertyRadar missing contact → route to PDL
  - IF PDL miss → route to Melissa
  - Update all cost tracking

---

### **Phase 4: Supporting Files (Do Fourth)**
- [ ] Update `config/api-configurations.json`
  - Add PropertyRadar endpoints
  - Remove or comment out BatchData MCP URLs
- [ ] Update `supabase-helper-functions.sql`
  - Review all functions for `mak`/`apn`/`attom_property_id` references
  - Update to prioritize `radar_id`
- [ ] Create workflow documentation:
  - `workflows/PROPERTYRADAR-property-pull-worker.md`
  - `workflows/PROPERTYRADAR-enrichment-waterfall.md`

---

### **Phase 5: Cleanup (Do Last)**
- [ ] Archive outdated docs:
  - Move `docs/ATTOM_API_MIGRATION.md` → `docs/archive/`
  - Move `docs/BATCHDATA_MCP_INTEGRATION.md` → `docs/archive/`
  - Delete `ATTOM_MIGRATION_SUMMARY.md`
  - Delete `ATTOM_READY_TO_TEST.md`
  - Delete `IMMEDIATE_NEXT_STEPS.md` (if outdated)
- [ ] Update summary files:
  - `COMPLETE_IMPLEMENTATION_SUMMARY.md`
  - `README.MD`
- [ ] Update `workflows-archive/README.md` to note BatchData/ATTOM archived

---

## 🎯 **NEXT IMMEDIATE ACTIONS**

### **RIGHT NOW (Step 3 - Small Chunks):**

1. **Chunk 1:** Create PropertyRadar database migration
2. **Chunk 2:** Apply migration to Supabase
3. **Chunk 3:** Update `plan.md` with PropertyRadar strategy
4. **Chunk 4:** Create PropertyRadar integration documentation
5. **Chunk 5:** Update n8n property pull workflow (HnPhfA6KCq5VjTCy)
6. **Chunk 6:** Update n8n enrichment workflow (Fjx1BYwrVsqHdNjK)
7. **Chunk 7:** Update API configurations
8. **Chunk 8:** Test end-to-end
9. **Chunk 9:** Archive old docs
10. **Chunk 10:** Update summary files

---

## ✅ **READY TO PROCEED**

**Scan complete! 34 BatchData files, 10 ATTOM files, 32 PropStream references found.**

**Waiting for your approval to start Step 3 (updates in small chunks).**

