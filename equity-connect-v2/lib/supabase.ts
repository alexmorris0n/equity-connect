import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mxnqfwuhvurajrgoefyg.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for our microsite data
export interface Persona {
  id: string;
  name: string;
  first_name: string;
  heritage: string;
  cultural_color_scheme: string;
  primary_language: string;
  cultural_organization: string | null;
  theme: string;
  local_references: string[];
  trust_builders: string[];
  professional_image_url: string | null;
  og_image_url: string | null;
  licenses: string[];
  certifications: string[];
  awards: string[];
  testimonial_count: number;
  years_in_business: string | null;
  google_rating: string | null;
  bio: string | null;
  video_url: string | null;
  active: boolean;
}

export interface Neighborhood {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  zip_codes: string[];
  lat: number | null;
  lng: number | null;
  avg_home_value: number | null;
  appreciation_rate: number | null;
  avg_equity_available: number | null;
  families_helped: number;
  landmarks: any[];
  demographics: any;
  hero_image_url: string | null;
  cultural_highlights: string[];
  active: boolean;
}

export interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  property_address: string | null;
  property_city: string | null;
  property_state: string | null;
  property_zip: string | null;
  property_value: number | null;
  estimated_equity: number | null;
  age: number | null;
  assigned_persona: string | null;
  persona_heritage: string | null;
  microsite_url: string | null;
}

export interface Microsite {
  id: string;
  lead_id: string | null;
  subdomain: string;
  full_url: string;
  persona: string | null;
  neighborhood: string | null;
  persona_id: string | null;
  neighborhood_id: string | null;
  visits: number;
  unique_visitors: number;
  calculator_completions: number;
  form_submissions: number;
  deployment_status: 'pending' | 'deployed' | 'failed' | 'updated';
  created_at: string;
  updated_at: string;
}

