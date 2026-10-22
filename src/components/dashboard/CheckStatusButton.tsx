import { useCallback, useEffect, useRef, useState } from 'react';
import { LocateFixed } from 'lucide-react-native';
import type { Employee, UserLocation } from '@/types';
import { Button } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { toast } from '~/features/toast/store';
import { locationsService, type PingSession } from '~/services/locations';
import { useTheme } from '~/theme/ThemeProvider';

const TIMEOUT_MS = 20_000; // §15

/** Admin GPS snapshot (§8.7): broadcast `location_ping_request`, progress toast with Terminate, 20 s cap. */
export function CheckStatusButton({ companyId, technicians, onLocations }: { companyId: string | null; technicians: Employee[]; onLocations?: (locations: UserLocation[]) => void }) {
  const { colors } = useTheme();
  const { user, isStaff } = useAuth();
  const [running, setRunning] = useState(false);
  const session = useRef<PingSession | null>(null);
  const toastId = useRef<string | null>(null);

  useEffect(() => () => { session.current?.terminate(); }, []);

  const start = useCallback(() => {
    if (!companyId || running) return;
    const expected = technicians.filter((t) => t.isActive).map((t) => t.id);
    const total = expected.length;
    if (total === 0) { toast.info('No active technicians to ping'); return; }
    setRunning(true);
    const received = new Map<string, UserLocation>();
    const render = (label: string) => {
      if (toastId.current) toast.dismiss(toastId.current);
      toastId.current = toast.info('Checking technician locations', { description: label, duration: 0, action: { label: 'Terminate', onPress: () => session.current?.terminate() } });
    };
    render(`0/${total} received`);
    const s = locationsService.requestPing(companyId, {
      requestedBy: user?.id,
      expectedUserIds: expected,
      timeoutMs: TIMEOUT_MS,
      onUpdate: (loc) => { received.set(loc.user_id, loc); onLocations?.(Array.from(received.values())); render(`${received.size}/${total} received`); },
    });
    session.current = s;
    void s.done.then(({ received: locs, reason }) => {
      session.current = null;
      setRunning(false);
      onLocations?.(locs);
      if (toastId.current) toast.dismiss(toastId.current);
      toastId.current = null;
      const summary = `${locs.length}/${total} technician${total === 1 ? '' : 's'} reported`;
      if (reason === 'all') toast.success('All technicians reported', { description: summary });
      else if (reason === 'timeout') toast.warning('Location check timed out after 20 s', { description: summary });
      else toast.info('Location check terminated', { description: summary });
    });
  }, [companyId, running, technicians, user?.id, onLocations]);

  if (!isStaff) return null;
  return <Button label={running ? 'Checking…' : 'Check locations'} variant="outline" size="sm" icon={<LocateFixed size={14} color={colors.foreground} />} onPress={start} loading={running} disabled={!companyId} />;
}
