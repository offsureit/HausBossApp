import type { Json, TablesInsert, TablesUpdate } from '@/api/dbTypes';
import { contactName, personName } from '@/lib/names';
import type { JobRow } from '@/api/dbTypes';
import type { Job, JobActivityEntry, JobCreateInput, JobInvoiceStatus, JobUpdateInput, MediaItem, TimeEntry } from '@/types';
import { normalizeJobStatus } from '@/utils/jobStatus';

/**
 * The ONE place where job rows are converted between the API's snake_case and
 * the UI's camelCase (PROJECT_HANDOFF §13 "Field naming", §20 "The adapter is
 * the seam"). Pure functions — no I/O.
 *
 * Null behaviour (§13): optional strings coalesce to '', `metadata` null → {},
 * `media_urls` → [], `timeEntries` → [].
 */

const METADATA_KNOWN_KEYS = new Set(['notes', 'activity', 'timeEntries']);

function str(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asArray<T>(value: unknown, guard: (v: unknown) => v is T): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(guard);
}

function isTimeEntry(v: unknown): v is TimeEntry {
  return isRecord(v) && typeof v.timestamp === 'string' && (v.type === 'start' || v.type === 'stop' || v.type === 'complete');
}

function isMediaItem(v: unknown): v is MediaItem {
  return isRecord(v) && typeof v.url === 'string';
}

function isActivityEntry(v: unknown): v is JobActivityEntry {
  return isRecord(v) && typeof v.type === 'string';
}

export function parseMetadata(metadata: Json | null | undefined): Record<string, unknown> {
  return isRecord(metadata) ? { ...metadata } : {};
}

/** snake_case row (PostgREST / realtime payload) → camelCase UI model. */
export function transformJob(row: JobRow): Job {
  const metadata = parseMetadata(row.metadata);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (!METADATA_KNOWN_KEYS.has(k)) extra[k] = v;
  }

  return {
    id: row.id,
    companyId: row.company_id,
    customerId: str(row.customer_id),
    clientName: str(row.client_name),
    clientSalutation: str(row.client_salutation),
    clientFirstName: str(row.client_first_name),
    clientLastName: str(row.client_last_name),
    clientCompanyName: str(row.client_company_name),
    clientAddress: str(row.client_address),
    clientPhone: str(row.client_phone),
    clientPhoneType: str(row.client_phone_type) || 'mobile',
    clientPhone2: str(row.client_phone2),
    clientPhone2Type: str(row.client_phone2_type),
    clientEmail: str(row.client_email),
    clientEmailType: str(row.client_email_type) || 'personal',
    clientEmail2: str(row.client_email2),
    clientEmail2Type: str(row.client_email2_type),
    billingName: str(row.billing_name),
    billingCompanyName: str(row.billing_company_name),
    billingFirstName: str(row.billing_first_name),
    billingLastName: str(row.billing_last_name),
    billingAddress: str(row.billing_address),
    billingPhone: str(row.billing_phone),
    billingEmail: str(row.billing_email),
    businessUnitId: row.business_unit_id ?? null,
    division: row.division === 'commercial' || row.division === 'residential' ? row.division : null,
    jobDetails: str(row.job_details),
    importantDetails: str(row.important_details),
    serviceType: str(row.service_type),
    category: str(row.category),
    durationMinutes: typeof row.duration_minutes === 'number' ? row.duration_minutes : null,
    assignedTo: str(row.assigned_to),
    assignedUserId: row.assigned_user_id ?? null,
    status: normalizeJobStatus(row.status),
    priority: str(row.priority) || 'medium',
    scheduledDate: str(row.scheduled_date),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    createdBy: row.created_by ?? null,
    notes: str(metadata.notes),
    activity: asArray(metadata.activity, isActivityEntry),
    timeEntries: asArray(metadata.timeEntries, isTimeEntry),
    mediaUrls: asArray(row.media_urls, isMediaItem),
    sortOrder: typeof row.sort_order === 'number' ? row.sort_order : null,
    metadata: extra,
    invoiceStatus: isInvoiceStatus(row.invoice_status) ? row.invoice_status : null,
    invoiceTotal: num(row.invoice_total),
    invoiceBalance: num(row.invoice_balance),
    invoiceNumber: row.invoice_number ?? null,
  };
}

function isInvoiceStatus(v: unknown): v is JobInvoiceStatus {
  return v === 'invoiced' || v === 'partially_paid' || v === 'paid' || v === 'voided';
}

/** Postgres numerics arrive as strings; '' / null / NaN → null. */
function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Build the `metadata` JSONB from UI fields (keeps unknown keys). */
export function buildMetadata(input: {
  notes?: string;
  activity?: JobActivityEntry[];
  timeEntries?: TimeEntry[];
  metadata?: Record<string, unknown>;
}): Json {
  const out: Record<string, Json> = {};
  for (const [k, v] of Object.entries(input.metadata ?? {})) out[k] = v as Json;
  if (input.notes !== undefined) out.notes = input.notes;
  if (input.activity !== undefined) out.activity = input.activity as unknown as Json;
  if (input.timeEntries !== undefined) out.timeEntries = input.timeEntries as unknown as Json;
  return out;
}

function nullable(value: string | null | undefined): string | null {
  if (value == null) return null;
  const v = value.trim();
  return v === '' ? null : v;
}

function deriveClientName(input: JobCreateInput): string {
  const explicit = (input.clientName ?? '').trim();
  if (explicit) return explicit;
  return contactName(input.clientCompanyName, personName(input.clientFirstName, input.clientLastName));
}

/** camelCase form input → `jobs` INSERT row (~30 snake_case fields, §11). */
export function toJobInsert(input: JobCreateInput, ctx: { companyId: string; userId: string }): TablesInsert<'jobs'> {
  const scheduled = nullable(input.scheduledDate ?? null);
  return {
    company_id: ctx.companyId,
    created_by: ctx.userId,
    customer_id: nullable(input.customerId),
    client_name: deriveClientName(input),
    client_salutation: nullable(input.clientSalutation),
    client_first_name: nullable(input.clientFirstName),
    client_last_name: nullable(input.clientLastName),
    client_company_name: nullable(input.clientCompanyName),
    client_phone: (input.clientPhone ?? '').trim(),
    client_phone_type: input.clientPhoneType?.trim() || 'mobile',
    client_phone2: nullable(input.clientPhone2),
    client_phone2_type: nullable(input.clientPhone2Type),
    client_email: nullable(input.clientEmail),
    client_email_type: input.clientEmailType?.trim() || 'personal',
    client_email2: nullable(input.clientEmail2),
    client_email2_type: nullable(input.clientEmail2Type),
    client_address: (input.clientAddress ?? '').trim(),
    billing_name: nullable(input.billingName),
    billing_company_name: nullable(input.billingCompanyName),
    billing_first_name: nullable(input.billingFirstName),
    billing_last_name: nullable(input.billingLastName),
    billing_address: nullable(input.billingAddress),
    billing_phone: nullable(input.billingPhone),
    billing_email: nullable(input.billingEmail),
    // Left out when not chosen: the server then takes the customer's unit / division.
    ...(input.businessUnitId !== undefined ? { business_unit_id: input.businessUnitId || null } : {}),
    ...(input.division !== undefined ? { division: input.division || null } : {}),
    job_details: (input.jobDetails ?? '').trim(),
    important_details: nullable(input.importantDetails),
    service_type: nullable(input.serviceType),
    category: nullable(input.category),
    ...(input.durationMinutes !== undefined ? { duration_minutes: input.durationMinutes } : {}),
    assigned_to: nullable(input.assignedTo),
    assigned_user_id: input.assignedUserId ?? null,
    status: input.status ?? 'pending',
    priority: input.priority?.trim() || 'medium',
    scheduled_date: scheduled,
    scheduled_at: scheduled,
    metadata: buildMetadata({ notes: input.notes ?? '', activity: [], timeEntries: [] }),
    media_urls: (input.mediaUrls ?? []) as unknown as Json,
    sort_order: input.sortOrder ?? null,
  };
}

/**
 * Partial camelCase update → `jobs` UPDATE row. Only keys present on the input
 * are mapped, so callers can send `{ status }` without clobbering anything.
 * `metadata` is replaced wholesale when any of notes/activity/timeEntries/metadata
 * is present — pass the full current values (read-modify-write, §21 risk 10).
 */
export function toJobUpdate(input: JobUpdateInput): TablesUpdate<'jobs'> {
  const out: TablesUpdate<'jobs'> = {};
  const has = <K extends keyof JobUpdateInput>(key: K): boolean => Object.prototype.hasOwnProperty.call(input, key) && input[key] !== undefined;

  if (has('customerId')) out.customer_id = nullable(input.customerId);
  if (has('clientName')) out.client_name = input.clientName ?? '';
  if (has('clientSalutation')) out.client_salutation = nullable(input.clientSalutation);
  if (has('clientFirstName')) out.client_first_name = nullable(input.clientFirstName);
  if (has('clientLastName')) out.client_last_name = nullable(input.clientLastName);
  if (has('clientCompanyName')) out.client_company_name = nullable(input.clientCompanyName);
  if (has('clientAddress')) out.client_address = input.clientAddress ?? '';
  if (has('clientPhone')) out.client_phone = input.clientPhone ?? '';
  if (has('clientPhoneType')) out.client_phone_type = nullable(input.clientPhoneType);
  if (has('clientPhone2')) out.client_phone2 = nullable(input.clientPhone2);
  if (has('clientPhone2Type')) out.client_phone2_type = nullable(input.clientPhone2Type);
  if (has('clientEmail')) out.client_email = nullable(input.clientEmail);
  if (has('clientEmailType')) out.client_email_type = nullable(input.clientEmailType);
  if (has('clientEmail2')) out.client_email2 = nullable(input.clientEmail2);
  if (has('clientEmail2Type')) out.client_email2_type = nullable(input.clientEmail2Type);
  if (has('billingName')) out.billing_name = nullable(input.billingName);
  if (has('billingCompanyName')) out.billing_company_name = nullable(input.billingCompanyName);
  if (has('billingFirstName')) out.billing_first_name = nullable(input.billingFirstName);
  if (has('billingLastName')) out.billing_last_name = nullable(input.billingLastName);
  if (has('billingAddress')) out.billing_address = nullable(input.billingAddress);
  if (has('billingPhone')) out.billing_phone = nullable(input.billingPhone);
  if (has('billingEmail')) out.billing_email = nullable(input.billingEmail);
  if (has('businessUnitId')) out.business_unit_id = input.businessUnitId || null;
  if (has('division')) out.division = input.division || null;
  if (has('jobDetails')) out.job_details = input.jobDetails ?? '';
  if (has('importantDetails')) out.important_details = nullable(input.importantDetails);
  if (has('serviceType')) out.service_type = nullable(input.serviceType);
  if (has('category')) out.category = nullable(input.category);
  if (has('durationMinutes')) out.duration_minutes = input.durationMinutes ?? null;
  if (has('assignedTo')) out.assigned_to = nullable(input.assignedTo);
  if (has('assignedUserId')) out.assigned_user_id = input.assignedUserId ?? null;
  if (has('status')) out.status = input.status;
  if (has('priority')) out.priority = nullable(input.priority);
  if (has('scheduledDate')) {
    out.scheduled_date = nullable(input.scheduledDate);
    out.scheduled_at = out.scheduled_date;
  }
  if (has('mediaUrls')) out.media_urls = (input.mediaUrls ?? []) as unknown as Json;
  if (has('sortOrder')) out.sort_order = input.sortOrder ?? null;

  if (has('notes') || has('activity') || has('timeEntries') || has('metadata')) {
    out.metadata = buildMetadata({
      notes: input.notes,
      activity: input.activity,
      timeEntries: input.timeEntries,
      metadata: input.metadata,
    });
  }

  return out;
}

/** Merge a partial update into an existing UI job so the full metadata is preserved on write. */
export function mergeJobUpdate(current: Job, patch: JobUpdateInput): JobUpdateInput {
  const touchesMetadata = ['notes', 'activity', 'timeEntries', 'metadata'].some((k) => k in patch);
  if (!touchesMetadata) return patch;
  return {
    ...patch,
    notes: patch.notes ?? current.notes,
    activity: patch.activity ?? current.activity,
    timeEntries: patch.timeEntries ?? current.timeEntries,
    metadata: { ...current.metadata, ...(patch.metadata ?? {}) },
  };
}

/** Human job number shown in the UI: first 8 characters of the id (§13). */
export function jobNumber(id: string): string {
  return id.slice(0, 8).toUpperCase();
}
