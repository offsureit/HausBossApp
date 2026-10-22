import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Mail, Phone, UserPlus, Users } from 'lucide-react-native';
import { getContractorColor } from '@/utils/contractorColors';
import { EMPLOYEE_ROLE_LABEL } from '@/utils/employees';
import type { AppRole, Employee } from '@/types';
import { Avatar, Button, Card, Dialog, EmptyState, IconButton, Screen, Select, Sheet, SkeletonCard, Text, TextField } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { useCompany } from '~/features/company/CompanyProvider';
import { teamKey, useTeamQuery } from '~/features/team/useTeam';
import { toast } from '~/features/toast/store';
import { haptics } from '~/lib/haptics';
import { links } from '~/lib/links';
import { teamService, type SeatPrompt } from '~/services/team';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing, withAlpha } from '~/theme/tokens';

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [{ value: 'contractor', label: 'Technician' }, { value: 'manager', label: 'Manager' }, { value: 'admin', label: 'Owner / admin' }];
interface InviteDraft { email: string; firstName: string; lastName: string; phone: string; role: AppRole }
const EMPTY: InviteDraft = { email: '', firstName: '', lastName: '', phone: '', role: 'contractor' };

/** Team roster; admins invite, change roles and deactivate / reactivate (web `AdminPanel`). */
export default function TeamScreen() {
  const { colors } = useTheme();
  const { isAdmin, user } = useAuth();
  const { companyId } = useCompany();
  const queryClient = useQueryClient();
  const team = useTeamQuery(companyId);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [draft, setDraft] = useState<InviteDraft>(EMPTY);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [seat, setSeat] = useState<{ prompt: SeatPrompt; retry: () => Promise<void> } | null>(null);
  const people = useMemo(() => (team.data ?? []).filter((e) => e.role !== 'superadmin'), [team.data]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: teamKey(companyId) });

  const handleSeat = (error: { message: string; code?: string; cause?: unknown } | null, retry: () => Promise<void>) => {
    const prompt = teamService.seatPrompt(error);
    if (!prompt) { toast.error(error?.message ?? 'Request failed'); return; }
    if (prompt.kind === 'plan') { toast.error(prompt.message); return; }
    setSeat({ prompt, retry });
  };
  const invite = async (confirmCharge = false) => {
    setBusy('invite');
    const { error } = await teamService.invite({ ...draft, confirmCharge });
    setBusy(null);
    if (error) { handleSeat(error, () => invite(true)); return; }
    setInviteOpen(false); setDraft(EMPTY); setSeat(null);
    toast.success(`Invitation sent to ${draft.email.trim()}`); haptics.success();
    void refresh();
  };
  const setRole = async (e: Employee, role: AppRole) => {
    setBusy('role');
    const { error } = await teamService.setRole(e.id, role);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${e.name} is now ${EMPLOYEE_ROLE_LABEL[role].toLowerCase()}`);
    setSelected(null); void refresh();
  };
  const setActive = async (e: Employee, active: boolean, confirmCharge = false) => {
    setBusy('active');
    const { error } = await teamService.setActive(e.id, active, confirmCharge);
    setBusy(null);
    if (error) { handleSeat(error, () => setActive(e, active, true)); return; }
    toast.success(active ? `${e.name} reactivated` : `${e.name} deactivated`);
    setSelected(null); setSeat(null); void refresh();
  };

  return (
    <Screen scroll edges={['left', 'right']} refreshing={team.isRefetching} onRefresh={() => void team.refetch()} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Team', headerBackTitle: 'Back', headerRight: isAdmin ? () => <IconButton icon={UserPlus} label="Invite" variant="filled" tone="accent" onPress={() => setInviteOpen(true)} /> : undefined }} />
      {team.isPending ? <View style={styles.list}><SkeletonCard /><SkeletonCard /></View>
        : people.length === 0 ? <EmptyState icon={Users} title="No team members yet" />
        : (
          <Card padded={false}>
            {people.map((e, i) => (
              <View key={e.id} style={[styles.row, i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <Avatar name={e.name} firstName={e.firstName} lastName={e.lastName} color={getContractorColor(e.name, e.color)} size={40} />
                <View style={styles.grow}>
                  <Text variant="bodyMedium">{e.name}{e.id === user?.id ? <Text variant="caption" color="mutedForeground"> · you</Text> : null}{!e.isActive ? <Text variant="caption" color="destructive"> · inactive</Text> : null}</Text>
                  <Text variant="caption" color="mutedForeground">{EMPLOYEE_ROLE_LABEL[e.role]}{e.email ? ` · ${e.email}` : ''}</Text>
                </View>
                {e.phone ? <IconButton icon={Phone} label={`Call ${e.name}`} onPress={() => void links.call(e.phone)} /> : null}
                {e.email ? <IconButton icon={Mail} label={`Email ${e.name}`} onPress={() => void links.email(e.email)} /> : null}
                {isAdmin && e.id !== user?.id ? <Button label="Manage" variant="outline" size="sm" onPress={() => setSelected(e)} /> : null}
              </View>
            ))}
          </Card>
        )}

      <Sheet open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite a team member" description="They get an email with a link to set a password on the web, then sign in here." footer={<Button label="Send invitation" size="lg" fullWidth onPress={() => void invite()} loading={busy === 'invite'} />}>
        <TextField label="Email *" value={draft.email} onChangeText={(v) => setDraft({ ...draft, email: v })} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <View style={styles.rowFields}><View style={styles.grow}><TextField label="First name *" value={draft.firstName} onChangeText={(v) => setDraft({ ...draft, firstName: v })} /></View><View style={styles.grow}><TextField label="Last name" value={draft.lastName} onChangeText={(v) => setDraft({ ...draft, lastName: v })} /></View></View>
        <TextField label="Phone" value={draft.phone} onChangeText={(v) => setDraft({ ...draft, phone: v })} keyboardType="phone-pad" />
        <Select label="Role" value={draft.role} onChange={(v) => setDraft({ ...draft, role: v })} options={ROLE_OPTIONS} />
      </Sheet>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.name} description={selected ? `${EMPLOYEE_ROLE_LABEL[selected.role]} · ${selected.isActive ? 'active' : 'inactive'}` : undefined}>
        {selected ? (
          <>
            <Select label="Role" value={selected.role} onChange={(v) => void setRole(selected, v)} options={ROLE_OPTIONS} disabled={busy === 'role'} />
            <View style={[styles.note, { backgroundColor: withAlpha(colors.muted, 0.8) }]}><Text variant="caption" color="mutedForeground">Deactivated users keep their history but cannot sign in. Reactivating may need a seat on your plan.</Text></View>
            {selected.isActive
              ? <Button label="Deactivate" variant="destructive" onPress={() => void setActive(selected, false)} loading={busy === 'active'} />
              : <Button label="Reactivate" onPress={() => void setActive(selected, true)} loading={busy === 'active'} />}
          </>
        ) : null}
      </Sheet>

      <Dialog open={!!seat} onClose={() => setSeat(null)} title={seat?.prompt.kind === 'checkout' ? 'Payment needed' : 'Extra user'} description={seat?.prompt.message} confirmLabel={seat?.prompt.kind === 'checkout' ? 'Open checkout' : 'Add and charge'} busy={!!busy}
        onConfirm={async () => { if (!seat) return; if (seat.prompt.kind === 'checkout') { await links.url(seat.prompt.url); setSeat(null); } else await seat.retry(); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[3] },
  list: { gap: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2], paddingHorizontal: spacing[3], minHeight: 60 },
  rowFields: { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  note: { borderRadius: radius.md, padding: spacing[3] },
});
