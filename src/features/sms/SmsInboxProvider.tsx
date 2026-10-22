import { createContext, useContext, type ReactNode } from 'react';
import { planIncludes } from '@/lib/plan';
import { useAuth } from '~/features/auth/AuthProvider';
import { useCompany } from '~/features/company/CompanyProvider';
import { useSmsConversations, type UseSmsConversationsResult } from './useSmsConversations';

export interface SmsInboxValue extends UseSmsConversationsResult {
  /** The company has a Telnyx number. */
  configured: boolean;
  /** The Individual plan has no texting (the API answers 403 `not_in_plan`). */
  inPlan: boolean;
}

const SmsInboxContext = createContext<SmsInboxValue | undefined>(undefined);

/** One inbox subscription for the whole app (Messages tab badge + the inbox screen). */
export function SmsInboxProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const { company, companyId, subscription } = useCompany();
  const inPlan = planIncludes(subscription, 'sms');
  const inbox = useSmsConversations(companyId, status === 'signedIn' && inPlan);
  return <SmsInboxContext.Provider value={{ ...inbox, configured: company?.sms.configured ?? false, inPlan }}>{children}</SmsInboxContext.Provider>;
}

export function useSmsInbox(): SmsInboxValue {
  const ctx = useContext(SmsInboxContext);
  if (!ctx) throw new Error('useSmsInbox must be used within SmsInboxProvider');
  return ctx;
}
