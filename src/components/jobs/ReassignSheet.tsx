import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { getContractorColor } from '@/utils/contractorColors';
import { assignableEmployees, employeeOptionLabel } from '@/utils/employees';
import type { Employee, Job } from '@/types';
import { Button, Select, Sheet, Text } from '~/components/ui';
import type { JobPatch } from '~/features/jobs/useJobActions';
import { toast } from '~/features/toast/store';
import { spacing } from '~/theme/tokens';

const NONE = 'none';

export interface ReassignSheetProps {
  job: Job | null;
  employees: Employee[];
  onClose: () => void;
  onUpdateJob: (jobId: string, patch: JobPatch) => Promise<boolean>;
}

/** Reassign a job to any assignable employee (technicians first, then owners / managers labelled). */
export function ReassignSheet({ job, employees, onClose, onUpdateJob }: ReassignSheetProps) {
  const people = useMemo(() => assignableEmployees(employees), [employees]);
  const initial = useMemo(() => job?.assignedUserId ?? people.find((t) => t.name.toLowerCase() === (job?.assignedTo ?? '').toLowerCase())?.id ?? NONE, [job?.assignedUserId, job?.assignedTo, people]);
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setValue(initial); }, [job?.id, initial]);

  const save = async () => {
    if (!job) return;
    const tech = people.find((t) => t.id === value);
    setSaving(true);
    const ok = await onUpdateJob(job.id, { assignedTo: tech?.name ?? '', assignedUserId: tech?.id ?? null });
    setSaving(false);
    if (ok) { toast.success(tech ? `Reassigned to ${tech.name}` : 'Job unassigned'); onClose(); }
  };

  return (
    <Sheet open={!!job} onClose={onClose} title="Reassign job" description={job ? `${job.clientName} · ${job.clientAddress}` : undefined} footer={<Button label="Reassign" size="lg" fullWidth loading={saving} onPress={() => void save()} />}>
      <Select
        label="Assign to"
        value={value}
        onChange={setValue}
        options={[{ value: NONE, label: 'Unassigned' }, ...people.map((t) => ({ value: t.id, label: employeeOptionLabel(t), leading: <View style={[styles.dot, { backgroundColor: getContractorColor(t.name, t.color) }]} /> }))]}
      />
      <Text variant="caption" color="mutedForeground">The new assignee is emailed by the server; the previous one sees the job leave their queue.</Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({ dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing[1] } });
