/* eslint-disable import/first */
const mockStore = new Map<string, string>();
jest.mock('~/lib/storage', () => ({
  kv: {
    getString: (k: string) => mockStore.get(k) ?? null,
    setString: (k: string, v: string) => { mockStore.set(k, v); },
    getJSON: (k: string) => { const raw = mockStore.get(k); return raw ? JSON.parse(raw) : null; },
    setJSON: (k: string, v: unknown) => { mockStore.set(k, JSON.stringify(v)); },
    remove: (k: string) => { mockStore.delete(k); },
    removePrefix: () => undefined,
  },
}));
jest.mock('expo-file-system', () => ({ File: class { exists = false; delete() {} }, Directory: class { exists = true; create() {} }, Paths: { document: '/doc' } }));
const mockNet = { online: true };
jest.mock('~/api/client', () => ({ isOnline: () => mockNet.online }));
const mockUpdateJob = jest.fn();
const mockUpdateJobStatus = jest.fn();
const mockSend = jest.fn();
jest.mock('~/services/jobs', () => ({ jobsService: { updateJob: (...a: unknown[]) => mockUpdateJob(...a), updateJobStatus: (...a: unknown[]) => mockUpdateJobStatus(...a) } }));
jest.mock('~/services/messages', () => ({ messagesService: { send: (...a: unknown[]) => mockSend(...a) } }));
jest.mock('~/services/media', () => ({ mediaService: { uploadMedia: jest.fn(), appendJobMedia: jest.fn() } }));

import { enqueue, isTransient, readQueue, replay, retryStuck, useOfflineQueueStore, writeQueue, discard } from '~/services/offlineQueue';

const ok = { data: { id: 'x' }, error: null };
const apiError = (status: number, message = 'nope') => ({ data: null, error: { message, code: String(status), cause: { status } } });
const netError = { data: null, error: { message: 'offline', code: 'network' } };

beforeEach(() => { mockStore.clear(); mockNet.online = true; mockUpdateJob.mockReset(); mockUpdateJobStatus.mockReset(); mockSend.mockReset(); writeQueue([]); });

describe('offline queue', () => {
  it('enqueues in order and updates the store counts', () => {
    enqueue({ kind: 'job_status', jobId: 'j1', status: 'en-route', previousStatus: 'accepted' });
    enqueue({ kind: 'chat_message', jobId: 'j1', message: { senderId: 'u', senderName: 'Tom', content: 'hi' } });
    expect(readQueue().map((o) => o.kind)).toEqual(['job_status', 'chat_message']);
    expect(useOfflineQueueStore.getState()).toMatchObject({ queued: 2, stuck: 0 });
  });

  it('replays FIFO and sends the fix captured at enqueue time', async () => {
    mockUpdateJobStatus.mockResolvedValue(ok);
    mockSend.mockResolvedValue(ok);
    enqueue({ kind: 'job_status', jobId: 'j1', status: 'en-route', previousStatus: 'accepted', location: { latitude: 1, longitude: 2 }, actorIsContractor: true });
    enqueue({ kind: 'chat_message', jobId: 'j1', message: { senderId: 'u', senderName: 'Tom', content: 'hi' } });
    const report = await replay();
    expect(report).toMatchObject({ replayed: 2, remaining: 0, interrupted: false });
    expect(mockUpdateJobStatus).toHaveBeenCalledWith('j1', 'en-route', expect.objectContaining({ previousStatus: 'accepted', location: { latitude: 1, longitude: 2 }, skipLocation: false }));
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockUpdateJobStatus.mock.invocationCallOrder[0]).toBeLessThan(mockSend.mock.invocationCallOrder[0]);
    expect(readQueue()).toEqual([]);
  });

  it('stops at a transient failure (keeps the order) and retries next time', async () => {
    mockUpdateJobStatus.mockResolvedValueOnce(netError).mockResolvedValueOnce(ok);
    mockSend.mockResolvedValue(ok);
    enqueue({ kind: 'job_status', jobId: 'j1', status: 'en-route' });
    enqueue({ kind: 'chat_message', jobId: 'j1', message: { senderId: 'u', senderName: 'Tom', content: 'hi' } });
    const first = await replay();
    expect(first).toMatchObject({ replayed: 0, remaining: 2, interrupted: true });
    expect(mockSend).not.toHaveBeenCalled();
    expect(readQueue()[0]).toMatchObject({ attempts: 1, lastError: 'offline' });
    const second = await replay();
    expect(second).toMatchObject({ replayed: 2, remaining: 0 });
  });

  it('marks a refused change as stuck (needs attention) instead of dropping it, and keeps going', async () => {
    mockUpdateJobStatus.mockResolvedValue(apiError(400, 'Cannot move a job from completed to en-route'));
    mockSend.mockResolvedValue(ok);
    enqueue({ kind: 'job_status', jobId: 'j1', status: 'en-route' });
    enqueue({ kind: 'chat_message', jobId: 'j1', message: { senderId: 'u', senderName: 'Tom', content: 'hi' } });
    const report = await replay();
    expect(report).toMatchObject({ replayed: 1, remaining: 1, interrupted: false });
    expect(readQueue()[0]).toMatchObject({ kind: 'job_status', stuck: true, lastError: 'Cannot move a job from completed to en-route' });
    expect(useOfflineQueueStore.getState()).toMatchObject({ queued: 1, stuck: 1 });
    // stuck ops are skipped until retried or discarded
    await replay();
    expect(mockUpdateJobStatus).toHaveBeenCalledTimes(1);
    retryStuck();
    mockUpdateJobStatus.mockResolvedValue(ok);
    expect((await replay()).replayed).toBe(1);
    expect(readQueue()).toEqual([]);
  });

  it('gives up after MAX_ATTEMPTS transient failures and supports discard', async () => {
    mockUpdateJob.mockResolvedValue(netError);
    const op = enqueue({ kind: 'job_update', jobId: 'j1', patch: { notes: 'x' } })!;
    for (let i = 0; i < 5; i += 1) await replay();
    expect(readQueue()[0]).toMatchObject({ id: op.id, attempts: 5, stuck: true });
    discard(op.id);
    expect(readQueue()).toEqual([]);
  });

  it('keeps ops enqueued during a replay and does nothing while offline', async () => {
    mockUpdateJob.mockImplementation(async () => { enqueue({ kind: 'job_update', jobId: 'j2', patch: { notes: 'late' } }); return ok; });
    enqueue({ kind: 'job_update', jobId: 'j1', patch: { notes: 'x' } });
    const report = await replay();
    expect(report).toMatchObject({ replayed: 1, remaining: 1 });
    expect(readQueue()[0]).toMatchObject({ jobId: 'j2' });
    mockNet.online = false;
    mockUpdateJob.mockClear();
    expect(await replay()).toMatchObject({ replayed: 0, remaining: 1, interrupted: true });
    expect(mockUpdateJob).not.toHaveBeenCalled();
  });

  it('classifies errors', () => {
    expect(isTransient({ message: 'x', code: 'network' })).toBe(true);
    expect(isTransient({ message: 'x', code: '503', cause: { status: 503 } })).toBe(true);
    expect(isTransient({ message: 'x', code: '401', cause: { status: 401 } })).toBe(true);
    expect(isTransient({ message: 'x', code: '403', cause: { status: 403 } })).toBe(false);
    expect(isTransient({ message: 'x', code: 'workflow' })).toBe(false);
    expect(isTransient({ message: 'x' })).toBe(true);
  });
});
