import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '~/features/auth/AuthProvider';
import { kv } from '~/lib/storage';
import { companyService } from '~/services/company';
import type { CompanyProfile, Subscription } from '@/types';

export interface CompanyContextValue {
  company: CompanyProfile | null;
  /** The tenant key: profiles.company_id (owner id). */
  companyId: string | null;
  loading: boolean;
  error: string | null;
  subscription: Subscription | null;
  refresh: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);
const cacheKey = (userId: string) => `hb.company.${userId}`;

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user, profile, status } = useAuth();
  const userId = user?.id ?? null;
  const companyId = profile?.company_id ?? null;
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedFor = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) { setCompany(null); setSubscription(null); loadedFor.current = null; setLoading(false); return; }
    const cached = kv.getJSON<{ company: CompanyProfile | null; subscription: Subscription | null }>(cacheKey(userId));
    if (loadedFor.current !== userId) {
      if (cached) { setCompany(cached.company); setSubscription(cached.subscription); setLoading(false); }
      else setLoading(true);
    }
    const { data, error: err } = await companyService.getCompany();
    if (err) {
      setError(err.message);
      if (!cached) setCompany(null);
    } else {
      setError(null);
      setCompany(data ?? null);
      const sub = data ? (await companyService.getSubscription(data.id)).data : null;
      setSubscription(sub);
      kv.setJSON(cacheKey(userId), { company: data ?? null, subscription: sub });
    }
    loadedFor.current = userId;
    setLoading(false);
  }, [userId]);

  useEffect(() => { if (status !== 'booting') void refresh(); }, [status, refresh]);

  const value = useMemo<CompanyContextValue>(
    () => ({ company, companyId, loading: status === 'booting' || loading, error, subscription, refresh }),
    [company, companyId, status, loading, error, subscription, refresh],
  );
  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany(): CompanyContextValue {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}
