/* eslint-disable import/first */
jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn(), AndroidImportance: { MAX: 5 } }));
jest.mock('expo-device', () => ({ isDevice: true, modelName: 'Pixel' }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0', extra: {} }, sessionId: 's' } }));
jest.mock('~/api/realtime', () => ({ isConnected: () => true }));
jest.mock('~/lib/storage', () => ({ kv: { getString: jest.fn(), setString: jest.fn(), remove: jest.fn() } }));

import { parsePushData, projectId, routeForPush } from '~/services/push';

describe('push helpers', () => {
  it('reads the server payload defensively', () => {
    expect(parsePushData({ notificationId: 'n1', type: 'chat_message', jobId: 'j1' })).toEqual({ notificationId: 'n1', type: 'chat_message', jobId: 'j1', conversationId: undefined });
    expect(parsePushData(null)).toEqual({});
    expect(parsePushData({ jobId: 42 })).toEqual({ notificationId: undefined, type: undefined, jobId: undefined, conversationId: undefined });
  });

  it('routes a tap to the thread, the job (chat tab for chat) or the notification centre', () => {
    expect(routeForPush({ conversationId: 'c1', jobId: 'j1' })).toEqual({ pathname: '/messages/[id]', params: { id: 'c1' } });
    expect(routeForPush({ jobId: 'j1', type: 'chat_message' })).toEqual({ pathname: '/job/[id]', params: { id: 'j1', tab: 'chat' } });
    expect(routeForPush({ jobId: 'j1', type: 'status_change' })).toEqual({ pathname: '/job/[id]', params: { id: 'j1' } });
    expect(routeForPush({})).toEqual({ pathname: '/notifications' });
  });

  it('has no EAS project id until eas init writes one', () => {
    expect(projectId()).toBeNull();
  });
});
