/**
 * Hand-written `Database` row types for the HausBoss schema.
 *
 * Source of truth: server/db/migrations/0002_baseline_schema.sql and
 * 20260902000002_security_hardening.sql. Keep this file in sync with the
 * migrations; the shape follows the common `Row / Insert / Update` convention so
 * a generated file can replace it later without touching the services.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** Insert shape: required columns + everything else optional. */
type InsertOf<Row, Required extends keyof Row> = Pick<Row, Required> & Partial<Omit<Row, Required>>;

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export type ProfileRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  is_active: boolean;
  company_id: string;
  phone: string | null;
  color: string | null;
  skills: string[] | null;
  tools: string[] | null;
  photo_url: string | null;
  job_role: string | null;
  company_position: string | null;
  managed_by: string | null;
  company_address: string | null;
  company_name: string | null;
  industry: string | null;
  team_size: string | null;
  created_at: string;
  updated_at: string;
}

export type UserRoleRow = {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export type JobRow = {
  id: string;
  company_id: string;
  customer_id: string | null;
  client_name: string;
  client_salutation: string | null;
  client_first_name: string | null;
  client_last_name: string | null;
  client_company_name: string | null;
  client_phone: string;
  client_phone_type: string | null;
  client_phone2: string | null;
  client_phone2_type: string | null;
  client_email: string | null;
  client_email_type: string | null;
  client_email2: string | null;
  client_email2_type: string | null;
  client_address: string;
  billing_name: string | null;
  billing_company_name: string | null;
  billing_first_name: string | null;
  billing_last_name: string | null;
  billing_address: string | null;
  billing_phone: string | null;
  billing_email: string | null;
  business_unit_id?: string | null;
  division?: string | null;
  job_details: string;
  important_details: string | null;
  service_type: string | null;
  category: string | null;
  duration_minutes?: number | null;
  assigned_to: string | null;
  assigned_user_id: string | null;
  status: string;
  priority: string | null;
  scheduled_date: string | null;
  scheduled_at: string | null;
  metadata: Json | null;
  media_urls: Json;
  sort_order: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** QuickBooks invoice mirror (written by the server only). */
  invoice_status?: 'invoiced' | 'partially_paid' | 'paid' | 'voided' | null;
  invoice_total?: string | number | null;
  invoice_balance?: string | number | null;
  invoice_number?: string | null;
  invoice_updated_at?: string | null;
}

export type JobMessageRow = {
  id: string;
  job_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  is_from_note: boolean;
  attachments: Json;
  created_at: string;
}

export type JobActivityLogRow = {
  id: string;
  job_id: string;
  company_id: string | null;
  user_id: string;
  activity_type: string;
  entity_type: string | null;
  entity_id: string | null;
  old_values: Json | null;
  new_values: Json | null;
  description: string;
  metadata: Json | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export type EstimateRow = {
  id: string;
  job_id: string;
  company_id: string;
  estimate_number: string;
  title: string;
  description: string | null;
  status: EstimateStatus;
  created_by: string;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  sent_by: string | null;
  sent_at: string | null;
  responded_at: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  subtotal_parts: number;
  subtotal_services: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  public_token: string;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export type EstimateLineItemRow = {
  id: string;
  estimate_id: string;
  kind: LineItemKind;
  name: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unit_price: number;
  line_total: number;
  sort_order: number;
  catalog_item_id: string | null;
  created_at: string;
}

export type CustomerRow = {
  id: string;
  company_id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  email2: string | null;
  phone: string | null;
  phone2: string | null;
  preferred_contact: string | null;
  address: string | null;
  billing_name: string | null;
  billing_company_name: string | null;
  billing_first_name: string | null;
  billing_last_name: string | null;
  billing_address: string | null;
  billing_phone: string | null;
  billing_email: string | null;
  business_unit_id?: string | null;
  division?: string | null;
  tags: string[];
  notes: string | null;
  is_active: boolean | null;
  salutation: string | null;
  first_name: string | null;
  last_name: string | null;
  phone_e164?: string | null;
  phone2_e164?: string | null;
  sms_opted_out_at?: string | null;
  sms_consent_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type CustomerEquipmentRow = {
  id: string;
  customer_id: string;
  company_id: string;
  equipment_type: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  location: string | null;
  install_date: string | null;
  warranty_expires: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ServiceAgreementRow = {
  id: string;
  customer_id: string;
  company_id: string;
  plan_name: string;
  frequency: string;
  visits_per_year: number;
  price: number;
  start_date: string;
  end_date: string | null;
  next_service_date: string | null;
  is_active: boolean | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CustomerRequestRow = {
  id: string;
  company_id: string;
  client_name: string;
  client_phone: string;
  client_email: string | null;
  client_address: string;
  job_details: string;
  source: string | null;
  status: LeadStatus;
  distance: number | null;
  preferred_date: string | null;
  created_at: string;
  updated_at: string;
}

export type NotificationRow = {
  id: string;
  recipient_id: string;
  company_id: string;
  job_id: string | null;
  type: string;
  title: string;
  body: string | null;
  metadata: Json | null;
  read_at: string | null;
  created_at: string;
}

export type UserLocationRow = {
  user_id: string;
  company_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  captured_at: string;
  updated_at: string;
}

export type CatalogItemRow = {
  id: string;
  company_id: string;
  kind: LineItemKind;
  name: string;
  description: string | null;
  unit: string | null;
  unit_price: number;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export type JobCategoryRow = {
  id: string;
  company_id: string;
  label: string;
  sort_order: number | null;
  is_active: boolean;
  created_at: string;
}

export type InventoryItemRow = {
  id: string;
  company_id: string;
  technician_id: string | null;
  name: string;
  sku: string | null;
  unit: string | null;
  quantity: number;
  min_quantity: number;
  unit_cost: number | null;
  created_at: string;
  updated_at: string;
}

export type CompanySecretRow = {
  id: string;
  company_id: string;
  google_maps_api_key: string | null;
  created_at: string;
  updated_at: string;
}

export type CouponCodeRow = {
  id: string;
  code: string;
  expires_at: string;
  redeemed_by: string | null;
  redeemed_at: string | null;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
}

export type PublicRateLimitRow = {
  key: string;
  window_start: string;
  hits: number;
}

export type CompanySubscriptionRow = {
  company_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: SubscriptionStatus;
  tier: SubscriptionTier | null;
  source: 'stripe' | 'coupon' | 'manual';
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export type JobTimeEntryRow = {
  id: string;
  job_id: string;
  company_id: string;
  user_id: string | null;
  entry_type: 'start' | 'stop' | 'complete';
  occurred_at: string;
  note: string | null;
  source: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Enums / literal unions
// ---------------------------------------------------------------------------

export type AppRole = 'admin' | 'manager' | 'contractor' | 'superadmin';

export type EstimateStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'void';

export type LineItemKind = 'part' | 'service';
export type LeadStatus = 'pending' | 'scheduled' | 'rejected';
export type SubscriptionTier = 'individual' | 'monthly' | 'yearly' | 'lifetime';
export type SubscriptionStatus =
  | 'none'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused'
  | 'lifetime';

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: InsertOf<ProfileRow, 'id' | 'email' | 'company_id'>;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      user_roles: {
        Row: UserRoleRow;
        Insert: InsertOf<UserRoleRow, 'user_id' | 'role'>;
        Update: Partial<UserRoleRow>;
        Relationships: [];
      };
      jobs: {
        Row: JobRow;
        Insert: InsertOf<JobRow, 'company_id' | 'client_name' | 'client_phone' | 'client_address' | 'job_details'>;
        Update: Partial<JobRow>;
        Relationships: [];
      };
      job_messages: {
        Row: JobMessageRow;
        Insert: InsertOf<JobMessageRow, 'job_id' | 'sender_id' | 'sender_name' | 'content'>;
        Update: Partial<JobMessageRow>;
        Relationships: [];
      };
      job_activity_logs: {
        Row: JobActivityLogRow;
        Insert: InsertOf<JobActivityLogRow, 'job_id' | 'user_id' | 'activity_type' | 'description'>;
        Update: Partial<JobActivityLogRow>;
        Relationships: [];
      };
      estimates: {
        Row: EstimateRow;
        Insert: InsertOf<EstimateRow, 'job_id' | 'company_id' | 'title' | 'created_by'>;
        Update: Partial<EstimateRow>;
        Relationships: [];
      };
      estimate_line_items: {
        Row: EstimateLineItemRow;
        Insert: InsertOf<Omit<EstimateLineItemRow, 'line_total'>, 'estimate_id' | 'kind' | 'name'>;
        Update: Partial<Omit<EstimateLineItemRow, 'line_total'>>;
        Relationships: [];
      };
      customers: {
        Row: CustomerRow;
        Insert: InsertOf<CustomerRow, 'company_id' | 'name'>;
        Update: Partial<CustomerRow>;
        Relationships: [];
      };
      customer_equipment: {
        Row: CustomerEquipmentRow;
        Insert: InsertOf<CustomerEquipmentRow, 'customer_id' | 'company_id' | 'equipment_type'>;
        Update: Partial<CustomerEquipmentRow>;
        Relationships: [];
      };
      service_agreements: {
        Row: ServiceAgreementRow;
        Insert: InsertOf<
          ServiceAgreementRow,
          'customer_id' | 'company_id' | 'plan_name' | 'frequency' | 'visits_per_year' | 'price' | 'start_date'
        >;
        Update: Partial<ServiceAgreementRow>;
        Relationships: [];
      };
      customer_requests: {
        Row: CustomerRequestRow;
        Insert: InsertOf<CustomerRequestRow, 'company_id' | 'client_name' | 'client_phone' | 'client_address' | 'job_details'>;
        Update: Partial<CustomerRequestRow>;
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: InsertOf<NotificationRow, 'recipient_id' | 'company_id' | 'type' | 'title'>;
        Update: Partial<NotificationRow>;
        Relationships: [];
      };
      user_locations: {
        Row: UserLocationRow;
        Insert: InsertOf<UserLocationRow, 'user_id' | 'company_id' | 'latitude' | 'longitude'>;
        Update: Partial<UserLocationRow>;
        Relationships: [];
      };
      catalog_items: {
        Row: CatalogItemRow;
        Insert: InsertOf<CatalogItemRow, 'company_id' | 'kind' | 'name'>;
        Update: Partial<CatalogItemRow>;
        Relationships: [];
      };
      job_categories: {
        Row: JobCategoryRow;
        Insert: InsertOf<JobCategoryRow, 'company_id' | 'label'>;
        Update: Partial<JobCategoryRow>;
        Relationships: [];
      };
      inventory_items: {
        Row: InventoryItemRow;
        Insert: InsertOf<InventoryItemRow, 'company_id' | 'name'>;
        Update: Partial<InventoryItemRow>;
        Relationships: [];
      };
      company_secrets: {
        Row: CompanySecretRow;
        Insert: InsertOf<CompanySecretRow, 'company_id'>;
        Update: Partial<CompanySecretRow>;
        Relationships: [];
      };
      coupon_codes: {
        Row: CouponCodeRow;
        Insert: InsertOf<CouponCodeRow, 'code' | 'expires_at'>;
        Update: Partial<CouponCodeRow>;
        Relationships: [];
      };
      public_rate_limits: {
        Row: PublicRateLimitRow;
        Insert: InsertOf<PublicRateLimitRow, 'key' | 'window_start'>;
        Update: Partial<PublicRateLimitRow>;
        Relationships: [];
      };
      company_subscriptions: {
        Row: CompanySubscriptionRow;
        Insert: InsertOf<CompanySubscriptionRow, 'company_id'>;
        Update: Partial<CompanySubscriptionRow>;
        Relationships: [];
      };
      job_time_entries: {
        Row: JobTimeEntryRow;
        Insert: InsertOf<JobTimeEntryRow, 'job_id' | 'company_id' | 'entry_type' | 'occurred_at'>;
        Update: Partial<JobTimeEntryRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      get_user_company_id: { Args: { _user_id: string }; Returns: string | null };
      has_role: { Args: { _user_id: string; _role: AppRole }; Returns: boolean };
      get_user_roles: { Args: { _user_id: string }; Returns: AppRole[] };
      user_belongs_to_company: { Args: { _user_id: string; _company_id: string }; Returns: boolean };
      user_can_access_job: { Args: { _user_id: string; _job_id: string }; Returns: boolean };
      user_is_staff: { Args: { _user_id: string }; Returns: boolean };
      resolve_assigned_technician: { Args: { _company_id: string; _assigned_to: string | null }; Returns: string | null };
      get_estimate_by_token: { Args: { _token: string }; Returns: Json | null };
      job_total_minutes: { Args: { _job_id: string; _as_of?: string }; Returns: number };
      company_is_entitled: { Args: { _company_id: string }; Returns: boolean };
      check_rate_limit: { Args: { _key: string; _limit: number; _window_seconds: number }; Returns: boolean };
    };
    Enums: {
      app_role: AppRole;
    };
    CompositeTypes: { [_ in never]: never };
  };
}

// ---------------------------------------------------------------------------
// Convenience aliases (same names as the generated file)
// ---------------------------------------------------------------------------

type PublicTables = Database['public']['Tables'];

export type Tables<T extends keyof PublicTables> = PublicTables[T]['Row'];
export type TablesInsert<T extends keyof PublicTables> = PublicTables[T]['Insert'];
export type TablesUpdate<T extends keyof PublicTables> = PublicTables[T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
