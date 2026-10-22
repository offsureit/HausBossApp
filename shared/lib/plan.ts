/**
 * What the company's plan includes. The Individual plan ($79 per user) has no texting and no
 * QuickBooks; every other company keeps both. The API enforces the same rule (403 `not_in_plan`).
 */
export type PlanFeature = 'sms' | 'quickbooks';

export function planIncludes(subscription: { tier?: string | null; isEntitled?: boolean } | null | undefined, feature: PlanFeature): boolean {
  void feature; // both features follow the same rule today
  return !(subscription?.tier === 'individual' && subscription.isEntitled);
}

export const NOT_IN_PLAN_TEXT: Record<PlanFeature, string> = {
  sms: 'Text messages are not included in the Individual plan.',
  quickbooks: 'QuickBooks is not included in the Individual plan.',
};
