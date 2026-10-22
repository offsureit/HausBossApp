import { StyleSheet, View } from 'react-native';
import { EMAIL_TYPES, PHONE_TYPES, SALUTATIONS, type JobFormValues } from '@/components/jobForm/schema';
import type { BusinessUnit, Division, DivisionSettings } from '@/types';
import { Card, Select, Text, TextField, Toggle } from '~/components/ui';
import { spacing } from '~/theme/tokens';

const NONE = 'none';
const DIVISIONS: { value: '' | Division; label: string }[] = [{ value: '', label: 'Not set' }, { value: 'residential', label: 'Residential' }, { value: 'commercial', label: 'Commercial' }];

export type CustomerFieldKey = 'clientCompanyName' | 'clientSalutation' | 'clientFirstName' | 'clientLastName' | 'clientAddress' | 'clientPhone' | 'clientPhoneType' | 'clientPhone2' | 'clientPhone2Type' | 'clientEmail' | 'clientEmailType' | 'clientEmail2' | 'clientEmail2Type' | 'billingDiffers' | 'billingCompanyName' | 'billingFirstName' | 'billingLastName' | 'billingAddress' | 'billingPhone' | 'billingEmail' | 'businessUnitId' | 'division';

export interface CustomerFieldsProps {
  values: JobFormValues;
  errors: Partial<Record<keyof JobFormValues, string>>;
  set: <K extends CustomerFieldKey>(key: K, value: JobFormValues[K]) => void;
  units?: BusinessUnit[];
  divisions?: DivisionSettings[];
  /** Hide the contact-type selects (customer record only stores the numbers). */
  showTypes?: boolean;
}

/**
 * The customer contact + billing fields of the shared job form schema (web `JobCreationForm` /
 * `CustomerDialog`), used by New job, New customer and Edit customer.
 */
export function CustomerFields({ values, errors, set, units = [], divisions = [], showTypes = true }: CustomerFieldsProps) {
  const hasDivisions = divisions.some((d) => d.legalName || d.telnyxNumber);
  const pickUnit = (id: string) => { const u = units.find((x) => x.id === id); set('businessUnitId', id); if (u?.division) set('division', u.division); };
  const pickDivision = (d: '' | Division) => { const current = units.find((u) => u.id === values.businessUnitId); if (current?.division && current.division !== d) set('businessUnitId', ''); set('division', d); };
  return (
    <>
      <TextField label="Company name" value={values.clientCompanyName} onChangeText={(v) => set('clientCompanyName', v)} placeholder="Leave empty for a private customer" error={errors.clientCompanyName} hint="Enter a company name, a first and last name, or both." />
      {units.length > 0 ? <Select label="Business unit" value={values.businessUnitId || NONE} onChange={(v) => pickUnit(v === NONE ? '' : v)} options={[{ value: NONE, label: 'None' }, ...units.map((u) => ({ value: u.id, label: u.name }))]} /> : null}
      {units.length > 0 || hasDivisions ? <Select label="Division" value={values.division || NONE} onChange={(v) => pickDivision(v === NONE ? '' : (v as Division))} options={DIVISIONS.map((d) => ({ value: d.value || NONE, label: d.label }))} /> : null}
      <View style={styles.row}>
        <View style={styles.narrow}><Select label="Title" value={values.clientSalutation || NONE} onChange={(v) => set('clientSalutation', v === NONE ? '' : v)} options={SALUTATIONS.map((s) => ({ value: s || NONE, label: s || '—' }))} /></View>
        <View style={styles.grow}><TextField label="First name" value={values.clientFirstName} onChangeText={(v) => set('clientFirstName', v)} autoComplete="given-name" error={errors.clientFirstName} /></View>
      </View>
      <TextField label="Last name" value={values.clientLastName} onChangeText={(v) => set('clientLastName', v)} autoComplete="family-name" error={errors.clientLastName} />
      <TextField label="Service address *" value={values.clientAddress} onChangeText={(v) => set('clientAddress', v)} autoComplete="street-address" error={errors.clientAddress} multiline />
      <View style={styles.row}>
        <View style={styles.grow}><TextField label="Phone *" value={values.clientPhone} onChangeText={(v) => set('clientPhone', v)} keyboardType="phone-pad" autoComplete="tel" error={errors.clientPhone} /></View>
        {showTypes ? <View style={styles.narrow}><Select label="Type" value={values.clientPhoneType} onChange={(v) => set('clientPhoneType', v)} options={PHONE_TYPES.map((t) => ({ value: t, label: t }))} /></View> : null}
      </View>
      <View style={styles.row}>
        <View style={styles.grow}><TextField label="Second phone" value={values.clientPhone2} onChangeText={(v) => set('clientPhone2', v)} keyboardType="phone-pad" error={errors.clientPhone2} /></View>
        {showTypes ? <View style={styles.narrow}><Select label="Type" value={values.clientPhone2Type} onChange={(v) => set('clientPhone2Type', v)} options={PHONE_TYPES.map((t) => ({ value: t, label: t }))} /></View> : null}
      </View>
      <View style={styles.row}>
        <View style={styles.grow}><TextField label="Email" value={values.clientEmail} onChangeText={(v) => set('clientEmail', v)} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={errors.clientEmail} /></View>
        {showTypes ? <View style={styles.narrow}><Select label="Type" value={values.clientEmailType} onChange={(v) => set('clientEmailType', v)} options={EMAIL_TYPES.map((t) => ({ value: t, label: t }))} /></View> : null}
      </View>
      <View style={styles.row}>
        <View style={styles.grow}><TextField label="Second email" value={values.clientEmail2} onChangeText={(v) => set('clientEmail2', v)} keyboardType="email-address" autoCapitalize="none" error={errors.clientEmail2} /></View>
        {showTypes ? <View style={styles.narrow}><Select label="Type" value={values.clientEmail2Type} onChange={(v) => set('clientEmail2Type', v)} options={EMAIL_TYPES.map((t) => ({ value: t, label: t }))} /></View> : null}
      </View>
      <Card style={styles.rowBetween}>
        <Text variant="small" style={styles.grow}>Billing contact differs from customer</Text>
        <Toggle value={values.billingDiffers} onValueChange={(v) => set('billingDiffers', v)} accessibilityLabel="Billing contact differs from customer" />
      </Card>
      {values.billingDiffers ? (
        <>
          <TextField label="Billing company name" value={values.billingCompanyName} onChangeText={(v) => set('billingCompanyName', v)} placeholder="Leave empty to bill a person" />
          <View style={styles.row}>
            <View style={styles.grow}><TextField label="Billing first name" value={values.billingFirstName} onChangeText={(v) => set('billingFirstName', v)} error={errors.billingFirstName} /></View>
            <View style={styles.grow}><TextField label="Billing last name" value={values.billingLastName} onChangeText={(v) => set('billingLastName', v)} error={errors.billingLastName} /></View>
          </View>
          <TextField label="Billing address" value={values.billingAddress} onChangeText={(v) => set('billingAddress', v)} multiline />
          <TextField label="Billing phone" value={values.billingPhone} onChangeText={(v) => set('billingPhone', v)} keyboardType="phone-pad" error={errors.billingPhone} />
          <TextField label="Billing email" value={values.billingEmail} onChangeText={(v) => set('billingEmail', v)} keyboardType="email-address" autoCapitalize="none" error={errors.billingEmail} />
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  grow: { flex: 1, minWidth: 0 },
  narrow: { width: 112 },
});
