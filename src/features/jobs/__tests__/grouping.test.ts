import { groupTechnicianJobs, isMine, nextJob } from '../grouping';
import type { Job } from '@/types';

const base: Job = {
  id: '', companyId: 'c', customerId: '', clientName: '', clientSalutation: '', clientFirstName: '', clientLastName: '', clientAddress: '', clientPhone: '', clientPhoneType: 'mobile', clientPhone2: '', clientPhone2Type: '', clientEmail: '', clientEmailType: 'personal', clientEmail2: '', clientEmail2Type: '', billingName: '', billingAddress: '', billingPhone: '', billingEmail: '', jobDetails: '', importantDetails: '', serviceType: '', category: '', assignedTo: '', assignedUserId: null, status: 'pending', priority: 'medium', scheduledDate: '', createdAt: '', updatedAt: '', createdBy: null, notes: '', activity: [], timeEntries: [], mediaUrls: [], sortOrder: null, metadata: {},
};
const job = (o: Partial<Job>): Job => ({ ...base, ...o });
const now = new Date('2026-10-21T15:00:00');
const at = (d: string) => new Date(d).toISOString();

describe('technician job grouping', () => {
  it('buckets overdue + today first (earliest first), upcoming next, completed latest first', () => {
    const groups = groupTechnicianJobs([
      job({ id: 'tomorrow', scheduledDate: at('2026-10-22T09:00:00') }),
      job({ id: 'today-pm', scheduledDate: at('2026-10-21T16:00:00') }),
      job({ id: 'overdue', scheduledDate: at('2026-10-19T09:00:00') }),
      job({ id: 'done-old', status: 'completed', scheduledDate: at('2026-10-10T09:00:00') }),
      job({ id: 'done-new', status: 'completed', scheduledDate: at('2026-10-20T09:00:00') }),
      job({ id: 'unscheduled' }),
      job({ id: 'today-am', scheduledDate: at('2026-10-21T08:00:00') }),
    ], now);
    expect(groups.today.map((j) => j.id)).toEqual(['unscheduled', 'overdue', 'today-am', 'today-pm']);
    expect(groups.upcoming.map((j) => j.id)).toEqual(['tomorrow']);
    expect(groups.completed.map((j) => j.id)).toEqual(['done-new', 'done-old']);
  });

  it('picks the live job as next, else the first of today', () => {
    const groups = groupTechnicianJobs([
      job({ id: 'a', scheduledDate: at('2026-10-21T08:00:00') }),
      job({ id: 'b', status: 'in-progress', scheduledDate: at('2026-10-21T10:00:00') }),
    ], now);
    expect(nextJob(groups)?.id).toBe('b');
    expect(nextJob(groupTechnicianJobs([job({ id: 'a', scheduledDate: at('2026-10-21T08:00:00') })], now))?.id).toBe('a');
    expect(nextJob(groupTechnicianJobs([], now))).toBeNull();
  });

  it('matches my jobs by id or by legacy display name', () => {
    const me = { id: 'u1', firstName: 'Tom', lastName: 'Tech' };
    expect(isMine(job({ assignedUserId: 'u1' }), me)).toBe(true);
    expect(isMine(job({ assignedUserId: 'u2' }), me)).toBe(false);
    expect(isMine(job({ assignedTo: 'Tom T.' }), me)).toBe(true);
    expect(isMine(job({ assignedTo: 'Someone Else' }), me)).toBe(false);
    expect(isMine(job({}), null)).toBe(true);
  });
});
