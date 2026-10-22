import { pickerEntries, toLineItem } from '~/services/catalog';
import type { CatalogItem } from '@/types';

const item = (over: Partial<CatalogItem>): CatalogItem => ({ id: 'i1', company_id: 'co', kind: 'part', name: 'Capacitor', description: null, unit: 'ea', unit_price: 79, is_active: true, sort_order: 0, created_at: '', updated_at: '', ...over });

describe('catalog picker entries', () => {
  it('lists the company items first, then the built-in HVAC seed', () => {
    const entries = pickerEntries([item({}), item({ id: 'i2', name: 'Old', is_active: false })]);
    expect(entries[0]).toMatchObject({ id: 'i1', source: 'company', name: 'Capacitor', unit_price: 79 });
    expect(entries.some((e) => e.name === 'Old')).toBe(false);
    expect(entries.filter((e) => e.source === 'builtin').length).toBeGreaterThan(20);
    expect(entries.every((e) => e.kind === 'part' || e.kind === 'service')).toBe(true);
  });

  it('turns an entry into a quantity-1 line item that keeps the catalog link', () => {
    const [entry] = pickerEntries([item({ description: 'Run cap' })]);
    expect(toLineItem(entry)).toEqual({ kind: 'part', name: 'Capacitor', description: 'Run cap', quantity: 1, unit: 'ea', unit_price: 79, catalog_item_id: 'i1' });
  });
});
