import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { formatDistanceToNowStrict } from 'date-fns';
import { ExternalLink, Mail, MapPin, Phone, UserCog } from 'lucide-react-native';
import { EMPLOYEE_ROLE_LABEL, openJobsFor } from '@/utils/employees';
import type { Employee, Job, UserLocation } from '@/types';
import { JobCard } from '~/components/jobs/JobCard';
import { Avatar, Button, Sheet, Text } from '~/components/ui';
import { links } from '~/lib/links';
import { locationsService } from '~/services/locations';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing } from '~/theme/tokens';

export interface EmployeeSheetProps {
  employee: Employee | null;
  jobs: Job[];
  location: UserLocation | null;
  onClose: () => void;
  onReassign: (job: Job) => void;
}

/** Dispatcher view of one employee: contact (tap to call / email), last location with "Open in Maps", open jobs with Reassign. */
export function EmployeeSheet({ employee, jobs, location, onClose, onReassign }: EmployeeSheetProps) {
  const { colors } = useTheme();
  const open = useMemo(() => (employee ? openJobsFor(jobs, employee) : []), [jobs, employee]);
  const [address, setAddress] = useState<string | null>(null);
  useEffect(() => {
    setAddress(null);
    if (!location) return;
    let cancelled = false;
    void locationsService.reverseGeocode({ latitude: location.latitude, longitude: location.longitude }).then((a) => { if (!cancelled) setAddress(a); });
    return () => { cancelled = true; };
  }, [location]);
  const seen = location ? new Date(location.captured_at) : null;

  return (
    <Sheet open={!!employee} onClose={onClose} title={employee?.name} description={employee ? `${EMPLOYEE_ROLE_LABEL[employee.role]}${employee.isActive ? '' : ' · Inactive'}` : undefined}>
      {employee ? (
        <>
          <View style={styles.contact}>
            <Avatar name={employee.name} firstName={employee.firstName} lastName={employee.lastName} color={employee.color} size={48} />
            <View style={styles.contactText}>
              {employee.phone ? <Pressable accessibilityRole="link" onPress={() => void links.call(employee.phone)} style={styles.line}><Phone size={16} color={colors.accent} /><Text variant="small" color="accent">{employee.phone}</Text></Pressable> : null}
              {employee.email ? <Pressable accessibilityRole="link" onPress={() => void links.email(employee.email)} style={styles.line}><Mail size={16} color={colors.accent} /><Text variant="small" color="accent" style={styles.grow}>{employee.email}</Text></Pressable> : null}
            </View>
          </View>

          <View style={[styles.block, { borderColor: colors.border }]}>
            <Text variant="overline" color="mutedForeground">Last location</Text>
            {location && seen ? (
              <>
                <View style={styles.line}><MapPin size={16} color={colors.mutedForeground} /><Text variant="small" style={styles.grow}>{address ?? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`}</Text></View>
                <Text variant="caption" color="mutedForeground">Reported {formatDistanceToNowStrict(seen, { addSuffix: true })} · {seen.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
                <Button label="Open in Maps" variant="outline" size="sm" icon={<ExternalLink size={14} color={colors.foreground} />} onPress={() => void links.showPoint(location.latitude, location.longitude)} />
              </>
            ) : <Text variant="small" color="mutedForeground">No location reported yet.</Text>}
          </View>

          <Text variant="overline" color="mutedForeground">Open jobs ({open.length})</Text>
          {open.length === 0 ? <Text variant="small" color="mutedForeground">No open jobs assigned.</Text> : open.map((j) => (
            <View key={j.id} style={styles.job}>
              <JobCard job={j} onPress={() => { onClose(); }} footer={<Button label="Reassign" accessibilityLabel={`Reassign ${j.clientName}`} variant="outline" size="sm" icon={<UserCog size={14} color={colors.foreground} />} onPress={() => onReassign(j)} />} />
            </View>
          ))}
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  contact: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  contactText: { flex: 1, minWidth: 0, gap: spacing[1] },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  grow: { flex: 1, minWidth: 0 },
  block: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing[3], gap: spacing[2] },
  job: { gap: spacing[1] },
});
