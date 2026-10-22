/** Phone helpers shared by the web and mobile apps (pure; no API access). */

export function normalizePhone(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D/g, '');
}

/** E.164 or null (mirrors the server's normalize_phone_e164): +1 is assumed for 10-digit numbers. */
export function normalizePhoneE164(phone: string | null | undefined): string | null {
  const raw = (phone ?? '').replace(/[^\d+]/g, '');
  if (/^\+\d{8,15}$/.test(raw)) return raw;
  const digits = raw.replace(/\D/g, '');
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  return null;
}

/** Same digits (ignoring formatting); empty never matches. */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizePhone(a) !== '' && normalizePhone(a) === normalizePhone(b);
}

/** +15125551234 → (512) 555-1234; other formats are returned untouched. */
export function formatPhone(e164: string | null | undefined): string {
  const v = (e164 ?? '').trim();
  const m = v.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : v;
}
