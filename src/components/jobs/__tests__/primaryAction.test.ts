import { JOB_STATUSES, isValidTransition, nextStatus } from '@/utils/jobStatus';
import type { JobStatus } from '@/types';
import { primaryActionFor } from '../primaryAction';

/** Status rules as the app applies them: the technician's one-tap action and what each role may skip to. */
describe('status rules', () => {
  it('maps every status to the technician primary action (§8.4)', () => {
    expect(JOB_STATUSES.map((s) => [s, primaryActionFor(s).label, primaryActionFor(s).kind])).toEqual([
      ['pending', 'Accept', 'accept'],
      ['accepted', 'On My Way', 'on-my-way'],
      ['en-route', 'At Job Site', 'arrived'],
      ['arrived', 'Clock In', 'clock-in'],
      ['in-progress', 'Complete', 'complete'],
      ['completed', 'Done', null],
    ]);
  });

  it('the primary action always targets the next linear status', () => {
    const target: Record<Exclude<JobStatus, 'completed'>, JobStatus> = { pending: 'accepted', accepted: 'en-route', 'en-route': 'arrived', arrived: 'in-progress', 'in-progress': 'completed' };
    for (const [from, to] of Object.entries(target) as [JobStatus, JobStatus][]) {
      expect(nextStatus(from)).toBe(to);
      expect(isValidTransition(from, to, { isStaff: false })).toBe(true);
      expect(isValidTransition(from, to, { isStaff: true })).toBe(true);
    }
    expect(nextStatus('completed')).toBeNull();
  });

  it('technicians move one step at a time; staff may jump or move back', () => {
    // Technician: no skipping, no going back.
    expect(isValidTransition('pending', 'in-progress', { isStaff: false })).toBe(false);
    expect(isValidTransition('arrived', 'accepted', { isStaff: false })).toBe(false);
    expect(isValidTransition('completed', 'in-progress', { isStaff: false })).toBe(false);
    // Staff (the status stepper on the job hub).
    expect(isValidTransition('pending', 'in-progress', { isStaff: true })).toBe(true);
    expect(isValidTransition('arrived', 'accepted', { isStaff: true })).toBe(true);
    expect(isValidTransition('completed', 'in-progress', { isStaff: true })).toBe(true);
  });

  it('setting the same status is a no-op that is always allowed (web rule)', () => {
    for (const s of JOB_STATUSES) {
      expect(isValidTransition(s, s, { isStaff: true })).toBe(true);
      expect(isValidTransition(s, s, { isStaff: false })).toBe(true);
    }
  });
});
