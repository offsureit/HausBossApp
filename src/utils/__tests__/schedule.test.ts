// Same rule as the web (shared/utils/schedule.ts): the window ended and the technician has not arrived.
import { lateLabel, runningLate } from '@/utils/schedule';

const at = (h: number, m = 0) => new Date(2026, 9, 22, h, m);
const job = (status: string, durationMinutes: number | null = null) => ({ status, scheduledDate: at(13).toISOString(), durationMinutes });

describe('runningLate', () => {
  it('is late once the window ends while pending, accepted or on the way', () => {
    for (const s of ['pending', 'accepted', 'en-route']) expect(runningLate(job(s), at(21))?.getTime()).toBe(at(15).getTime());
    expect(runningLate(job('en-route'), at(14, 59))).toBeNull();
    expect(runningLate(job('accepted', 240), at(16))).toBeNull();
  });

  it('is not late once the technician has arrived', () => {
    for (const s of ['arrived', 'in-progress', 'completed']) expect(runningLate(job(s), at(21))).toBeNull();
  });

  it('labels the end of the window', () => {
    expect(lateLabel(at(15), at(21))).toBe('Late · window ended 3:00 PM');
  });
});
