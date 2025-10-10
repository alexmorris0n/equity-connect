# Archived Documentation

**Date Archived:** October 10, 2025  
**Reason:** Migrated from BatchData/ATTOM to PropertyRadar

---

## Migration History

### **Phase 1: BatchData (Sept 2025 - Oct 2025)**
- Used BatchData MCP with AI Agent for property searches
- **Problem:** Unsustainable billing ($6,200+ per 32-zip query)
- **Deprecated:** October 10, 2025

### **Phase 2: ATTOM (Planned but Not Deployed)**
- Planned migration to ATTOM Property API
- **Problem:** Still required full enrichment waterfall ($0.21/lead)
- **Decision:** Skipped in favor of PropertyRadar

### **Phase 3: PropertyRadar (Oct 2025 - Current)**
- Direct property filtering (age 62+, equity, owner-occupied)
- Built-in contact append (email + phone)
- **Cost:** $0.098/lead (53% cheaper than ATTOM)
- **Status:** ✅ Active in production

---

## Archived Files

### BatchData Documentation
- `BATCHDATA_MCP_INTEGRATION.md` - How BatchData MCP worked
- `BATCHDATA_FIRST_WATERFALL.md` - BatchData waterfall strategy

### ATTOM Documentation  
- `ATTOM_API_MIGRATION.md` - Planned ATTOM integration (never deployed)

**Note:** These files are kept for historical reference and troubleshooting legacy data.

---

## Current Documentation

See active documentation in parent `/docs` folder:
- ✅ `PROPERTYRADAR_INTEGRATION.md` - Current property data source
- ✅ `DATA_SOURCING_WATERFALL_STRATEGY.md` - Updated enrichment strategy
- ✅ `PRODUCTION_PLAN.md` - Overall production architecture

---

## Migration Benefits

| Metric | BatchData | ATTOM (Planned) | PropertyRadar (Current) |
|--------|-----------|-----------------|-------------------------|
| **Cost/Lead** | $24.80 | $0.21 | **$0.098** |
| **Pre-filtering** | ❌ None | ❌ Limited | ✅ Age, equity, occupancy |
| **Contact Data** | ❌ Separate | ❌ Separate | ✅ Included |
| **Monthly Cost (250/day)** | $186,000 | $1,575 | **$735** |
| **Savings vs Previous** | N/A | 99.2% | 53% (vs ATTOM) |

**Total Savings:** $185,265/month vs BatchData

