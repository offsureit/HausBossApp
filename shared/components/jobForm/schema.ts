import { z } from 'zod';
import { combineLocalDateTime } from '@/components/calendarLayout';
import { contactName, personName } from '@/lib/names';
import type { Customer, Employee, Job, JobCreateInput, MediaItem } from '@/types';

export const SALUTATIONS = ['', 'Mr.', 'Ms.', 'Mrs.', 'Dr.'] as const;
export const PHONE_TYPES = ['mobile', 'home', 'work'] as const;
export const EMAIL_TYPES = ['personal', 'work'] as const;
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export const phoneRegex = /^\+?[0-9 ()./-]{7,20}$/;
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return phoneRegex.test(value.trim()) && digits.length >= 10 && digits.length <= 15;
}

const optionalEmail = z.string().trim().email('Enter a valid email').or(z.literal(''));
const optionalPhone = z.string().trim().refine((v) => v === '' || isValidPhone(v), 'Enter a valid phone number');

const NAME_RULE = 'Enter a company name, or a first and last name';

/** A customer or billing contact is a company, a person (first + last), or both. */
function checkContactName(company: string, first: string, last: string, paths: { first: string; last: string }, ctx: z.RefinementCtx) {
  if (company) return;
  if (!first) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [paths.first], message: last ? 'First name is required' : NAME_RULE });
  if (!last) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [paths.last], message: first ? 'Last name is required' : NAME_RULE });
}

const contactFields = {
  customerId: z.string().optional(),
  clientCompanyName: z.string().trim().max(200),
  clientSalutation: z.string(),
  clientFirstName: z.string().trim(),
  clientLastName: z.string().trim(),
  clientAddress: z.string().trim().min(5, 'Address is required'),
  clientPhone: z.string().trim().refine(isValidPhone, 'Enter a valid phone number'),
  clientPhoneType: z.enum(PHONE_TYPES),
  clientPhone2: optionalPhone,
  clientPhone2Type: z.enum(PHONE_TYPES),
  clientEmail: optionalEmail,
  clientEmailType: z.enum(EMAIL_TYPES),
  clientEmail2: optionalEmail,
  clientEmail2Type: z.enum(EMAIL_TYPES),
  billingDiffers: z.boolean(),
  billingCompanyName: z.string().trim().max(200),
  billingFirstName: z.string().trim(),
  billingLastName: z.string().trim(),
  billingAddress: z.string().trim(),
  billingPhone: optionalPhone,
  billingEmail: optionalEmail,
  /** '' = the company's main business unit. */
  businessUnitId: z.string(),
  division: z.enum(['', 'residential', 'commercial']),
};

type ContactValues = { clientCompanyName: string; clientFirstName: string; clientLastName: string; billingDiffers: boolean; billingCompanyName: string; billingFirstName: string; billingLastName: string };
function checkContacts(v: ContactValues, ctx: z.RefinementCtx) {
  checkContactName(v.clientCompanyName, v.clientFirstName, v.clientLastName, { first: 'clientFirstName', last: 'clientLastName' }, ctx);
  if (v.billingDiffers) checkContactName(v.billingCompanyName, v.billingFirstName, v.billingLastName, { first: 'billingFirstName', last: 'billingLastName' }, ctx);
}

export const jobFormSchema = z.object({
  ...contactFields,
  jobDetails: z.string().trim().min(3, 'Describe the job'),
  importantDetails: z.string().trim(),
  serviceType: z.string().trim(),
  category: z.string(),
  /** Job length in minutes as a string ('' = the standard 2 hours). */
  durationMinutes: z.string(),
  priority: z.enum(PRIORITIES),
  assignedUserId: z.string(),
  scheduledDate: z.string(),
  scheduledTime: z.string(),
}).superRefine((v, ctx) => {
  checkContacts(v, ctx);
  if ((v.scheduledDate && !v.scheduledTime) || (!v.scheduledDate && v.scheduledTime)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scheduledTime'], message: 'Pick both a date and a time' });
  }
});

export type JobFormValues = z.infer<typeof jobFormSchema>;

export const EMPTY_JOB_FORM: JobFormValues = {
  customerId: undefined,
  clientCompanyName: '', clientSalutation: '', clientFirstName: '', clientLastName: '', clientAddress: '',
  clientPhone: '', clientPhoneType: 'mobile', clientPhone2: '', clientPhone2Type: 'mobile',
  clientEmail: '', clientEmailType: 'personal', clientEmail2: '', clientEmail2Type: 'personal',
  billingDiffers: false, billingCompanyName: '', billingFirstName: '', billingLastName: '', billingAddress: '', billingPhone: '', billingEmail: '',
  businessUnitId: '', division: '',
  jobDetails: '', importantDetails: '', serviceType: '', category: '', durationMinutes: '', priority: 'medium',
  assignedUserId: '', scheduledDate: '', scheduledTime: '',
};

/** Map validated form values to the service input (find-or-create customer happens in the service). */
export function toJobCreateInput(v: JobFormValues, employees: readonly Employee[], media: MediaItem[]): JobCreateInput {
  const tech = employees.find((e) => e.id === v.assignedUserId);
  const scheduled = combineLocalDateTime(v.scheduledDate, v.scheduledTime);
  const clientName = contactName(v.clientCompanyName, personName(v.clientSalutation, v.clientFirstName, v.clientLastName));
  return {
    customerId: v.customerId || undefined,
    clientName,
    clientCompanyName: v.clientCompanyName || undefined,
    clientSalutation: v.clientSalutation,
    clientFirstName: v.clientFirstName,
    clientLastName: v.clientLastName,
    clientAddress: v.clientAddress,
    clientPhone: v.clientPhone,
    clientPhoneType: v.clientPhoneType,
    clientPhone2: v.clientPhone2 || undefined,
    clientPhone2Type: v.clientPhone2 ? v.clientPhone2Type : undefined,
    clientEmail: v.clientEmail || undefined,
    clientEmailType: v.clientEmailType,
    clientEmail2: v.clientEmail2 || undefined,
    clientEmail2Type: v.clientEmail2 ? v.clientEmail2Type : undefined,
    billingName: v.billingDiffers ? billingName(v) : undefined,
    billingCompanyName: v.billingDiffers ? v.billingCompanyName || undefined : undefined,
    billingFirstName: v.billingDiffers ? v.billingFirstName || undefined : undefined,
    billingLastName: v.billingDiffers ? v.billingLastName || undefined : undefined,
    billingAddress: v.billingDiffers ? v.billingAddress : undefined,
    billingPhone: v.billingDiffers ? v.billingPhone : undefined,
    billingEmail: v.billingDiffers ? v.billingEmail : undefined,
    businessUnitId: v.businessUnitId || null,
    division: v.division || null,
    jobDetails: v.jobDetails,
    importantDetails: v.importantDetails || undefined,
    serviceType: v.serviceType || undefined,
    category: v.category || undefined,
    durationMinutes: v.durationMinutes ? Number(v.durationMinutes) : null,
    priority: v.priority,
    assignedUserId: tech?.id ?? null,
    assignedTo: tech?.name ?? '',
    scheduledDate: scheduled,
    status: 'pending',
    mediaUrls: media.length ? media : undefined,
  };
}

const billingName = (v: Pick<JobFormValues, 'billingCompanyName' | 'billingFirstName' | 'billingLastName'>) => contactName(v.billingCompanyName, personName(v.billingFirstName, v.billingLastName));

/** Older records only have one name string; split it into first / rest. */
const splitName = (name: string | null | undefined): [string, string] => { const [first = '', ...rest] = (name ?? '').trim().split(/\s+/); return [first, rest.join(' ')]; };

export function customerToForm(c: Customer): Partial<JobFormValues> {
  // A company-only customer has no person name; don't split the company name into first/last.
  const hasParts = !!(c.first_name || c.last_name || c.company_name);
  const [first, last] = hasParts ? ['', ''] : splitName(c.name);
  const hasBillingParts = !!(c.billing_company_name || c.billing_first_name || c.billing_last_name);
  const [billFirst, billLast] = hasBillingParts ? ['', ''] : splitName(c.billing_name);
  return {
    customerId: c.id,
    clientCompanyName: c.company_name ?? '',
    clientSalutation: c.salutation ?? '',
    clientFirstName: c.first_name ?? first,
    clientLastName: c.last_name ?? last,
    clientAddress: c.address ?? '',
    clientPhone: c.phone ?? '',
    clientPhone2: c.phone2 ?? '',
    clientEmail: c.email ?? '',
    clientEmail2: c.email2 ?? '',
    billingDiffers: !!(c.billing_name || c.billing_address),
    billingCompanyName: c.billing_company_name ?? '',
    billingFirstName: c.billing_first_name ?? billFirst,
    billingLastName: c.billing_last_name ?? billLast,
    billingAddress: c.billing_address ?? '',
    billingPhone: c.billing_phone ?? '',
    billingEmail: c.billing_email ?? '',
    businessUnitId: c.business_unit_id ?? '',
    division: c.division === 'residential' || c.division === 'commercial' ? c.division : '',
  };
}

const pick = <T extends string>(value: string | null | undefined, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);

/**
 * "Clone job": a new job with the same customer, address, billing, business unit, description,
 * category, priority and technician. The date and time stay empty (a new visit is scheduled), and
 * status, notes, photos, time and chat start fresh.
 */
export function jobToForm(job: Job): Partial<JobFormValues> {
  const hasParts = !!(job.clientFirstName || job.clientLastName || job.clientCompanyName);
  const [first, last] = hasParts ? ['', ''] : splitName(job.clientName);
  const hasBillingParts = !!(job.billingCompanyName || job.billingFirstName || job.billingLastName);
  const [billFirst, billLast] = hasBillingParts ? ['', ''] : splitName(job.billingName);
  return {
    customerId: job.customerId || undefined,
    clientCompanyName: job.clientCompanyName ?? '',
    clientSalutation: job.clientSalutation ?? '',
    clientFirstName: job.clientFirstName || first,
    clientLastName: job.clientLastName || last,
    clientAddress: job.clientAddress ?? '',
    clientPhone: job.clientPhone ?? '',
    clientPhoneType: pick(job.clientPhoneType, PHONE_TYPES, 'mobile'),
    clientPhone2: job.clientPhone2 ?? '',
    clientPhone2Type: pick(job.clientPhone2Type, PHONE_TYPES, 'mobile'),
    clientEmail: job.clientEmail ?? '',
    clientEmailType: pick(job.clientEmailType, EMAIL_TYPES, 'personal'),
    clientEmail2: job.clientEmail2 ?? '',
    clientEmail2Type: pick(job.clientEmail2Type, EMAIL_TYPES, 'personal'),
    billingDiffers: !!(job.billingName || job.billingAddress),
    billingCompanyName: job.billingCompanyName ?? '',
    billingFirstName: job.billingFirstName || billFirst,
    billingLastName: job.billingLastName || billLast,
    billingAddress: job.billingAddress ?? '',
    billingPhone: job.billingPhone ?? '',
    billingEmail: job.billingEmail ?? '',
    businessUnitId: job.businessUnitId ?? '',
    division: job.division === 'residential' || job.division === 'commercial' ? job.division : '',
    jobDetails: job.jobDetails ?? '',
    importantDetails: job.importantDetails ?? '',
    serviceType: job.serviceType ?? '',
    category: job.category ?? '',
    durationMinutes: job.durationMinutes ? String(job.durationMinutes) : '',
    priority: pick(job.priority, PRIORITIES, 'medium'),
    assignedUserId: job.assignedUserId ?? '',
    scheduledDate: '',
    scheduledTime: '',
  };
}

/** The contact subset that "Save customer only" needs (job fields may be empty). */
export const customerOnlySchema = z.object(contactFields).omit({ clientPhoneType: true, clientPhone2Type: true, clientEmailType: true, clientEmail2Type: true }).superRefine(checkContacts);

export function toCustomerPayload(values: JobFormValues, companyId: string) {
  const name = contactName(values.clientCompanyName, personName(values.clientSalutation, values.clientFirstName, values.clientLastName));
  const billing = values.billingDiffers;
  return {
    company_id: companyId, name, company_name: values.clientCompanyName || null,
    salutation: values.clientSalutation || null, first_name: values.clientFirstName || null, last_name: values.clientLastName || null,
    address: values.clientAddress, phone: values.clientPhone, phone2: values.clientPhone2 || null, email: values.clientEmail || null, email2: values.clientEmail2 || null,
    billing_name: billing ? billingName(values) || null : null,
    billing_company_name: billing ? values.billingCompanyName || null : null,
    billing_first_name: billing ? values.billingFirstName || null : null,
    billing_last_name: billing ? values.billingLastName || null : null,
    billing_address: values.billingDiffers ? values.billingAddress || null : null,
    billing_phone: values.billingDiffers ? values.billingPhone || null : null, billing_email: values.billingDiffers ? values.billingEmail || null : null,
    business_unit_id: values.businessUnitId || null, division: values.division || null,
  };
}
