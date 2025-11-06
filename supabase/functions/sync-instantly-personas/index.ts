import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const INSTANTLY_API_KEY = Deno.env.get("INSTANTLY_API_KEY") ?? "";
const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ??
  Deno.env.get("LOCAL_SUPABASE_URL") ??
  "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("LOCAL_SUPABASE_SERVICE_ROLE_KEY") ??
  "";
const INTERNAL_TOKEN = Deno.env.get("INSTANTLY_SYNC_SECRET") ?? "";

const INSTANTLY_API_BASE = "https://api.instantly.ai";
const PAGE_LIMIT = 100;
const MAX_RETRIES = 5;

const querySchema = z.object({
  date_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  date_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  days_back: z
    .string()
    .regex(/^\d+$/)
    .transform((value) => Number(value))
    .refine((value) => value > 0 && value <= 90, {
      message: "days_back must be between 1 and 90",
    })
    .optional(),
  dry_run: z.string().optional(),
  campaign_id: z.string().optional(),
});

interface PersonaEvent {
  personaName: string;
  personaEmail: string;
  timestamp: Date;
}

interface LeadAggregate {
  leadEmail: string;
  originalEmails: Set<string>;
  earliest?: PersonaEvent;
  latest?: PersonaEvent;
}

interface FetchStats {
  total: number;
  outbound: number;
  ignoredType: number;
  outOfRange: number;
  missingPersona: number;
  processed: number;
  errors: string[];
}

const PERSONA_NAME_OVERRIDES: Record<string, string> = {
  "c": "Carlos Rodriguez",
  "c.rodriguez": "Carlos Rodriguez",
  "carlos": "Carlos Rodriguez",
  "carlos.rodriguez": "Carlos Rodriguez",
  "rodriguez.carlos": "Carlos Rodriguez",
  "maria": "Maria Rodriguez",
  "maria.rodriguez": "Maria Rodriguez",
  "maria.r": "Maria Rodriguez",
  "m.rodriguez": "Maria Rodriguez",
  "rodriguez.maria": "Maria Rodriguez",
  "l.w": "Latoya Washington",
  "latoya": "Latoya Washington",
  "latoya.washington": "Latoya Washington",
  "washington.l": "Latoya Washington",
  "m.w": "Marcus Washington",
  "marcus": "Marcus Washington",
  "marcus.d": "Marcus Washington",
  "marcus.washington": "Marcus Washington",
  "washington.marcus": "Marcus Washington",
  "p.patel": "Priya Patel",
  "priya": "Priya Patel",
  "priya.p": "Priya Patel",
  "priya.patel": "Priya Patel",
  "patel.priya": "Priya Patel",
  "r.patel": "Rahul Patel",
  "rahul": "Rahul Patel",
  "rahul.p": "Rahul Patel",
  "rahul.patel": "Rahul Patel",
  "patel.rahul": "Rahul Patel",
};

const jsonHeaders = { "Content-Type": "application/json" } as const;

function jsonResponse(body: unknown, init: number | ResponseInit = 200): Response {
  const responseInit: ResponseInit = typeof init === "number" ? { status: init } : init;
  return new Response(JSON.stringify(body), {
    ...responseInit,
    headers: { ...jsonHeaders, ...(responseInit.headers ?? {}) },
  });
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function addDays(date: Date, amount: number): Date {
  const newDate = new Date(date.getTime());
  newDate.setUTCDate(newDate.getUTCDate() + amount);
  return newDate;
}

function computeLockKey(startDate: string, endDate: string): number {
  const input = `${startDate}:${endDate}`;
  let hash = 0;
  for (const byte of new TextEncoder().encode(input)) {
    hash = (hash * 31 + byte) % 2147483647;
  }
  return hash;
}

function capitalize(word: string): string {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function inferPersonaName(localPart: string): string | null {
  if (!localPart) return null;
  const key = localPart.toLowerCase();
  if (PERSONA_NAME_OVERRIDES[key]) return PERSONA_NAME_OVERRIDES[key];

  const delimiters = [".", "_", "-"];
  for (const delimiter of delimiters) {
    if (key.includes(delimiter)) {
      const pieces = key.split(delimiter).filter(Boolean);
      if (pieces.length === 2) {
        return `${capitalize(pieces[0])} ${capitalize(pieces[1])}`;
      }
    }
  }

  return capitalize(key);
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function instantFetch(path: string, search: Record<string, string> = {}, attempt = 0): Promise<Response> {
  const url = new URL(path, INSTANTLY_API_BASE);
  Object.entries(search).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${INSTANTLY_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (response.status === 429) {
    if (attempt >= MAX_RETRIES) {
      throw new Error("Instantly API rate limit exceeded");
    }
    const waitMs = Math.min(30000, 1000 * Math.pow(2, attempt));
    await delay(waitMs);
    return instantFetch(path, search, attempt + 1);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Instantly API ${path} failed (${response.status}): ${text}`);
  }

  return response;
}

async function fetchPersonaWhitelist(): Promise<Set<string>> {
  const whitelist = new Set<string>();
  let startingAfter: string | undefined;

  do {
    const params: Record<string, string> = { limit: String(PAGE_LIMIT) };
    if (startingAfter) params.starting_after = startingAfter;

    const response = await instantFetch("/api/v2/campaigns", params);
    const payload = await response.json();
    const items: any[] = Array.isArray(payload.items) ? payload.items : [];

    for (const item of items) {
      const emailList: string[] = Array.isArray(item.email_list) ? item.email_list : [];
      for (const email of emailList) {
        whitelist.add(email.toLowerCase());
      }
    }

    startingAfter = payload.next_starting_after ?? undefined;
    if (items.length === 0) {
      startingAfter = undefined;
    }
  } while (startingAfter);

  return whitelist;
}

async function collectEmails(
  startDate: Date,
  endDate: Date,
  whitelist: Set<string>,
  campaignId?: string,
): Promise<{ aggregates: Map<string, LeadAggregate>; stats: FetchStats }>
{
  const aggregates = new Map<string, LeadAggregate>();
  const stats: FetchStats = {
    total: 0,
    outbound: 0,
    ignoredType: 0,
    outOfRange: 0,
    missingPersona: 0,
    processed: 0,
    errors: [],
  };

  let startingAfter: string | undefined;
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  do {
    const params: Record<string, string> = { limit: String(PAGE_LIMIT) };
    if (startingAfter) params.starting_after = startingAfter;
    if (campaignId) params.campaign_id = campaignId;

    const response = await instantFetch("/api/v2/emails", params);
    const payload = await response.json();
    const items: any[] = Array.isArray(payload.items) ? payload.items : [];

    for (const item of items) {
      stats.total += 1;

      try {
        const ueType = item.ue_type;
        if (ueType !== 3) {
          stats.ignoredType += 1;
          continue;
        }
        stats.outbound += 1;

        const leadEmailRaw = typeof item.lead === "string" ? item.lead.trim() : "";
        const fromEmailRaw = typeof item.from_address_email === "string" ? item.from_address_email.trim() : "";
        const timestampRaw = typeof item.timestamp_email === "string" ? item.timestamp_email : undefined;

        if (!leadEmailRaw || !fromEmailRaw || !timestampRaw) {
          stats.errors.push(`missing_fields:${leadEmailRaw || "unknown"}`);
          continue;
        }

        const timestamp = new Date(timestampRaw);
        if (Number.isNaN(timestamp.getTime())) {
          stats.errors.push(`invalid_timestamp:${timestampRaw}`);
          continue;
        }

        const emailTime = timestamp.getTime();
        if (emailTime < startMs || emailTime > endMs) {
          stats.outOfRange += 1;
          continue;
        }

        const whitelistKey = fromEmailRaw.toLowerCase();
        if (whitelist.size > 0 && !whitelist.has(whitelistKey)) {
          stats.missingPersona += 1;
          continue;
        }

        const localPart = fromEmailRaw.split("@")[0] ?? "";
        const personaName = inferPersonaName(localPart);
        if (!personaName) {
          stats.missingPersona += 1;
          continue;
        }

        const leadKey = leadEmailRaw.toLowerCase();
        let aggregate = aggregates.get(leadKey);
        if (!aggregate) {
          aggregate = {
            leadEmail: leadKey,
            originalEmails: new Set<string>(),
          };
          aggregates.set(leadKey, aggregate);
        }

        aggregate.originalEmails.add(leadEmailRaw);

        const personaEvent: PersonaEvent = {
          personaName,
          personaEmail: fromEmailRaw,
          timestamp,
        };

        if (!aggregate.earliest || timestamp.getTime() < aggregate.earliest.timestamp.getTime()) {
          aggregate.earliest = personaEvent;
        }

        if (!aggregate.latest || timestamp.getTime() > aggregate.latest.timestamp.getTime()) {
          aggregate.latest = personaEvent;
        }

        stats.processed += 1;
      } catch (error) {
        stats.errors.push(`processing_error:${(error as Error).message}`);
      }
    }

    startingAfter = payload.next_starting_after ?? undefined;
    if (items.length === 0) {
      startingAfter = undefined;
    }
  } while (startingAfter);

  return { aggregates, stats };
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();
  let lockAcquired = false;
  let lockKey = 0;
  let supabase = null as ReturnType<typeof createClient> | null;
  let dryRun = false;
  let dateRange: { from: string; to: string } | null = null;

  if (!INSTANTLY_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !INTERNAL_TOKEN) {
    console.error(JSON.stringify({
      level: "error",
      requestId,
      message: "Missing required environment variables",
    }));
    return jsonResponse({ error: "configuration_error" }, 500);
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const authHeader = req.headers.get("X-Internal-Token");
  if (!authHeader || authHeader !== INTERNAL_TOKEN) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  try {
    const url = new URL(req.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return jsonResponse(
        {
          error: "validation_error",
          details: parsed.error.flatten().fieldErrors,
        },
        400,
      );
    }

    const { date_from, date_to, days_back, dry_run, campaign_id } = parsed.data;
    dryRun = typeof dry_run === "string";

    const now = new Date();
    const defaultDate = addDays(startOfDayUTC(now), -1);
    let startDate = date_from ? startOfDayUTC(new Date(`${date_from}T00:00:00Z`)) : defaultDate;
    let endDate = date_to ? endOfDayUTC(new Date(`${date_to}T00:00:00Z`)) : endOfDayUTC(defaultDate);

    if (days_back) {
      endDate = date_to ? endOfDayUTC(new Date(`${date_to}T00:00:00Z`)) : endOfDayUTC(defaultDate);
      const spanStart = addDays(startOfDayUTC(endDate), -(days_back - 1));
      startDate = spanStart;
    } else if (date_from && !date_to) {
      endDate = endOfDayUTC(new Date(`${date_from}T00:00:00Z`));
    } else if (!date_from && date_to) {
      startDate = startOfDayUTC(new Date(`${date_to}T00:00:00Z`));
      endDate = endOfDayUTC(new Date(`${date_to}T00:00:00Z`));
    }

    if (startDate.getTime() > endDate.getTime()) {
      return jsonResponse({ error: "validation_error", details: { date_range: ["date_from must be on or before date_to"] } }, 400);
    }

    dateRange = { from: toISODate(startDate), to: toISODate(endDate) };
    lockKey = computeLockKey(toISODate(startDate), toISODate(endDate));
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: lockResult, error: lockError } = await supabase.rpc("acquire_persona_sync_lock", {
      lock_key: lockKey,
    });
    if (lockError) {
      throw new Error(`Failed to acquire lock: ${lockError.message}`);
    }
    if (!lockResult) {
      return jsonResponse({ error: "conflict", message: "sync already running" }, 409);
    }
    lockAcquired = true;

    const whitelist = await fetchPersonaWhitelist();

    const { aggregates, stats } = await collectEmails(startDate, endDate, whitelist, campaign_id);

    if (aggregates.size === 0) {
      const responseBody = {
        status: "ok",
        dry_run: dryRun,
        metrics: {
          range: { date_from: dateRange.from, date_to: dateRange.to },
          ...stats,
          leadsConsidered: 0,
          leadsUpdated: 0,
          leadsSkipped: 0,
        },
      };

      if (!dryRun) {
        await supabase
          .from("instantly_persona_sync_log")
          .insert({
            date_from: dateRange.from,
            date_to: dateRange.to,
            leads_found: stats.processed,
            leads_updated: 0,
            leads_skipped: stats.total - stats.processed,
            errors: stats.errors.length ? stats.errors : null,
            runtime_ms: Math.round(performance.now() - startedAt),
            status: stats.errors.length ? "partial" : "success",
          });
      }

      return jsonResponse(responseBody, 200);
    }

    const leadKeys = Array.from(aggregates.keys());
    const chunks = chunkArray(leadKeys, 100);
    const missingLeads: string[] = [];
    let leadsUpdated = 0;
    let leadsSkipped = 0;
    const updateErrors: string[] = [];

    for (const chunk of chunks) {
      const originalEmailSet = new Set<string>();
      for (const key of chunk) {
        const aggregate = aggregates.get(key)!;
        for (const original of aggregate.originalEmails) {
          originalEmailSet.add(original);
        }
      }
      const uniqueEmails = Array.from(originalEmailSet);

      const { data: leadRows, error: leadError } = await supabase
        .from("leads")
        .select("id, primary_email, persona_sender_name, last_email_from, last_contact_at")
        .in("primary_email", uniqueEmails);

      if (leadError) {
        updateErrors.push(`lead_query_failed:${leadError.message}`);
        continue;
      }

      const foundEmails = new Set<string>();
      for (const row of leadRows ?? []) {
        const primaryEmailRaw = row.primary_email as string;
        const primaryEmail = primaryEmailRaw.toLowerCase();
        foundEmails.add(primaryEmail);
        const aggregate = aggregates.get(primaryEmail);
        if (!aggregate) {
          continue;
        }

        const updates: Record<string, unknown> = {};
        let shouldUpdate = false;

        if (!row.persona_sender_name && aggregate.earliest) {
          updates.persona_sender_name = aggregate.earliest.personaName;
          shouldUpdate = true;
        }

        if (aggregate.latest) {
          const existingTimestamp = row.last_contact_at ? new Date(row.last_contact_at as string).getTime() : 0;
          if (aggregate.latest.timestamp.getTime() > existingTimestamp) {
            updates.last_contact_at = aggregate.latest.timestamp.toISOString();
            updates.last_email_from = aggregate.latest.personaEmail;
            shouldUpdate = true;
          }
        }

        if (!shouldUpdate) {
          leadsSkipped += 1;
          continue;
        }

        if (!dryRun) {
          const { error: updateError } = await supabase
            .from("leads")
            .update(updates)
            .eq("id", row.id);

          if (updateError) {
            updateErrors.push(`update_failed:${primaryEmailRaw}:${updateError.message}`);
            continue;
          }
        }

        leadsUpdated += 1;
      }

      // Identify missing leads in this chunk
      for (const key of chunk) {
        const aggregate = aggregates.get(key)!;
        let found = false;
        for (const original of aggregate.originalEmails) {
          if (foundEmails.has(original.toLowerCase())) {
            found = true;
            break;
          }
        }
        if (!found) {
          missingLeads.push(Array.from(aggregate.originalEmails)[0] ?? key);
        }
      }
    }

    const runtimeMs = Math.round(performance.now() - startedAt);
    const logStatus = updateErrors.length ? "partial" : "success";

    if (!dryRun) {
      await supabase
        .from("instantly_persona_sync_log")
        .insert({
          date_from: dateRange.from,
          date_to: dateRange.to,
          leads_found: aggregates.size,
          leads_updated: leadsUpdated,
          leads_skipped: leadsSkipped + missingLeads.length,
          errors: (stats.errors.length || updateErrors.length)
            ? [...stats.errors, ...updateErrors]
            : null,
          runtime_ms: runtimeMs,
          status: logStatus,
        });
    }

    const responseBody = {
      status: "ok",
      dry_run: dryRun,
      metrics: {
        range: { date_from: dateRange.from, date_to: dateRange.to },
        fetch: stats,
        leadsFound: aggregates.size,
        leadsUpdated,
        leadsSkipped: leadsSkipped + missingLeads.length,
        missingLeads,
        updateErrors,
        runtime_ms: runtimeMs,
      },
    };

    return jsonResponse(responseBody, updateErrors.length ? 207 : 200);
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      requestId,
      message: (error as Error).message,
      stack: (error as Error).stack,
    }));

    if (!dryRun && supabase && lockAcquired && dateRange) {
      try {
        await supabase
          .from("instantly_persona_sync_log")
          .insert({
            date_from: dateRange.from,
            date_to: dateRange.to,
            leads_found: 0,
            leads_updated: 0,
            leads_skipped: 0,
            errors: [(error as Error).message],
            runtime_ms: Math.round(performance.now() - startedAt),
            status: "failed",
          });
      } catch (logError) {
        console.error(JSON.stringify({
          level: "error",
          requestId,
          message: "Failed to log sync failure",
          error: (logError as Error).message,
        }));
      }
    }

    return jsonResponse({ error: "internal_error", message: (error as Error).message, request_id: requestId }, 500);
  } finally {
    if (lockAcquired && supabase) {
      try {
        await supabase.rpc("release_persona_sync_lock", { lock_key: lockKey });
      } catch (unlockError) {
        console.error(JSON.stringify({
          level: "error",
          requestId,
          message: "Failed to release advisory lock",
          error: (unlockError as Error).message,
        }));
      }
    }
  }
});

