/**
 * UI-facing domain types.
 *
 * Contract (PROJECT_HANDOFF §13): `jobs` are converted to camelCase in exactly
 * one place (src/services/adapters/jobAdapter.ts). `estimates`, `notifications`,
 * `job_messages` and `customers` are consumed RAW (snake_case) by the UI, so
 * those aliases point straight at the database Row types.
 */

import type {
  AppRole,
  CatalogItemRow,
  CompanySubscriptionRow,
  CustomerEquipmentRow,
  CustomerRequestRow,
  CustomerRow,
  EstimateLineItemRow,
  EstimateRow,
  EstimateStatus,
  InventoryItemRow,
  JobActivityLogRow,
  JobCategoryRow,
  JobMessageRow,
  LeadStatus,
  LineItemKind,
  NotificationRow,
  ProfileRow,
  ServiceAgreementRow,
  SubscriptionStatus,
  SubscriptionTier,
  UserLocationRow,
} from '@/api/dbTypes';

export type { AppRole, EstimateStatus, LeadStatus, LineItemKind, SubscriptionStatus, SubscriptionTier };

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

/** Hyphenated, lowercase — also used as CSS class suffixes (`status-en-route`). */
export type JobStatus = 'pending' | 'accepted' | 'en-route' | 'arrived' | 'in-progress' | 'completed';

export type JobPriority = 'low' | 'medium' | 'high' | 'urgent' | string;

export type TimeEntryType = 'start' | 'stop' | 'complete';

export interface TimeEntry {
  type: TimeEntryType;
  /** ISO-8601 instant (UTC). The viewer's local date is recomputed from this. */
  timestamp: string;
  /** Legacy stored date — ignored by the time math (§14). */
  date?: string;
  userId?: string;
  notes?: string;
}

export interface GpsPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export type MediaTag = 'pre' | 'post';

export interface MediaItem {
  url: string;
  path: string;
  type: string;
  name: string;
  timestamp: string;
  gps?: GpsPoint | null;
  tag?: MediaTag;
  uploadedBy?: string;
}

export interface JobActivityEntry {
  type: string;
  timestamp: string;
  userId?: string;
  userName?: string;
  description?: string;
}

export interface Job {
  id: string;
  companyId: string;
  customerId: string;
  clientName: string;
  clientSalutation: string;
  clientCompanyName?: string;
  clientFirstName: string;
  clientLastName: string;
  clientAddress: string;
  clientPhone: string;
  clientPhoneType: string;
  clientPhone2: string;
  clientPhone2Type: string;
  clientEmail: string;
  clientEmailType: string;
  clientEmail2: string;
  clientEmail2Type: string;
  billingName: string;
  billingCompanyName?: string;
  billingFirstName?: string;
  billingLastName?: string;
  billingAddress: string;
  billingPhone: string;
  billingEmail: string;
  businessUnitId?: string | null;
  division?: Division | null;
  jobDetails: string;
  importantDetails: string;
  serviceType: string;
  category: string;
  /** Length on the calendar in minutes; null = the standard 2-hour window. */
  durationMinutes?: number | null;
  /** Display-name string (legacy). Prefer `assignedUserId`. */
  assignedTo: string;
  assignedUserId: string | null;
  status: JobStatus;
  priority: string;
  /** ISO instant or '' when unscheduled. Single source of truth for dates. */
  scheduledDate: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  notes: string;
  activity: JobActivityEntry[];
  timeEntries: TimeEntry[];
  mediaUrls: MediaItem[];
  sortOrder: number | null;
  /** Any other keys stored in `metadata` are preserved for round-tripping. */
  metadata: Record<string, unknown>;
  /** QuickBooks invoice mirror (server-maintained; absent until a job is invoiced). */
  invoiceStatus?: JobInvoiceStatus | null;
  invoiceTotal?: number | null;
  invoiceBalance?: number | null;
  invoiceNumber?: string | null;
}

export type JobInvoiceStatus = 'invoiced' | 'partially_paid' | 'paid' | 'voided';

/** Fields accepted when creating a job from the job creation form. */
export interface JobCreateInput {
  clientName?: string;
  clientSalutation?: string;
  clientCompanyName?: string;
  clientFirstName?: string;
  clientLastName?: string;
  clientAddress: string;
  clientPhone: string;
  clientPhoneType?: string;
  clientPhone2?: string;
  clientPhone2Type?: string;
  clientEmail?: string;
  clientEmailType?: string;
  clientEmail2?: string;
  clientEmail2Type?: string;
  billingName?: string;
  billingCompanyName?: string;
  billingFirstName?: string;
  billingLastName?: string;
  billingAddress?: string;
  billingPhone?: string;
  billingEmail?: string;
  businessUnitId?: string | null;
  division?: Division | null;
  jobDetails: string;
  importantDetails?: string;
  serviceType?: string;
  category?: string;
  durationMinutes?: number | null;
  assignedTo?: string;
  assignedUserId?: string | null;
  status?: JobStatus;
  priority?: string;
  scheduledDate?: string | null;
  notes?: string;
  mediaUrls?: MediaItem[];
  customerId?: string;
  sortOrder?: number | null;
}

export type JobUpdateInput = Partial<Omit<Job, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>>;

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export type DisplayRole = 'admin' | 'manager' | 'technician' | 'superadmin';

export interface Employee {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: AppRole;
  /** `contractor` renders as "technician" everywhere in the UI. */
  displayRole: DisplayRole;
  color: string;
  isActive: boolean;
  photoUrl: string;
  skills: string[];
  tools: string[];
  jobRole: string;
  companyPosition: string;
  companyId: string;
}

export type Profile = ProfileRow;

export interface UserProfileBundle {
  profile: ProfileRow;
  roles: AppRole[];
}

export interface CompanyProfile {
  id: string;
  /** Owner's first_name + last_name (legacy) unless `company_name` is set. */
  name: string;
  companyName: string;
  email: string;
  phone: string;
  address: string;
  industry: string;
  teamSize: string;
  ownerId: string;
  /** Effective key used by maps/autocomplete (company override or platform default). */
  googleMapsApiKey: string | null;
  /** The company's own override, if any (what the settings form edits). */
  ownGoogleMapsApiKey: string | null;
  /** Company Telnyx toll-free number (customers only ever see this number). */
  sms: CompanySms;
  /** Residential / Commercial settings: legal name on customer messages and own texting number. */
  divisions: DivisionSettings[];
  /** Service lines picked on customers and jobs (e.g. "HVAC Commercial - Install"). */
  businessUnits: BusinessUnit[];
  /** Set when the company must act on its own keys (grace ending / central keys no longer allowed). */
  keysNotice?: KeysNotice | null;
}

export interface CompanySms {
  number: string | null;
  profileId: string | null;
  configured: boolean;
}

export type Division = 'residential' | 'commercial';

/** A division's legal name (shown to its customers) and own Telnyx number (null = the main number). */
export interface DivisionSettings {
  division: Division;
  legalName: string | null;
  telnyxNumber: string | null;
  telnyxProfileId: string | null;
}

/** A service line; division null = either (chosen on the customer / job). */
export interface BusinessUnit {
  id: string;
  name: string;
  division: Division | null;
  /** Every job of this unit gets this service type (e.g. "Install"); null = typed on the job. */
  serviceType: string | null;
  /** Every job of this unit gets this category; null = picked on the job. */
  category: string | null;
  /** Every job of this unit is this long (minutes); null = picked on the job (default 2 h). */
  durationMinutes: number | null;
  sortOrder: number;
}

export interface CompanyOnboardingInput {
  companyName: string;
  email?: string;
  phone?: string;
  address?: string;
  industry?: string;
  teamSize?: string;
  googleMapsApiKey?: string;
  /** Admin only: null clears. */
  telnyxNumber?: string | null;
  telnyxProfileId?: string | null;
}

export interface Subscription {
  companyId: string;
  status: SubscriptionStatus;
  tier: SubscriptionTier | null;
  source: 'stripe' | 'coupon' | 'manual';
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  isEntitled: boolean;
}

export type SubscriptionPlan = 'individual' | 'monthly' | 'yearly' | 'lifetime';

export type DiscountDuration = 'once' | 'forever' | 'repeating';
export type DiscountStatus = 'scheduled' | 'active' | 'expired' | 'used_up' | 'disabled';

/** Superadmin view of a discount code. */
export interface DiscountCode {
  id: string;
  code: string;
  percent_off: number;
  starts_at: string;
  ends_at: string;
  max_uses: number | null;
  plans: SubscriptionPlan[];
  duration: DiscountDuration;
  duration_months: number | null;
  active: boolean;
  used: number;
  status: DiscountStatus;
  created_at: string;
}

export interface DiscountCodeInput {
  code: string;
  percent_off: number;
  starts_at: string;
  ends_at: string;
  max_uses: number | null;
  plans: SubscriptionPlan[];
  duration: DiscountDuration;
  duration_months: number | null;
}

export interface DiscountRedemption {
  id: string;
  company_id: string;
  company_name: string | null;
  email: string | null;
  plan: string;
  amount_off_cents: number;
  created_at: string;
}

/** POST /billing/discounts/check: what a typed coupon code does. */
export type CouponCodeCheck =
  | { valid: true; kind: 'discount'; code: string; percent_off: number; plans: SubscriptionPlan[]; duration: DiscountDuration; duration_months: number | null; ends_at: string; message: string }
  | { valid: true; kind: 'lifetime'; code: string; message: string }
  | { valid: false; message: string };

/** GET /billing/seats: users on the team vs what the plan allows. */
export interface SeatStatus {
  enabled: boolean;
  plan: SubscriptionPlan | null;
  /** Users the package includes (or the individual plan pays for). */
  included: number;
  extra_users: number;
  /** Lifetime: extra users bought once. */
  lifetime_seats: number;
  seats: number;
  used: number;
  over_limit: boolean;
  seat_price_cents: number | null;
  /** 'once' = a Lifetime seat paid once; 'month' = a monthly extra user. */
  seat_price_interval: 'month' | 'once';
  override: number | null;
}

// ---------------------------------------------------------------------------
// Raw (snake_case) entities consumed as-is by the UI
// ---------------------------------------------------------------------------

export type Estimate = EstimateRow;
export type EstimateLineItem = EstimateLineItemRow;
export type Customer = CustomerRow;
export type CustomerEquipment = CustomerEquipmentRow;
export type ServiceAgreement = ServiceAgreementRow;
export type CustomerRequest = CustomerRequestRow;
export type AppNotification = NotificationRow;
export type JobMessage = JobMessageRow;
export type ActivityLog = JobActivityLogRow;
export type CatalogItem = CatalogItemRow;
export type JobCategory = JobCategoryRow;
export type InventoryItem = InventoryItemRow;
export type UserLocation = UserLocationRow;
export type CompanySubscription = CompanySubscriptionRow;

export type NotificationType = 'chat_message' | 'status_change' | 'job_updated' | string;

// ---------------------------------------------------------------------------
// Estimates (editor inputs)
// ---------------------------------------------------------------------------

export interface EstimateLineItemInput {
  id?: string;
  kind: LineItemKind;
  name: string;
  description?: string | null;
  quantity: number;
  unit?: string | null;
  unit_price: number;
  sort_order?: number;
  catalog_item_id?: string | null;
}

export interface EstimateSaveInput {
  id?: string;
  job_id: string;
  company_id: string;
  title: string;
  description?: string | null;
  status?: EstimateStatus;
  client_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  client_address?: string | null;
  discount_amount?: number;
  tax_rate?: number;
  notes?: string | null;
  valid_until?: string | null;
  submitted_by?: string | null;
  submitted_at?: string | null;
  items: EstimateLineItemInput[];
}

/** Shape returned by the `get-public-estimate` edge function. */
export interface PublicEstimate extends EstimateRow {
  line_items: EstimateLineItemRow[];
  company?: { name: string; email: string | null; phone: string | null; address: string | null };
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export interface PublicRequestInput {
  companyId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  clientAddress: string;
  jobDetails: string;
  preferredDate?: string;
  source?: string;
  /** Honeypot — must stay empty. */
  website?: string;
}

export interface ScheduleLeadInput {
  scheduledDate: string;
  assignedTo?: string;
  assignedUserId?: string | null;
  category?: string;
  serviceType?: string;
  priority?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimeChange<T> {
  eventType: RealtimeEventType;
  new: T | null;
  old: Partial<T> | null;
  /** Source table when a channel carries more than one (e.g. `sms:company:<id>`). */
  table?: string;
}

export type Unsubscribe = () => void;

// ---------------------------------------------------------------------------
// SMS conversations (Telnyx; one toll-free number per company)
// ---------------------------------------------------------------------------

export type SmsDirection = 'inbound' | 'outbound';
export type SmsConversationStatus = 'open' | 'resolved';
export type SmsMessageStatus = 'received' | 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';

/** `GET /conversations` row (snake_case straight from the API, like `Customer`). */
export interface SmsConversation {
  id: string;
  company_id: string;
  customer_id: string | null;
  /** E.164 */
  customer_phone: string;
  active_job_id: string | null;
  assigned_user_id: string | null;
  /** Set when the thread runs through another business unit's number. */
  division?: Division | null;
  status: SmsConversationStatus;
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_direction: SmsDirection | null;
  created_at: string;
  updated_at: string;
  customer_name: string | null;
  assigned_name: string | null;
  job_client_name: string | null;
  job_status: string | null;
  sms_opted_out: boolean;
}

export interface SmsMessage {
  id: string;
  company_id: string;
  conversation_id: string;
  direction: SmsDirection;
  from_number: string;
  to_number: string;
  body: string;
  telnyx_message_id: string | null;
  status: SmsMessageStatus;
  error: string | null;
  sent_by: string | null;
  job_id: string | null;
  created_at: string;
  updated_at: string;
  sender_name: string | null;
}

export type SmsListFilter = 'open' | 'resolved' | 'all';

/** Realtime payload on `sms:company:<id>`; conversation rows arrive without the joined *_name fields. */
export type SmsRealtimeChange =
  | { table: 'sms_conversations'; eventType: RealtimeEventType; new: Partial<SmsConversation> | null; old: Partial<SmsConversation> | null }
  | { table: 'sms_messages'; eventType: RealtimeEventType; new: SmsMessage | null; old: Partial<SmsMessage> | null };

// ---------------------------------------------------------------- QuickBooks Online

export type QboEnvironment = 'sandbox' | 'production';
export type QboConnectionStatus = 'connected' | 'needs_reauth' | 'error' | 'disconnected';
export type QboTaxMode = 'automatic' | 'none';
export type QboSyncScope = 'customers' | 'catalog' | 'all';

export interface QboSettings {
  sync_customers: boolean;
  sync_estimates: boolean;
  sync_invoices: boolean;
  income_account_id: string | null;
  income_account_name: string | null;
  tax_mode: QboTaxMode;
}

export interface QboSyncLogEntry {
  id: string;
  entity_type: string;
  local_id: string | null;
  qbo_id: string | null;
  action: string;
  status: 'success' | 'error' | 'skipped';
  message: string | null;
  created_at: string;
}

/** `GET /integrations/quickbooks` (snake_case, as served). */
export interface QboStatus {
  configured: boolean;
  environment: QboEnvironment;
  webhook_configured: boolean;
  connected: boolean;
  status: QboConnectionStatus;
  realm_id: string | null;
  company_name: string | null;
  connected_at: string | null;
  connected_by_name: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  settings: QboSettings;
  /** False on the Individual plan (no QuickBooks). */
  plan_allows?: boolean;
  counts: { customer: number; item: number; estimate: number; invoice: number };
  recent: QboSyncLogEntry[];
}

export interface QboAccount { id: string; name: string }

export type QboSettingsPatch = Partial<Pick<QboSettings, 'sync_customers' | 'sync_estimates' | 'sync_invoices' | 'income_account_id' | 'tax_mode'>>;

// ---------------------------------------------------------------- QuickBooks documents (estimates / invoices)

export type QboDocumentType = 'estimate' | 'invoice';

/** `GET /integrations/quickbooks/documents` row (snake_case, as served). */
export interface QboDocument {
  id: string;
  doc_type: QboDocumentType;
  qbo_id: string;
  doc_number: string | null;
  origin: 'quickbooks' | 'hausboss';
  customer_id: string | null;
  job_id: string | null;
  customer_name: string | null;
  job_label: string | null;
  bill_email: string | null;
  /** estimate: pending|accepted|closed|rejected · invoice: open|partially_paid|paid|voided · deleted */
  status: string;
  total: string;
  balance: string | null;
  txn_date: string | null;
  due_date: string | null;
  expiration_date: string | null;
  pay_link: string | null;
  public_url: string;
  last_sent_at: string | null;
  last_sent_via: string | null;
}

export interface QboDocumentFilter { customerId?: string; jobId?: string; unassigned?: boolean; type?: QboDocumentType }

export interface QboSendInput { email?: boolean; sms?: boolean; to_email?: string; to_phone?: string; message?: string }

export interface QboChannelResult { sent: boolean; to?: string; error?: string }

export interface QboSendResult { email?: QboChannelResult; sms?: QboChannelResult; document: QboDocument }

export interface QboImportResult { estimates: number; invoices: number }

/** `GET /public/qbo-documents/:token`. */
export interface PublicQboDocument {
  doc_type: QboDocumentType;
  doc_number: string | null;
  status: string;
  total: string;
  balance: string | null;
  txn_date: string | null;
  due_date: string | null;
  expiration_date: string | null;
  customer_name: string | null;
  pay_link: string | null;
  company: { name: string; phone: string | null; email: string | null };
}

// ---------------------------------------------------------------- central vs own keys (/integrations/keys, /admin/key-policies)

export type KeyInUse = 'company' | 'central' | 'none';

export interface KeyUsage {
  /** YYYY-MM */
  month: string;
  email_sent: number;
  email_blocked: number;
  sms_sent: number;
  maps_loads: number;
}

export interface KeyPolicy {
  central_allowed: boolean;
  central_until: string | null;
  reason: string | null;
  effective_central: boolean;
  grace_days_left: number | null;
}

export interface KeysStatus {
  policy: KeyPolicy;
  maps: { own: boolean; masked: string | null; in_use: KeyInUse };
  email: { own: boolean; masked: string | null; from: string | null; verified_at: string | null; in_use: KeyInUse; central_from: string };
  usage: KeyUsage;
}

export interface KeysNotice {
  level: 'warning' | 'error';
  message: string;
}

export interface PlatformKeyPolicyRow {
  company_id: string;
  company_name: string;
  owner_email: string | null;
  tier: string | null;
  central_allowed: boolean;
  central_until: string | null;
  reason: string | null;
  effective_central: boolean;
  own_maps: boolean;
  own_email: boolean;
  usage: KeyUsage;
  usage_prev: KeyUsage;
  /** Prepaid texts (absent on rows returned by the policy PATCH). */
  sms?: { billing_enabled: boolean; balance: number; exempt: boolean; overage_texts: number };
  /** Prepaid customer emails (absent on rows returned by the policy PATCH). */
  email?: { billing_enabled: boolean; balance: number; exempt: boolean; over_this_month: number };
}

/** A pack of prepaid texts or emails for sale (`id` = Stripe price id, or "default"). */
export interface CreditPack {
  id: string;
  credits: number;
  price_cents: number;
  name: string | null;
}

/** GET /billing/sms-credits: prepaid texts for the signed-in company. */
export interface SmsCreditsStatus {
  enabled: boolean;
  exempt: boolean;
  balance: number;
  pack: { credits: number; price_cents: number };
  /** Packs for sale, smallest first. */
  packs: CreditPack[];
  overage_cents_per_text: number;
  low_balance: number;
  overage_texts: number;
  overage_amount_cents: number;
}

/** GET /billing/email-credits: prepaid customer emails for the signed-in company. */
export interface EmailCreditsStatus {
  enabled: boolean;
  exempt: boolean;
  balance: number;
  low_balance: number;
  sent_this_month: number;
  /** Emails sent this month while the balance was 0. */
  over_this_month: number;
  packs: CreditPack[];
}

export interface PlatformKeyPolicyPatch {
  central_allowed?: boolean;
  central_until?: string | null;
  reason?: string | null;
}
