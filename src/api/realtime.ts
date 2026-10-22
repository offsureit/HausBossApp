import { io } from 'socket.io-client';
import { REALTIME_URL } from '~/lib/env';
import { getSession, onAuthStateChange } from './session';
import type { RealtimeChange, RealtimeEventType, Unsubscribe } from '@/types';

/**
 * Socket.IO client for the API's realtime gateway (`/realtime`) — the same
 * channel names and `{ eventType, new, old }` payloads the web app consumes
 * (`src/api/realtime.ts`). `broadcast` carries the GPS ping protocol.
 */

export interface ChangeEvent<T = unknown> {
  channel: string;
  eventType: RealtimeEventType;
  table?: string;
  new: T | null;
  old: Partial<T> | null;
}

export interface BroadcastEvent<T = unknown> {
  channel: string;
  event: string;
  payload: T;
  from?: string;
}

type ChangeHandler = (event: ChangeEvent) => void;
type BroadcastHandler = (event: BroadcastEvent) => void;
type StatusHandler = (connected: boolean) => void;

interface SocketLike {
  connected: boolean;
  emit: (event: string, ...args: unknown[]) => unknown;
  on: (event: string, handler: (...args: never[]) => void) => unknown;
  disconnect: () => unknown;
  connect?: () => unknown;
  auth?: unknown;
}

let socket: SocketLike | null = null;
const changeHandlers = new Map<string, Set<ChangeHandler>>();
const broadcastHandlers = new Map<string, Set<BroadcastHandler>>();
const statusHandlers = new Set<StatusHandler>();
let authWatcherArmed = false;

let socketFactory: (token: string) => SocketLike = (token) =>
  io(REALTIME_URL, { path: '/realtime', auth: { token }, transports: ['websocket'], autoConnect: true, reconnection: true }) as unknown as SocketLike;

export function _setSocketFactoryForTests(factory: ((token: string) => SocketLike) | null): void {
  socketFactory = factory ?? ((token) => io(REALTIME_URL, { path: '/realtime', auth: { token } }) as unknown as SocketLike);
  disconnect();
}

function activeChannels(): string[] {
  return Array.from(new Set([...changeHandlers.keys(), ...broadcastHandlers.keys()]));
}

function notifyStatus(connected: boolean): void {
  for (const h of Array.from(statusHandlers)) {
    try { h(connected); } catch (err) { console.error('[realtime] status handler failed', err); }
  }
}

function ensureSocket(): SocketLike | null {
  if (socket) return socket;
  const session = getSession();
  if (!session) return null;
  const s = socketFactory(session.access_token);
  socket = s;
  s.on('connect', () => {
    for (const channel of activeChannels()) s.emit('subscribe', { channel });
    notifyStatus(true);
  });
  s.on('disconnect', () => notifyStatus(false));
  s.on('change', ((event: ChangeEvent) => {
    const set = changeHandlers.get(event.channel);
    if (!set) return;
    for (const h of Array.from(set)) {
      try { h(event); } catch (err) { console.error('[realtime] change handler failed', err); }
    }
  }) as (...args: never[]) => void);
  s.on('broadcast', ((event: BroadcastEvent) => {
    const set = broadcastHandlers.get(event.channel);
    if (!set) return;
    for (const h of Array.from(set)) {
      try { h(event); } catch (err) { console.error('[realtime] broadcast handler failed', err); }
    }
  }) as (...args: never[]) => void);
  s.on('connect_error', ((err: { message?: string }) => {
    // Token may have rotated — pick up the latest before the next attempt.
    const latest = getSession();
    if (latest && typeof s.auth === 'object' && s.auth) (s.auth as { token?: string }).token = latest.access_token;
    if (err?.message && /unauthori[sz]ed/i.test(err.message) && !latest) disconnect();
  }) as (...args: never[]) => void);
  armAuthWatcher();
  return s;
}

function armAuthWatcher(): void {
  if (authWatcherArmed) return;
  authWatcherArmed = true;
  onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      disconnect();
      return;
    }
    if (socket && typeof socket.auth === 'object' && socket.auth) (socket.auth as { token?: string }).token = session.access_token;
    if (!socket && activeChannels().length > 0) {
      const s = ensureSocket();
      if (s?.connected) for (const channel of activeChannels()) s.emit('subscribe', { channel });
    }
  });
}

function join(channel: string): void {
  const s = ensureSocket();
  if (s?.connected) s.emit('subscribe', { channel });
}

function leaveIfUnused(channel: string): void {
  if (changeHandlers.has(channel) || broadcastHandlers.has(channel)) return;
  socket?.emit('unsubscribe', { channel });
}

/** Listen to row changes on a channel. */
export function subscribe<T>(channel: string, onChange: (change: RealtimeChange<T>) => void): Unsubscribe {
  const handler: ChangeHandler = (event) => onChange({ eventType: event.eventType, new: event.new as T | null, old: event.old as Partial<T> | null, table: event.table });
  const set = changeHandlers.get(channel) ?? new Set<ChangeHandler>();
  const fresh = set.size === 0;
  set.add(handler);
  changeHandlers.set(channel, set);
  if (fresh) join(channel);
  return () => {
    const current = changeHandlers.get(channel);
    current?.delete(handler);
    if (current && current.size === 0) changeHandlers.delete(channel);
    leaveIfUnused(channel);
  };
}

/** Listen to broadcast events on a channel (optionally one event name). */
export function onBroadcast<T = unknown>(channel: string, event: string | null, handler: (payload: T, meta: BroadcastEvent<T>) => void): Unsubscribe {
  const wrapped: BroadcastHandler = (ev) => {
    if (event && ev.event !== event) return;
    handler(ev.payload as T, ev as BroadcastEvent<T>);
  };
  const set = broadcastHandlers.get(channel) ?? new Set<BroadcastHandler>();
  const fresh = set.size === 0;
  set.add(wrapped);
  broadcastHandlers.set(channel, set);
  if (fresh) join(channel);
  return () => {
    const current = broadcastHandlers.get(channel);
    current?.delete(wrapped);
    if (current && current.size === 0) broadcastHandlers.delete(channel);
    leaveIfUnused(channel);
  };
}

/** Send a broadcast to everyone in the channel (server re-checks permissions). */
export function broadcast(channel: string, event: string, payload: unknown): boolean {
  const s = ensureSocket();
  if (!s) return false;
  s.emit('broadcast', { channel, event, payload });
  return true;
}

/** Connection status for the UI (offline banner, diagnostics). */
export function onConnectionChange(handler: StatusHandler): Unsubscribe {
  statusHandlers.add(handler);
  return () => { statusHandlers.delete(handler); };
}

/** Open the socket now (normally it opens lazily on the first subscribe). */
export function connect(): void {
  ensureSocket();
}

export function isConnected(): boolean {
  return !!socket?.connected;
}

export function disconnect(): void {
  const s = socket;
  socket = null;
  try { s?.disconnect(); } catch { /* ignore */ }
  notifyStatus(false);
}

export function _resetRealtimeForTests(): void {
  changeHandlers.clear();
  broadcastHandlers.clear();
  disconnect();
}

export const realtime = { subscribe, onBroadcast, broadcast, connect, disconnect, isConnected, onConnectionChange };
