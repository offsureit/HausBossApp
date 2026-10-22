import { api } from '~/api/client';
import { fromApi, type ServiceResult } from '@/services/types';
import type { SeatStatus, SubscriptionPlan } from '@/types';

/**
 * Billing, read-only on mobile (`GET /billing/seats`): plans are bought and changed on the web
 * (Stripe Checkout), as the brief requires.
 */

export const PLAN_TITLE: Record<SubscriptionPlan, string> = { individual: 'Individual', monthly: 'Team Monthly', yearly: 'Team Yearly', lifetime: 'Lifetime' };

export const STATUS_LABEL: Record<string, string> = {
  none: 'No subscription', trialing: 'Trial', active: 'Active', past_due: 'Past due', canceled: 'Cancelled', cancelled: 'Cancelled', lifetime: 'Lifetime', incomplete: 'Incomplete', unpaid: 'Unpaid',
};

/** Admin / manager: seat usage for the company's plan (`null` when billing is disabled on the server). */
export async function getSeats(): Promise<ServiceResult<SeatStatus | null>> {
  const result = await fromApi(() => api.get<SeatStatus | null>('/billing/seats'), 'Could not load seat usage');
  return result.error ? { data: null, error: result.error } : { data: result.data ?? null, error: null };
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export const billingService = { getSeats, formatCents, PLAN_TITLE, STATUS_LABEL };
