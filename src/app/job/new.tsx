import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { format, parse } from 'date-fns';
import { Camera, ImageIcon, Paperclip, Search, X } from 'lucide-react-native';
import { DEFAULT_BLOCK_MINUTES, LENGTH_OPTIONS, arrivalWindow, formatLength, snapToSlot } from '@/components/calendarLayout';
import { EMPTY_JOB_FORM, PRIORITIES, customerOnlySchema, customerToForm, jobFormSchema, toCustomerPayload, toJobCreateInput, type JobFormValues } from '@/components/jobForm/schema';
import { getContractorColor } from '@/utils/contractorColors';
import { assignableEmployees, employeeOptionLabel } from '@/utils/employees';
import { CustomerFields } from '~/components/customers/CustomerFields';
import { CustomerPickerSheet } from '~/components/customers/CustomerPickerSheet';
import { Button, Card, DateTimeField, Select, Text, TextField } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { useCompany } from '~/features/company/CompanyProvider';
import { useCustomersQuery } from '~/features/customers/useCustomers';
import { useCategories } from '~/features/jobs/useCategories';
import { useJobActions } from '~/features/jobs/useJobActions';
import { useTeamQuery } from '~/features/team/useTeam';
import { pickMedia, useMediaUpload } from '~/features/media/useMediaUpload';
import { toast } from '~/features/toast/store';
import { customersService } from '~/services/customers';
import type { MediaUploadItem } from '~/services/media';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing, withAlpha } from '~/theme/tokens';

type Step = 0 | 1 | 2;
const STEPS = ['Customer', 'Job', 'Schedule'] as const;
const NONE = 'none';

/** New job: the web `JobCreationForm` rules (shared zod schema) as a three-step native form. */
export default function NewJobScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ customerId?: string }>();
  const { user } = useAuth();
  const { company, companyId } = useCompany();
  const team = useTeamQuery(companyId);
  const customers = useCustomersQuery(companyId);
  const { categories, addCategory } = useCategories(companyId);
  const actions = useJobActions();
  const { upload } = useMediaUpload();
  const employees = useMemo(() => team.data ?? [], [team.data]);
  const technicians = useMemo(() => assignableEmployees(employees), [employees]);

  const [step, setStep] = useState<Step>(0);
  const [values, setValues] = useState<JobFormValues>(() => {
    const preset = params.customerId ? customers.data?.find((c) => c.id === params.customerId) : null;
    return { ...EMPTY_JOB_FORM, ...(preset ? customerToForm(preset) : {}) };
  });
  const [errors, setErrors] = useState<Partial<Record<keyof JobFormValues, string>>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [files, setFiles] = useState<MediaUploadItem[]>([]);
  const [saving, setSaving] = useState<'job' | 'customer' | null>(null);

  const set = <K extends keyof JobFormValues>(key: K, value: JobFormValues[K]) => { setValues((v) => ({ ...v, [key]: value })); setErrors((e) => ({ ...e, [key]: undefined })); };
  const units = company?.businessUnits ?? [];
  const unit = units.find((u) => u.id === values.businessUnitId);
  const unitServiceType = unit?.serviceType ?? null;
  const unitCategory = unit?.category ?? null;
  const unitLength = unit?.durationMinutes ? String(unit.durationMinutes) : null;
  const lengthMinutes = Number(unitLength ?? values.durationMinutes) || DEFAULT_BLOCK_MINUTES;


  const scheduledDate = values.scheduledDate ? parse(values.scheduledDate, 'yyyy-MM-dd', new Date()) : null;
  const scheduledTime = values.scheduledTime ? parse(values.scheduledTime, 'HH:mm', new Date()) : null;
  const timeMinutes = scheduledTime ? snapToSlot(scheduledTime.getHours() * 60 + scheduledTime.getMinutes()) : null;

  const applyIssues = (issues: { path: (string | number)[]; message: string }[]) => {
    const next: Partial<Record<keyof JobFormValues, string>> = {};
    issues.forEach((i) => { const k = i.path[0] as keyof JobFormValues; if (k && !next[k]) next[k] = i.message; });
    setErrors(next);
    return next;
  };

  const validateStep = (s: Step): boolean => {
    const full = jobFormSchema.safeParse(values);
    if (full.success) return true;
    const stepKeys: Record<Step, (keyof JobFormValues)[]> = {
      0: ['clientCompanyName', 'clientFirstName', 'clientLastName', 'clientAddress', 'clientPhone', 'clientPhone2', 'clientEmail', 'clientEmail2', 'billingFirstName', 'billingLastName', 'billingPhone', 'billingEmail'],
      1: ['jobDetails'],
      2: ['scheduledDate', 'scheduledTime'],
    };
    const mine = full.error.issues.filter((i) => stepKeys[s].includes(i.path[0] as keyof JobFormValues));
    applyIssues(mine);
    if (mine.length) toast.error(mine[0].message);
    return mine.length === 0;
  };

  const next = () => { if (validateStep(step)) setStep((s) => (s < 2 ? ((s + 1) as Step) : s)); };

  const uploadFiles = async () => {
    if (files.length === 0 || !user) return [];
    return upload(files, null, { append: false });
  };

  const submitJob = async () => {
    const parsed = jobFormSchema.safeParse(values);
    if (!parsed.success) { const issues = applyIssues(parsed.error.issues); toast.error(Object.values(issues)[0] ?? 'Check the form'); return; }
    setSaving('job');
    const media = await uploadFiles();
    const job = await actions.createJob(toJobCreateInput({ ...parsed.data, serviceType: unitServiceType ?? parsed.data.serviceType, category: unitCategory ?? parsed.data.category, durationMinutes: unitLength ?? parsed.data.durationMinutes }, employees, media));
    setSaving(null);
    if (job) router.replace({ pathname: '/job/[id]', params: { id: job.id } });
  };

  const saveCustomerOnly = async () => {
    if (!companyId) return;
    const parsed = customerOnlySchema.safeParse(values);
    if (!parsed.success) { applyIssues(parsed.error.issues); toast.error('A company or first and last name, an address and a valid phone are required to save a customer', { description: parsed.error.issues[0]?.message }); setStep(0); return; }
    setSaving('customer');
    const payload = toCustomerPayload(values, companyId);
    const result = values.customerId ? await customersService.update(values.customerId, payload) : await customersService.create(payload);
    setSaving(null);
    if (result.error || !result.data) { toast.error('Could not save customer', { description: result.error?.message }); return; }
    customers.upsertLocal(result.data);
    toast.success(values.customerId ? 'Customer updated' : 'Customer saved');
    router.back();
  };

  const addFiles = async (source: 'camera' | 'library') => { const items = await pickMedia(source, { multiple: true }); if (items.length) setFiles((f) => [...f, ...items]); };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'New job', headerLeft: () => <Button label="Cancel" variant="ghost" size="sm" onPress={() => router.back()} /> }} />
      <View style={styles.steps} accessibilityRole="progressbar" accessibilityLabel={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
        {STEPS.map((label, i) => (
          <View key={label} style={styles.stepItem}>
            <View style={[styles.stepBar, { backgroundColor: i <= step ? colors.accent : colors.border }]} />
            <Text variant="caption" color={i === step ? 'accent' : 'mutedForeground'}>{label}</Text>
          </View>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <>
            <View style={styles.rowBetween}>
              <Text variant="heading">Customer</Text>
              <Button label="Existing customer" variant="outline" size="sm" icon={<Search size={14} color={colors.foreground} />} onPress={() => setPickerOpen(true)} />
            </View>
            {values.customerId ? <View style={[styles.linked, { backgroundColor: withAlpha(colors.accent, 0.1) }]}><Text variant="caption" color="accent">Linked to an existing customer.</Text><Button label="Unlink" variant="ghost" size="sm" onPress={() => set('customerId', undefined)} /></View> : null}
            <CustomerFields values={values} errors={errors} set={set} units={units} divisions={company?.divisions ?? []} />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text variant="heading">Job</Text>
            <TextField label="Job details *" value={values.jobDetails} onChangeText={(v) => set('jobDetails', v)} multiline numberOfLines={4} style={styles.multiline} error={errors.jobDetails} />
            <TextField label="Important details" value={values.importantDetails} onChangeText={(v) => set('importantDetails', v)} multiline numberOfLines={2} style={styles.multiline} placeholder="Gate codes, pets, access…" />
            {unitServiceType ? <TextField label="Service type" value={unitServiceType} editable={false} hint="Set by the business unit" /> : <TextField label="Service type" value={values.serviceType} onChangeText={(v) => set('serviceType', v)} placeholder="e.g. Repair" />}
            {unitCategory ? <TextField label="Category" value={unitCategory} editable={false} hint="Set by the business unit" /> : (
              <Select label="Category" value={values.category || NONE} onChange={(v) => set('category', v === NONE ? '' : v)} options={[{ value: NONE, label: '—' }, ...categories.map((c) => ({ value: c.label, label: c.label }))]}
                extra={<View style={styles.addCategory}><View style={styles.grow}><TextField label="New category" value={newCategory} onChangeText={setNewCategory} /></View><Button label="Add" variant="outline" onPress={async () => { const c = await addCategory(newCategory); if (c) { set('category', c.label); setNewCategory(''); } }} /></View>} />
            )}
            <Select label="Priority" value={values.priority} onChange={(v) => set('priority', v)} options={PRIORITIES.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))} />
            {unitLength ? <TextField label="Job length" value={formatLength(Number(unitLength))} editable={false} hint="Set by the business unit" /> : (
              <Select label="Job length" value={values.durationMinutes || 'standard'} onChange={(v) => set('durationMinutes', v === 'standard' ? '' : v)} options={[{ value: 'standard', label: `${formatLength(DEFAULT_BLOCK_MINUTES)} (standard)` }, ...LENGTH_OPTIONS.filter((m) => m !== DEFAULT_BLOCK_MINUTES).map((m) => ({ value: String(m), label: formatLength(m) }))]} />
            )}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text variant="heading">Schedule</Text>
            <Select label="Technician" value={values.assignedUserId || NONE} onChange={(v) => set('assignedUserId', v === NONE ? '' : v)} options={[{ value: NONE, label: 'Unassigned' }, ...technicians.map((t) => ({ value: t.id, label: employeeOptionLabel(t), leading: <View style={[styles.dot, { backgroundColor: getContractorColor(t.name, t.color) }]} /> }))]} />
            <View style={styles.row}>
              <View style={styles.grow}><DateTimeField label="Date" mode="date" value={scheduledDate} onChange={(d) => set('scheduledDate', d ? format(d, 'yyyy-MM-dd') : '')} minimumDate={new Date()} error={errors.scheduledDate} /></View>
              <View style={styles.grow}><DateTimeField label="Time (15-min)" mode="time" value={scheduledTime} onChange={(d) => set('scheduledTime', d ? format(d, 'HH:mm') : '')} error={errors.scheduledTime} /></View>
            </View>
            {timeMinutes !== null ? <Text variant="caption" color="mutedForeground">Arrival window: {arrivalWindow(timeMinutes, lengthMinutes)}</Text> : <Text variant="caption" color="mutedForeground">Leave the date empty to create an unscheduled job.</Text>}
            <Text variant="label">Attachments</Text>
            <View style={styles.row}>
              <Button label="Take photo" variant="outline" size="sm" icon={<Camera size={14} color={colors.foreground} />} onPress={() => void addFiles('camera')} />
              <Button label="Choose" variant="outline" size="sm" icon={<ImageIcon size={14} color={colors.foreground} />} onPress={() => void addFiles('library')} />
            </View>
            {files.length > 0 ? (
              <View style={styles.chips}>
                {files.map((f, i) => (
                  <View key={`${f.name}-${i}`} style={[styles.chip, { backgroundColor: colors.muted }]}>
                    <Paperclip size={12} color={colors.mutedForeground} /><Text variant="caption" numberOfLines={1} style={styles.chipText}>{f.name}</Text>
                    <Button label="" variant="ghost" size="sm" icon={<X size={12} color={colors.mutedForeground} />} onPress={() => setFiles((p) => p.filter((_, k) => k !== i))} accessibilityLabel={`Remove ${f.name}`} />
                  </View>
                ))}
              </View>
            ) : null}
            <Card style={styles.summary}>
              <Text variant="overline" color="mutedForeground">Summary</Text>
              <Text variant="small">{[values.clientCompanyName, [values.clientSalutation, values.clientFirstName, values.clientLastName].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || '—'}</Text>
              <Text variant="caption" color="mutedForeground">{values.clientAddress || 'No address'} · {values.clientPhone || 'No phone'}</Text>
              <Text variant="small">{values.jobDetails || 'No job details'}</Text>
              <Text variant="caption" color="mutedForeground">{[unitServiceType ?? values.serviceType, unitCategory ?? values.category, values.priority].filter(Boolean).join(' · ')} · {formatLength(lengthMinutes)}</Text>
            </Card>
          </>
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        {step > 0 ? <Button label="Back" variant="outline" onPress={() => setStep((s) => (s - 1) as Step)} disabled={!!saving} /> : <Button label={values.customerId ? 'Update customer only' : 'Save customer only'} variant="ghost" onPress={() => void saveCustomerOnly()} loading={saving === 'customer'} disabled={!!saving} />}
        {step < 2 ? <Button label="Next" onPress={next} style={styles.grow} /> : <Button label="Create job" onPress={() => void submitJob()} loading={saving === 'job'} disabled={!!saving} style={styles.grow} />}
      </View>
      <CustomerPickerSheet open={pickerOpen} customers={customers.data ?? []} onClose={() => setPickerOpen(false)} onPick={(c) => { const v = customerToForm(c); setValues((cur) => ({ ...cur, ...v })); setErrors({}); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  steps: { flexDirection: 'row', gap: spacing[2], paddingHorizontal: spacing[4], paddingTop: spacing[3] },
  stepItem: { flex: 1, gap: 4 },
  stepBar: { height: 4, borderRadius: 2 },
  content: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
  row: { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  grow: { flex: 1, minWidth: 0 },
  narrow: { width: 112 },
  linked: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, paddingLeft: spacing[3] },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  addCategory: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2], paddingTop: spacing[2] },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing[1] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1] },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingLeft: spacing[2], maxWidth: 220 },
  chipText: { flexShrink: 1 },
  summary: { gap: 4 },
  footer: { flexDirection: 'row', gap: spacing[2], padding: spacing[4], borderTopWidth: StyleSheet.hairlineWidth },
});
