import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, FileText } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { getContractorColor } from '@/utils/contractorColors';
import { assignableEmployees, employeeOptionLabel } from '@/utils/employees';
import type { Employee, Job } from '@/types';
import { Button, DateTimeField, SectionCard, Select, Text, TextField } from '~/components/ui';
import { useCompany } from '~/features/company/CompanyProvider';
import { useCategories } from '~/features/jobs/useCategories';
import type { JobPatch } from '~/features/jobs/useJobActions';
import { toast } from '~/features/toast/store';
import { spacing } from '~/theme/tokens';
import { useTheme } from '~/theme/ThemeProvider';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const NONE = 'none';

function combine(date: Date | null, time: Date | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (time) d.setHours(time.getHours(), time.getMinutes(), 0, 0);
  else d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

/** Staff edit of the schedule, assignee, priority, category and details (JobDetailsModal "Edit job"). */
export function JobDetailsEditor({ job, employees, onUpdateJob }: { job: Job; employees: Employee[]; onUpdateJob: (jobId: string, patch: JobPatch) => Promise<boolean> }) {
  const { company, companyId } = useCompany();
  const { colors } = useTheme();
  const { categories, addCategory } = useCategories(companyId);
  const people = useMemo(() => assignableEmployees(employees, { includeInactive: true }), [employees]);
  const unitCategory = (job.businessUnitId && company?.businessUnits.find((u) => u.id === job.businessUnitId)?.category) || null;
  const scheduled = job.scheduledDate ? new Date(job.scheduledDate) : null;
  const [assignedUserId, setAssignedUserId] = useState(job.assignedUserId ?? NONE);
  const [date, setDate] = useState<Date | null>(scheduled);
  const [time, setTime] = useState<Date | null>(scheduled);
  const [priority, setPriority] = useState<string>(job.priority || 'medium');
  const [category, setCategory] = useState(job.category);
  const [newCategory, setNewCategory] = useState('');
  const [details, setDetails] = useState(job.jobDetails);
  const [important, setImportant] = useState(job.importantDetails);
  const [saving, setSaving] = useState(false);
  const dirty = useRef(false);
  const lastJob = useRef(job.id);

  // Realtime replaces the job while staff may be mid-edit; only reset when a different job opens or nothing was touched.
  useEffect(() => {
    if (lastJob.current !== job.id) { lastJob.current = job.id; dirty.current = false; }
    if (dirty.current) return;
    const s = job.scheduledDate ? new Date(job.scheduledDate) : null;
    setAssignedUserId(job.assignedUserId ?? NONE); setDate(s); setTime(s); setPriority(job.priority || 'medium'); setCategory(job.category); setDetails(job.jobDetails); setImportant(job.importantDetails);
  }, [job]);

  const mark = <T,>(setter: (v: T) => void) => (v: T) => { dirty.current = true; setter(v); };

  const save = async () => {
    const tech = people.find((t) => t.id === assignedUserId);
    setSaving(true);
    const ok = await onUpdateJob(job.id, {
      assignedUserId: tech?.id ?? null,
      assignedTo: tech ? tech.name : '',
      scheduledDate: combine(date, time),
      priority,
      category: unitCategory ?? category,
      jobDetails: details,
      importantDetails: important,
    });
    setSaving(false);
    if (ok) { dirty.current = false; toast.success('Job updated'); }
  };

  return (
    <View style={styles.wrap}>
      <SectionCard title="Assignment & schedule" icon={CalendarClock}>
      <Select label="Technician" value={assignedUserId} onChange={mark(setAssignedUserId)} options={[{ value: NONE, label: 'Unassigned' }, ...people.map((t) => ({ value: t.id, label: employeeOptionLabel(t) + (t.isActive ? '' : ' (inactive)'), leading: <View style={[styles.dot, { backgroundColor: getContractorColor(t.name, t.color) }]} /> }))]} />
      <View style={styles.row}>
        <View style={styles.grow}><DateTimeField label="Date" mode="date" value={date} onChange={mark(setDate)} /></View>
        <View style={styles.grow}><DateTimeField label="Time (15-min)" mode="time" value={time} onChange={mark(setTime)} minuteInterval={15} /></View>
      </View>
      <Select label="Priority" value={priority} onChange={mark(setPriority)} options={PRIORITIES.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))} />
      {unitCategory ? (
        <TextField label="Category" value={unitCategory} editable={false} hint="Set by the business unit" />
      ) : (
        <Select
          label="Category"
          value={category || NONE}
          onChange={(v) => mark(setCategory)(v === NONE ? '' : v)}
          options={[{ value: NONE, label: '—' }, ...categories.map((c) => ({ value: c.label, label: c.label }))]}
          extra={
            <View style={styles.addCategory}>
              <View style={styles.grow}><TextField label="New category" value={newCategory} onChangeText={setNewCategory} placeholder="e.g. Maintenance" /></View>
              <Button label="Add" variant="outline" onPress={async () => { const c = await addCategory(newCategory); if (c) { mark(setCategory)(c.label); setNewCategory(''); } }} style={styles.addButton} />
            </View>
          }
        />
      )}
      </SectionCard>
      <SectionCard title="Description" icon={FileText} color={colors.warning}>
      <TextField label="Job details" value={details} onChangeText={mark(setDetails)} multiline numberOfLines={3} style={styles.multiline} />
      <TextField label="Important details" value={important} onChangeText={mark(setImportant)} multiline numberOfLines={2} style={styles.multiline} placeholder="Gate codes, pets, access…" />
      </SectionCard>
      <Button label="Save changes" size="lg" fullWidth loading={saving} onPress={() => void save()} />
      <Text variant="caption" color="mutedForeground" align="center">Changing the technician or the date notifies the people involved.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[3] },
  row: { flexDirection: 'row', gap: spacing[2] },
  grow: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing[1] },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  addCategory: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2], paddingTop: spacing[2] },
  addButton: { marginBottom: 2 },
});
