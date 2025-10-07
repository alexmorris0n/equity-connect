# 🧭 Equity Connect — BatchData Dedup Plan

## 🎯 Goal
Pull **net-new property records** from **BatchData** (via `batchdata-mcp-real-estate`), skip any previously seen ones, and pass only unique leads to skip-trace + campaign pipelines.

---

## 🧩 Core Dedup Logic

### Triple-Key Uniqueness
Every property lead is defined by these three identifiers:

| Key | Source | Use |
|-----|---------|-----|
| `MAK` | BatchData Master Address Key | Canonical property ID |
| `APN` | County parcel number | Secondary dedupe |
| `addr_hash` | SHA256(lower(address+city+state+zip)) | Fallback fingerprint |

```sql
alter table leads
  add constraint if not exists leads_dedupe_unique
  unique (coalesce(mak,''), coalesce(apn,''), coalesce(addr_hash,''));
```

`ON CONFLICT DO NOTHING` ensures idempotent inserts.

---

## ⚙️ Pull Strategy

### Cursor Tracking

Keep per-ZIP progress in a small table:

```sql
create table if not exists batchdata_cursor_state (
  zip text primary key,
  last_page int default 0,
  last_mak text,
  completed boolean default false,
  updated_at timestamptz default now()
);
```

**Each run:**

1. Read state → continue from `last_page`
2. Insert only new leads (conflict-free)
3. Update state on success
4. Mark ZIP as completed when exhausted

---

## 🔁 ZIP Rotation Logic

* Each broker has 3–5 ZIPs
* Pull 50–250 records per ZIP per run
* Rotate through ZIPs; skip any `completed = true`
* Weekly: re-crawl completed zips to find new inventory

---

## 🧠 n8n (MCP) Workflow Outline

1. **Start → MCP: BatchData Search**

   ```js
   const result = await $mcp.call("batchdata-mcp-real-estate/fetch", {
     zip: $env.ZIP,
     page: $env.PAGE,
     filters: {
       ownerOccupied: true,
       singleRes: true,
       reverseMortgage: true
     }
   });
   ```

2. **Compute addr_hash**

   ```js
   const crypto = require("crypto");
   for (const r of result.data) {
     r.addr_hash = crypto.createHash("sha256")
       .update(`${r.address_line_1}${r.city}${r.state}${r.zip}`.toLowerCase())
       .digest("hex");
   }
   ```

3. **Insert to Supabase**

   ```sql
   insert into leads (mak, apn, addr_hash, batchdata_payload)
   values (:mak, :apn, :addr_hash, :payload)
   on conflict (mak, apn, addr_hash) do nothing;
   ```

4. **Filter Inserted Rows**

   * Use `RETURNING id` → forward only new IDs
   * Send new leads → skip-trace queue

5. **Update Cursor State**

   ```sql
   upsert into batchdata_cursor_state (zip, last_page, last_mak, updated_at)
   values (:zip, :page, :last_mak, now());
   ```

6. **Stop Condition**

   * If `insert_count = 0`, mark ZIP as exhausted and rotate.

---

## 🧱 Helper Function (optional)

```sql
create or replace function insert_lead_dedupe(
  mak text, apn text, addr_hash text, payload jsonb
) returns void language sql as $$
  insert into leads (mak, apn, addr_hash, batchdata_payload)
  values (mak, apn, addr_hash, payload)
  on conflict (mak, apn, addr_hash) do nothing;
$$;
```

---

## 🧰 Ops Schedule

| Frequency | Task                                   |
| --------- | -------------------------------------- |
| Daily     | Pull 50–250 new records per broker ZIP |
| Weekly    | Re-crawl completed ZIPs                |
| Monthly   | Compare MAK counts per ZIP for drift   |

---

## 🧩 Optional Improvements

* Add `last_seen_at` to `leads` for change detection
* Materialized view `mv_new_leads_daily` for dashboarding
* Auto-enqueue new leads to skip-trace via trigger
* Store full raw BatchData payload JSONB for auditing

---

## ✅ Benefits

* MCP-native (no HTTP node)
* Fully idempotent ingestion
* Zero duplicate skip-traces
* Scalable by ZIP or broker
* Self-healing with cursor state

---

**Status:** Implement in n8n + Supabase
**Owner:** Data Automation
**Updated:** 2025-10-07
