import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Broker = {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  nmls_number: string | null;
  propertyradar_list_id: string | null;
  propertyradar_offset: number | null;
  daily_lead_capacity: number | null;
  daily_lead_surplus: number | null;
};

type SwarmtraceContact = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

type SwarmtraceResult = {
  index: number;
  primary_contact: SwarmtraceContact | null;
  candidate_emails: string[];
};

type BrokerRunStats = {
  radar_ids: number;
  new_radar_ids: number;
  properties_purchased: number;
  swarmtrace_contacts: number;
  swarmtrace_emails: number;
  neverbounce_valid: number;
  leads_attempted_insert: number;
  uploadable_leads: number;
  uploaded_to_instantly: number;
  valid_email_rate: number;
  upload_rate: number;
  campaign_breakdown: Record<string, number>;
};

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ??
  Deno.env.get("LOCAL_SUPABASE_URL") ??
  "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_KEY") ??
  Deno.env.get("LOCAL_SUPABASE_SERVICE_ROLE_KEY") ??
  "";

const INTERNAL_TOKEN = Deno.env.get("LEAD_PULLER_SECRET") ?? "";
const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_WEBHOOK_URL") ?? "";

const PROPERTYRADAR_API_KEY = Deno.env.get("PROPERTYRADAR_API_KEY") ?? "";
const PROPERTYRADAR_BASE_URL = Deno.env.get("PROPERTYRADAR_BASE_URL") ??
  "https://api.propertyradar.com/v1";

const SWARMTRACE_API_KEY = Deno.env.get("SWARMTRACE_API_KEY") ?? "";
const SWARMTRACE_BASE_URL = Deno.env.get("SWARMTRACE_BASE_URL") ??
  "https://skiptracepublicapi.swarmalytics.com";

const NEVERBOUNCE_API_KEY = Deno.env.get("NEVERBOUNCE_API_KEY") ?? "";
const NEVERBOUNCE_BASE_URL = Deno.env.get("NEVERBOUNCE_BASE_URL") ??
  "https://api.neverbounce.com/v4";

const INSTANTLY_API_KEY = Deno.env.get("INSTANTLY_API_KEY") ?? "";
const INSTANTLY_BASE_URL = Deno.env.get("INSTANTLY_BASE_URL") ??
  "https://api.instantly.ai/api/v2";

const DEFAULT_MORTGAGE_RATE = Number(Deno.env.get("DEFAULT_MORTGAGE_RATE") ?? "6.5");
const MORTGAGE_RATE_BY_YEAR_RAW = Deno.env.get("MORTGAGE_RATE_BY_YEAR") ?? "";
let MORTGAGE_RATE_BY_YEAR: Record<string, number> = {};
if (MORTGAGE_RATE_BY_YEAR_RAW) {
  try {
    const parsed = JSON.parse(MORTGAGE_RATE_BY_YEAR_RAW);
    if (parsed && typeof parsed === "object") {
      MORTGAGE_RATE_BY_YEAR = parsed;
    }
  } catch {
    MORTGAGE_RATE_BY_YEAR = {};
  }
}

const SWARMTRACE_DELAY_MS = Number(Deno.env.get("SWARMTRACE_DELAY_MS") ?? "250");
const INSTANTLY_DELAY_MS = Number(Deno.env.get("INSTANTLY_DELAY_MS") ?? "250");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-token",
} as const;

function jsonResponse(body: unknown, init: number | ResponseInit = 200): Response {
  const responseInit: ResponseInit = typeof init === "number" ? { status: init } : init;
  return new Response(JSON.stringify(body), {
    ...responseInit,
    headers: { "Content-Type": "application/json", ...(responseInit.headers ?? {}), ...corsHeaders },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: { retries?: number; retryDelayMs?: number } = {},
): Promise<Response> {
  const retries = options.retries ?? 4;
  const retryDelayMs = options.retryDelayMs ?? 1000;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url, init);
    if (response.ok) return response;

    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === retries) {
      return response;
    }

    const waitMs = Math.min(30000, retryDelayMs * Math.pow(2, attempt));
    await sleep(waitMs);
  }

  throw new Error(`Failed after ${retries + 1} attempts: ${url}`);
}

function ensureConfig(): string[] {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY");
  if (!PROPERTYRADAR_API_KEY) missing.push("PROPERTYRADAR_API_KEY");
  if (!SWARMTRACE_API_KEY) missing.push("SWARMTRACE_API_KEY");
  if (!NEVERBOUNCE_API_KEY) missing.push("NEVERBOUNCE_API_KEY");
  if (!INSTANTLY_API_KEY) missing.push("INSTANTLY_API_KEY");
  if (!INTERNAL_TOKEN) missing.push("LEAD_PULLER_SECRET");
  return missing;
}

function pickFirstValue<T>(value: T | null | undefined): T | null {
  return value === undefined || value === null ? null : value;
}

function pickFirstString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const raw = obj[key];
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw.trim();
    }
  }
  return null;
}

function pickFirstNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const raw = obj[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw.trim().length > 0) {
      const parsed = Number(raw.replace(/[^0-9.\-]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatShortCurrency(value: number | null): string {
  if (!value || !Number.isFinite(value)) return "";
  if (value >= 1_000_000) {
    const rounded = Math.round(value / 100_000) / 10;
    return `$${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}M`;
  }
  const rounded = Math.round(value / 1000);
  return `$${rounded}k`;
}

function formatRange(value: number | null): string {
  if (!value || !Number.isFinite(value)) return "";
  const step = 50_000;
  const lower = Math.floor(value / step) * step;
  const upper = lower + step;
  if (lower === upper) return `$${Math.round(lower / 1000)}K`;
  const fmt = (n: number) => `$${Math.round(n / 1000)}K`;
  return `${fmt(lower)}-${fmt(upper)}`;
}

function computeEquityPercent(estimatedEquity: number | null, propertyValue: number | null): number | null {
  if (!estimatedEquity || !propertyValue || propertyValue <= 0) return null;
  return (estimatedEquity / propertyValue) * 100;
}

function getMortgageRate(year: number | null): number {
  if (year !== null) {
    const override = MORTGAGE_RATE_BY_YEAR[String(year)];
    if (typeof override === "number" && Number.isFinite(override)) {
      return override;
    }
  }
  return Number.isFinite(DEFAULT_MORTGAGE_RATE) ? DEFAULT_MORTGAGE_RATE : 6.5;
}

function parseYear(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/(\d{4})/);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

function estimateMonthlyPayment(principal: number | null, annualRatePercent: number): number | null {
  if (!principal || principal <= 0) return 0;
  const monthlyRate = (annualRatePercent / 100) / 12;
  const n = 30 * 12;
  if (monthlyRate <= 0) return principal / n;
  const pow = Math.pow(1 + monthlyRate, n);
  return principal * monthlyRate * (pow / (pow - 1));
}

type CampaignArchetype =
  | "equity_lifeline"
  | "cant_retire"
  | "aging_in_place"
  | "help_family"
  | "delay_ss";

function chooseCampaignArchetype(payload: {
  isFreeAndClear: boolean;
  totalLoanBalance: number | null;
  equityPercent: number | null;
  estimatedEquity: number | null;
  inForeclosure: boolean;
  inPreforeclosure: boolean;
  inTaxDelinquency: boolean;
  yearsOwned: number | null;
}): CampaignArchetype {
  // Priority 1: Distressed — foreclosure, pre-foreclosure, or tax delinquent
  if (payload.inForeclosure || payload.inPreforeclosure || payload.inTaxDelinquency) {
    return "equity_lifeline";
  }

  // Priority 2: Has a mortgage — can't retire angle
  const hasMortgage = !payload.isFreeAndClear
    && (payload.totalLoanBalance === null || payload.totalLoanBalance > 0)
    && (payload.equityPercent ?? 0) < 90;
  if (hasMortgage) {
    return "cant_retire";
  }

  // Priority 3: Free & clear, owned 25+ years — aging in place
  if ((payload.yearsOwned ?? 0) >= 25) {
    return "aging_in_place";
  }

  // Priority 4: Free & clear, high equity ($750K+) — help family
  if ((payload.estimatedEquity ?? 0) >= 750_000) {
    return "help_family";
  }

  // Priority 5: Default — delay Social Security / supplement retirement
  return "delay_ss";
}

function computeYearsOwned(lastTransferRecDate: string | null): number | null {
  if (!lastTransferRecDate) return null;
  const match = lastTransferRecDate.match(/(\d{4})/);
  if (!match) return null;
  const transferYear = Number(match[1]);
  if (!Number.isFinite(transferYear)) return null;
  return new Date().getFullYear() - transferYear;
}

function safeFirstName(
  skipTraceName: string | null,
  email: string | null,
): string {
  if (!skipTraceName || skipTraceName.trim().length === 0) {
    return "there";
  }

  const name = skipTraceName.trim();

  // Placeholder or company names — use fallback
  if (name.length <= 1 || /^(owner|resident|occupant|trust|estate|llc|inc)$/i.test(name)) {
    return "there";
  }

  // If email starts with a clearly different first name, flag mismatch
  if (email) {
    const emailPrefix = email.split("@")[0].toLowerCase().replace(/[^a-z]/g, "");
    const nameLower = name.toLowerCase();

    if (
      emailPrefix.length >= 4
      && nameLower.length >= 3
      && !emailPrefix.startsWith(nameLower.substring(0, 3))
      && !nameLower.startsWith(emailPrefix.substring(0, 3))
    ) {
      return "there";
    }
  }

  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type === "literal") continue;
    values[part.type] = Number(part.value);
  }
  const asUTC = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  );
  return asUTC - date.getTime();
}

function startOfTodayInPT(): Date {
  const timeZone = "America/Los_Angeles";
  const now = new Date();
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(now);
  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type === "literal") continue;
    values[part.type] = Number(part.value);
  }
  const utcGuess = new Date(Date.UTC(values.year, values.month - 1, values.day, 0, 0, 0));
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset);
}

function percent(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

async function propertyRadarRequest(
  path: string,
  init: RequestInit,
): Promise<any> {
  const response = await fetchWithRetry(`${PROPERTYRADAR_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PROPERTYRADAR_API_KEY}`,
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`PropertyRadar ${response.status}: ${text}`);
  }
  return json;
}

async function swarmtraceRequest(payload: Record<string, unknown>): Promise<any> {
  const response = await fetchWithRetry(`${SWARMTRACE_BASE_URL}/skiptrace`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": SWARMTRACE_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`Swarmtrace ${response.status}: ${text}`);
  }
  return json;
}

function extractPrimaryContact(contacts: any[]): { contact: SwarmtraceContact | null; candidateEmails: string[] } {
  if (!Array.isArray(contacts) || contacts.length === 0) return { contact: null, candidateEmails: [] };

  const contactHasLandlord = (contact: any): boolean => {
    const names = Array.isArray(contact?.names) ? contact.names : [];
    return names.some((n: any) =>
      typeof n?.type === "string" && n.type.toUpperCase() === "LANDLORD"
    );
  };

  const landlordContacts = contacts.filter(contactHasLandlord);
  const candidateContacts = landlordContacts.length > 0 ? landlordContacts : contacts;

  // Collect ALL emails across candidate contacts with their ranks
  const allEmails: { email: string; rank: number }[] = [];
  for (const contact of candidateContacts) {
    const emails = Array.isArray(contact?.emails) ? contact.emails : [];
    for (const emailEntry of emails) {
      const email = typeof emailEntry?.email === "string" ? emailEntry.email : null;
      if (!email) continue;
      const rankRaw = emailEntry?.emailrank ?? emailEntry?.rank ?? 0;
      const rank = Number(rankRaw);
      const normalizedRank = Number.isFinite(rank) ? rank : 0;
      allEmails.push({ email: email.toLowerCase(), rank: normalizedRank });
    }
  }

  // Sort by rank descending and take top 3
  allEmails.sort((a, b) => b.rank - a.rank);
  const seen = new Set<string>();
  const topEmails: string[] = [];
  for (const entry of allEmails) {
    if (!seen.has(entry.email)) {
      seen.add(entry.email);
      topEmails.push(entry.email);
      if (topEmails.length >= 3) break;
    }
  }

  // Find the best contact (owner of highest-ranked email) for name/phone
  let bestContact: any = null;
  let bestRank = -1;
  for (const contact of candidateContacts) {
    const emails = Array.isArray(contact?.emails) ? contact.emails : [];
    for (const emailEntry of emails) {
      const rankRaw = emailEntry?.emailrank ?? emailEntry?.rank ?? 0;
      const rank = Number(rankRaw);
      const normalizedRank = Number.isFinite(rank) ? rank : 0;
      if (normalizedRank > bestRank) {
        bestRank = normalizedRank;
        bestContact = contact;
      }
    }
  }

  const primary = bestContact ?? candidateContacts[0] ?? {};
  const name = Array.isArray(primary.names) && primary.names.length > 0 ? primary.names[0] : {};
  const phoneEntry = Array.isArray(primary.phones) && primary.phones.length > 0 ? primary.phones[0] : {};

  const contact: SwarmtraceContact = {
    first_name: pickFirstValue(name.firstname ?? name.first_name),
    last_name: pickFirstValue(name.lastname ?? name.last_name),
    email: topEmails[0] ?? null,
    phone: pickFirstValue(phoneEntry.phonenumber ?? phoneEntry.phone ?? phoneEntry.number),
  };

  return { contact, candidateEmails: topEmails };
}

async function neverbounceCreate(emails: { email: string }[]): Promise<number> {
  const response = await fetchWithRetry(`${NEVERBOUNCE_BASE_URL}/jobs/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: NEVERBOUNCE_API_KEY,
      input_location: "supplied",
      input: emails,
      auto_start: 1,
      auto_parse: 1,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`NeverBounce create failed: ${JSON.stringify(data)}`);
  }
  if (!data.job_id) {
    throw new Error(`NeverBounce missing job_id: ${JSON.stringify(data)}`);
  }
  return Number(data.job_id);
}

async function neverbounceStatus(jobId: number): Promise<string> {
  const response = await fetchWithRetry(`${NEVERBOUNCE_BASE_URL}/jobs/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: NEVERBOUNCE_API_KEY,
      job_id: jobId,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`NeverBounce status failed: ${JSON.stringify(data)}`);
  }
  return data.job_status ?? "";
}

async function neverbounceResults(jobId: number): Promise<any[]> {
  const response = await fetchWithRetry(`${NEVERBOUNCE_BASE_URL}/jobs/results`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: NEVERBOUNCE_API_KEY,
      job_id: jobId,
      items_per_page: 1000,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`NeverBounce results failed: ${JSON.stringify(data)}`);
  }
  return Array.isArray(data.results) ? data.results : [];
}

async function uploadToInstantly(campaignId: string, leads: any[]): Promise<void> {
  const response = await fetchWithRetry(`${INSTANTLY_BASE_URL}/leads/add`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${INSTANTLY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      leads,
      campaign_id: campaignId,
      skip_if_in_campaign: true,
      verify_leads_on_import: false,
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Instantly upload failed (${response.status}): ${text}`);
  }
}

async function processBroker(
  broker: Broker,
  supabase: ReturnType<typeof createClient>,
  debug: boolean,
): Promise<BrokerRunStats> {
  const stats: BrokerRunStats = {
    radar_ids: 0,
    new_radar_ids: 0,
    properties_purchased: 0,
    swarmtrace_contacts: 0,
    swarmtrace_emails: 0,
    neverbounce_valid: 0,
    leads_attempted_insert: 0,
    uploadable_leads: 0,
    uploaded_to_instantly: 0,
    valid_email_rate: 0,
    upload_rate: 0,
    campaign_breakdown: {} as Record<string, number>,
  };

  const brokerName = broker.company_name ?? broker.contact_name ?? "Unknown";
  const brokerId = broker.id;
  const nowIso = new Date().toISOString();

  const { data: countData, error: countError } = await supabase.rpc("count_enriched_today", {
    p_broker_id: brokerId,
  });
  if (countError) {
    throw new Error(`count_enriched_today failed for ${brokerName}: ${countError.message}`);
  }
  const currentCount = Number(countData ?? 0);

  const dailyCapacity = broker.daily_lead_capacity ?? 0;
  const dailySurplus = broker.daily_lead_surplus ?? 0;
  const neededLeads = dailyCapacity - currentCount - dailySurplus;

  if (neededLeads > 0) {
    let pullQuantity = Math.ceil(neededLeads / 0.8);
    if (pullQuantity > 75) pullQuantity = 75;

    const listId = broker.propertyradar_list_id;
    if (!listId) {
      throw new Error(`Broker ${brokerName} missing propertyradar_list_id`);
    }

    const startOffset = broker.propertyradar_offset ?? 0;
    const listResponse = await propertyRadarRequest(
      `/lists/${listId}/items?Start=${startOffset}&Limit=${pullQuantity}`,
      { method: "GET" },
    );
    const listItems = listResponse.results ?? listResponse.items ?? [];
    const radarIds = (Array.isArray(listItems) ? listItems : [])
      .map((item: any) => item.RadarID ?? item.radar_id ?? item.RadarId)
      .filter((id: string | null) => typeof id === "string" && id.length > 0);
    stats.radar_ids = radarIds.length;

    if (radarIds.length > 0) {
      const { data: newRadarData, error: radarError } = await supabase.rpc(
        "filter_new_radar_ids",
        { p_radar_ids: radarIds },
      );
      if (radarError) {
        throw new Error(`filter_new_radar_ids failed: ${radarError.message}`);
      }

      const newRadarIds = (Array.isArray(newRadarData) ? newRadarData : [])
        .map((row: any) => row.radar_id)
        .filter((id: string | null) => typeof id === "string" && id.length > 0);
      stats.new_radar_ids = newRadarIds.length;

      if (newRadarIds.length > 0) {
        const propertyResponse = await propertyRadarRequest(
          "/properties?Purchase=1",
          {
            method: "POST",
            body: JSON.stringify({
              Criteria: [{ name: "RadarID", value: newRadarIds }],
            }),
          },
        );

        const properties = propertyResponse.results ?? propertyResponse.Properties ?? [];
        const propertyArray = Array.isArray(properties) ? properties : [];
        stats.properties_purchased = propertyArray.length;

        const swarmtraceResults: SwarmtraceResult[] = [];
        for (let index = 0; index < propertyArray.length; index += 1) {
          const property = propertyArray[index] ?? {};
          const propertyAddress =
            pickFirstString(property, ["PropertyAddress", "address_line1", "address", "Address"]) ??
            property?.PropertyAddress?.Street ??
            property?.PropertyAddress?.street ??
            null;
          const propertyCity =
            pickFirstString(property, ["PropertyCity", "city", "City"]) ??
            property?.PropertyAddress?.City ??
            property?.PropertyAddress?.city ??
            null;
          const propertyState =
            pickFirstString(property, ["PropertyState", "state", "State"]) ??
            property?.PropertyAddress?.State ??
            property?.PropertyAddress?.state ??
            null;
          const propertyZip =
            pickFirstString(property, ["PropertyZip", "zip", "Zip", "ZipFive"]) ??
            property?.PropertyAddress?.Zip ??
            property?.PropertyAddress?.zip ??
            null;

          if (!propertyAddress || !propertyCity || !propertyState || !propertyZip) {
            console.warn(`Skipping swarmtrace: missing address fields for index ${index}`);
            swarmtraceResults.push({ index, primary_contact: null, candidate_emails: [] });
            continue;
          }

          const payload = {
            property_address: propertyAddress,
            property_city: propertyCity,
            property_state: propertyState,
            property_zip: propertyZip,
            firstname: pickFirstString(property, ["Owner1FirstName", "OwnerFirstName", "FirstName"]) ?? undefined,
            lastname: pickFirstString(property, ["Owner1LastName", "OwnerLastName", "LastName"]) ?? undefined,
          };

          let primaryContact: SwarmtraceContact | null = null;
          let candidateEmails: string[] = [];
          try {
            const swarmtraceResponse = await swarmtraceRequest(payload);
            const contacts = swarmtraceResponse?.results?.[0]?.contacts ?? swarmtraceResponse?.contacts ?? [];
            const extracted = extractPrimaryContact(contacts);
            primaryContact = extracted.contact;
            candidateEmails = extracted.candidateEmails;
            if (primaryContact) {
              stats.swarmtrace_contacts += 1;
              if (primaryContact.email) {
                stats.swarmtrace_emails += 1;
              }
            }
          } catch (error) {
            console.error(`Swarmtrace failed for broker ${brokerName}:`, (error as Error).message);
          }

          swarmtraceResults.push({ index, primary_contact: primaryContact, candidate_emails: candidateEmails });

          if (SWARMTRACE_DELAY_MS > 0) {
            await sleep(SWARMTRACE_DELAY_MS);
          }
        }

        const emailSet = new Set<string>();
        for (const item of swarmtraceResults) {
          for (const email of item.candidate_emails) {
            if (email && email.length > 3) {
              emailSet.add(email.toLowerCase());
            }
          }
        }
        const emailBatch = Array.from(emailSet).map((email) => ({ email }));

        const verifiedEmails = new Set<string>();

        if (emailBatch.length > 0) {
          const jobId = await neverbounceCreate(emailBatch);
          await sleep(5000);
          let status = await neverbounceStatus(jobId);
          let attempts = 0;
          while (!["complete", "completed"].includes(status) && attempts < 10) {
            await sleep(10000);
            status = await neverbounceStatus(jobId);
            attempts += 1;
          }

          if (["complete", "completed"].includes(status)) {
            const results = await neverbounceResults(jobId);
            for (const result of results) {
              const verificationResult =
                result?.result ??
                result?.verification?.result ??
                result?.status ??
                null;
              const email =
                result?.email ??
                result?.data?.email ??
                result?.verification?.address_info?.normalized_email ??
                null;

              if (verificationResult === "valid" && typeof email === "string") {
                verifiedEmails.add(email.toLowerCase());
              }
            }
            stats.neverbounce_valid = verifiedEmails.size;
          }
        }

        const leadsToInsert = propertyArray.map((property, index) => {
          const radarId = pickFirstString(property, ["RadarID", "radar_id", "RadarId"]);
          const address =
            pickFirstString(property, ["PropertyAddress", "address_line1", "address", "Address"]) ??
            property?.PropertyAddress?.Street ??
            property?.PropertyAddress?.street ??
            null;
          const city =
            pickFirstString(property, ["PropertyCity", "city", "City"]) ??
            property?.PropertyAddress?.City ??
            property?.PropertyAddress?.city ??
            null;
          const state =
            pickFirstString(property, ["PropertyState", "state", "State"]) ??
            property?.PropertyAddress?.State ??
            property?.PropertyAddress?.state ??
            null;
          const zip =
            pickFirstString(property, ["PropertyZip", "zip", "Zip", "ZipFive"]) ??
            property?.PropertyAddress?.Zip ??
            property?.PropertyAddress?.zip ??
            null;

          const propertyValue = pickFirstNumber(property, [
            "AVM",
            "EstimatedValue",
            "PropertyValue",
            "EstimatedMarketValue",
            "Value",
            "TotalValue",
          ]);
          const estimatedEquity = pickFirstNumber(property, [
            "AvailableEquity",
            "EstimatedEquity",
            "Equity",
          ]);
          const totalLoanBalance = pickFirstNumber(property, ["TotalLoanBalance", "LoanBalance"]);
          const isFreeAndClear = Boolean(property?.isFreeAndClear ?? property?.IsFreeAndClear ?? false);
          const inForeclosure = Boolean(property?.inForeclosure ?? property?.InForeclosure ?? false);
          const inPreforeclosure = Boolean(property?.isPreforeclosure ?? property?.IsPreforeclosure ?? false);
          const inTaxDelinquency = Boolean(property?.inTaxDelinquency ?? property?.InTaxDelinquency ?? false);
          const lastTransferRecDate = pickFirstString(property, [
            "LastTransferRecDate", "LastTransferDate", "LastSaleDate",
          ]);
          const yearsOwned = computeYearsOwned(lastTransferRecDate);
          const equityPercent = computeEquityPercent(estimatedEquity, propertyValue);
          const campaignArchetype = chooseCampaignArchetype({
            isFreeAndClear,
            totalLoanBalance,
            equityPercent,
            estimatedEquity,
            inForeclosure,
            inPreforeclosure,
            inTaxDelinquency,
            yearsOwned,
          });

          const contact = swarmtraceResults[index]?.primary_contact ?? null;
          const candidates = swarmtraceResults[index]?.candidate_emails ?? [];
          // Pick the highest-ranked email that passed NeverBounce validation
          const verifiedEmail = candidates.find((e) => verifiedEmails.has(e)) ?? null;

          return {
            radar_id: radarId,
            first_name: contact?.first_name ?? null,
            last_name: contact?.last_name ?? null,
            primary_email: verifiedEmail,
            primary_phone: contact?.phone ?? null,
            property_address: address,
            property_city: city,
            property_state: state,
            property_zip: zip,
            assigned_broker_id: brokerId,
            property_value: propertyValue,
            estimated_equity: estimatedEquity,
            campaign_archetype: campaignArchetype,
            radar_property_data: property,
            radar_api_version: "v1",
            updated_at: nowIso,
          };
        });

        if (leadsToInsert.length > 0) {
          stats.leads_attempted_insert = leadsToInsert.length;
          const { error: insertError } = await supabase
            .from("leads")
            .upsert(leadsToInsert, { onConflict: "addr_hash", ignoreDuplicates: true, returning: "minimal" });
          if (insertError) {
            throw new Error(`Lead insert failed: ${insertError.message}`);
          }
        }
      }

      // Always advance the cursor for pages we fetched, even if all IDs are duplicates,
      // so we don't get stuck on the same page.
      if (radarIds.length > 0) {
        const { error: offsetError } = await supabase.rpc("update_broker_offset", {
          p_broker_id: brokerId,
          p_increment: radarIds.length,
        });
        if (offsetError) {
          throw new Error(`update_broker_offset failed: ${offsetError.message}`);
        }
      }
    }
  }

  const { data: campaignRows, error: campaignError } = await supabase
    .from("campaigns")
    .select("archetype, instantly_campaign_id, challenger_campaign_id")
    .eq("active", true);
  if (campaignError) {
    throw new Error(`Campaign fetch failed: ${campaignError.message}`);
  }
  const campaignMap = new Map(
    (campaignRows ?? [])
      .filter((row: any) => row?.archetype && row?.instantly_campaign_id)
      .map((row: any) => [row.archetype, row.instantly_campaign_id]),
  );
  const challengerMap = new Map(
    (campaignRows ?? [])
      .filter((row: any) => row?.archetype && row?.challenger_campaign_id)
      .map((row: any) => [row.archetype, row.challenger_campaign_id]),
  );

  const startOfDay = startOfTodayInPT().toISOString();
  const { data: uploadableLeads, error: uploadError } = await supabase
    .from("leads")
    .select(
      `id, first_name, last_name, primary_email, property_address, property_city, property_value, estimated_equity, campaign_archetype, radar_property_data, calculator_tokens(token)`,
    )
    .eq("assigned_broker_id", brokerId)
    .gte("created_at", startOfDay)
    .or("campaign_status.eq.new,campaign_status.is.null")
    .not("primary_email", "is", null);
  if (uploadError) {
    throw new Error(`Uploadable leads fetch failed: ${uploadError.message}`);
  }
  stats.uploadable_leads = uploadableLeads?.length ?? 0;

  if (uploadableLeads && uploadableLeads.length > 0) {
    const grouped: Record<string, any[]> = {};
    for (const lead of uploadableLeads) {
      const archetype = lead.campaign_archetype ?? "delay_ss";
      if (!grouped[archetype]) grouped[archetype] = [];
      grouped[archetype].push(lead);
    }

    for (const [archetype, leads] of Object.entries(grouped)) {
      const campaignId = campaignMap.get(archetype);
      if (!campaignId) {
        console.warn(`Missing Instantly campaign for archetype ${archetype}`);
        continue;
      }

      const formattedLeads = leads.map((lead) => {
        const propertyValue = Number(lead.property_value ?? 0) || null;
        const estimatedEquity = Number(lead.estimated_equity ?? 0) || null;
        const equityPercent = computeEquityPercent(estimatedEquity, propertyValue);
        const radarData = lead.radar_property_data && typeof lead.radar_property_data === "object"
          ? lead.radar_property_data
          : null;
        const loanBalance = radarData
          ? pickFirstNumber(radarData, ["TotalLoanBalance", "LoanBalance", "TotalMortgageBalance"])
          : null;
        const lastTransferDate = radarData
          ? pickFirstString(radarData, ["LastTransferRecDate", "LastTransferDate", "LastSaleDate"])
          : null;
        const rate = getMortgageRate(parseYear(lastTransferDate));
        const monthlyPayment = estimateMonthlyPayment(loanBalance, rate);
        const monthlyPaymentFormatted = monthlyPayment === null ? "" : formatCurrency(monthlyPayment);
        const calculatorToken = Array.isArray(lead.calculator_tokens) && lead.calculator_tokens.length > 0
          ? lead.calculator_tokens[0].token
          : null;
        const calculatorLink = calculatorToken
          ? `https://www.equityconnectguide.com/calculator?t=${calculatorToken}`
          : "";

        const safeName = safeFirstName(lead.first_name, lead.primary_email);

        return {
          email: lead.primary_email,
          first_name: safeName,
          last_name: lead.last_name ?? "",
          custom_variables: {
            firstName: safeName,
            calculatorLink,
            property_address: lead.property_address ?? "",
            property_city: lead.property_city ?? "",
            property_value: formatCurrency(propertyValue),
            property_value_range: formatRange(propertyValue),
            estimated_equity: formatCurrency(estimatedEquity),
            equity_50_percent: formatCurrency(Math.round((estimatedEquity ?? 0) * 0.5)),
            equity_60_percent: formatCurrency(Math.round((estimatedEquity ?? 0) * 0.6)),
            equity_formatted_short: formatShortCurrency(estimatedEquity),
            equity_percent: equityPercent ? `${Math.round(equityPercent)}%` : "",
            estimated_monthly_payment: monthlyPaymentFormatted,
            broker_name: broker.company_name ?? broker.contact_name ?? "",
            broker_nmls: broker.nmls_number ? `NMLS #${broker.nmls_number}` : "",
            campaign_name: archetype,
          },
        };
      });

      const challengerId = challengerMap.get(archetype);
      if (challengerId) {
        const shuffled = formattedLeads.sort(() => Math.random() - 0.5);
        const half = Math.ceil(shuffled.length / 2);
        const baselineLeads = shuffled.slice(0, half);
        const challengerLeads = shuffled.slice(half);
        if (baselineLeads.length > 0) await uploadToInstantly(campaignId, baselineLeads);
        if (challengerLeads.length > 0) await uploadToInstantly(challengerId, challengerLeads);
        stats.uploaded_to_instantly += formattedLeads.length;
        stats.campaign_breakdown[archetype] = (stats.campaign_breakdown[archetype] ?? 0) + baselineLeads.length;
        stats.campaign_breakdown[`${archetype}_challenger`] = (stats.campaign_breakdown[`${archetype}_challenger`] ?? 0) + challengerLeads.length;
      } else {
        await uploadToInstantly(campaignId, formattedLeads);
        stats.uploaded_to_instantly += formattedLeads.length;
        stats.campaign_breakdown[archetype] = (stats.campaign_breakdown[archetype] ?? 0) + formattedLeads.length;
      }

      if (INSTANTLY_DELAY_MS > 0) {
        await sleep(INSTANTLY_DELAY_MS);
      }
    }
  }

  await supabase
    .from("leads")
    .update({ campaign_status: "active", added_to_campaign_at: nowIso })
    .eq("assigned_broker_id", brokerId)
    .gte("created_at", startOfDay)
    .or("campaign_status.eq.new,campaign_status.is.null");

  const { count: totalCount, error: countTotalError } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("assigned_broker_id", brokerId)
    .gte("created_at", startOfDay);
  if (countTotalError) {
    throw new Error(`Lead count failed: ${countTotalError.message}`);
  }
  const totalLeadsToday = totalCount ?? 0;
  const newSurplus = Math.max(totalLeadsToday - (broker.daily_lead_capacity ?? 0), 0);

  const { error: surplusError } = await supabase
    .from("brokers")
    .update({ daily_lead_surplus: newSurplus })
    .eq("id", brokerId);
  if (surplusError) {
    throw new Error(`Surplus update failed: ${surplusError.message}`);
  }

  stats.valid_email_rate = percent(stats.neverbounce_valid, stats.swarmtrace_emails);
  stats.upload_rate = percent(stats.uploaded_to_instantly, stats.radar_ids);

  return stats;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const missing = ensureConfig();
  if (missing.length > 0) {
    return jsonResponse({ error: "missing_config", missing }, 500);
  }

  const internalHeader = req.headers.get("X-Internal-Token");
  if (!internalHeader || internalHeader !== INTERNAL_TOKEN) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const debug = new URL(req.url).searchParams.get("debug") === "1";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: brokers, error } = await supabase
    .from("brokers")
    .select(
      "id, company_name, contact_name, nmls_number, propertyradar_list_id, propertyradar_offset, daily_lead_capacity, daily_lead_surplus",
    )
    .eq("status", "active");

  if (error) {
    return jsonResponse({ error: "broker_fetch_failed", message: error.message }, 500);
  }

  const results: Array<{ broker_id: string; broker_name: string; status: string; error?: string; stats?: BrokerRunStats }> = [];

  for (const broker of brokers ?? []) {
    const brokerName = broker.company_name ?? broker.contact_name ?? "Unknown";
    try {
      const stats = await processBroker(broker as Broker, supabase, debug);
      results.push({
        broker_id: broker.id,
        broker_name: brokerName,
        status: "ok",
        stats,
      });
    } catch (err) {
      results.push({
        broker_id: broker.id,
        broker_name: brokerName,
        status: "error",
        error: (err as Error).message,
      });
    }
  }

  // Slack summary
  if (SLACK_WEBHOOK_URL) {
    try {
      const totalStats = {
        radar_ids: 0,
        new_leads: 0,
        emails_found: 0,
        valid_emails: 0,
        uploaded: 0,
      };
      const campaignBreakdown: Record<string, number> = {};

      for (const r of results) {
        if (r.stats) {
          totalStats.radar_ids += r.stats.radar_ids;
          totalStats.new_leads += r.stats.new_radar_ids;
          totalStats.emails_found += r.stats.swarmtrace_emails;
          totalStats.valid_emails += r.stats.neverbounce_valid;
          totalStats.uploaded += r.stats.uploaded_to_instantly;
          for (const [archetype, count] of Object.entries(r.stats.campaign_breakdown ?? {})) {
            campaignBreakdown[archetype] = (campaignBreakdown[archetype] ?? 0) + count;
          }
        }
      }

      const errors = results.filter((r) => r.status === "error");

      const lines = [
        `*Daily Lead Puller Summary*`,
        `Brokers: ${results.length} processed`,
        ``,
        `*Pipeline:*`,
        `PropertyRadar IDs: ${totalStats.radar_ids}`,
        `New leads: ${totalStats.new_leads}`,
        `Emails found: ${totalStats.emails_found}`,
        `Valid emails: ${totalStats.valid_emails}`,
        `Uploaded to Instantly: ${totalStats.uploaded}`,
      ];

      const archetypeEntries = Object.entries(campaignBreakdown);
      if (archetypeEntries.length > 0) {
        lines.push("", `*Campaigns:*`);
        for (const [archetype, count] of archetypeEntries.sort((a, b) => b[1] - a[1])) {
          lines.push(`  ${archetype}: ${count}`);
        }
      }

      if (errors.length > 0) {
        lines.push("", `*Errors (${errors.length}):*`);
        for (const e of errors) {
          lines.push(`- ${e.broker_name}: ${e.error}`);
        }
      }

      await fetch(SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: lines.join("\n") }),
      });
    } catch (e) {
      console.error("Slack notify error:", e);
    }
  }

  return jsonResponse({ status: "ok", processed: results.length, results }, 200);
});
