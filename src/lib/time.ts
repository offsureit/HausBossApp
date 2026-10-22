import { formatDistanceToNowStrict } from 'date-fns';

/** "just now" under a minute (server / device clocks differ by a few seconds), else "5 minutes ago". */
export function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  if (Math.abs(Date.now() - t) < 60_000) return 'just now';
  return formatDistanceToNowStrict(new Date(t), { addSuffix: true });
}
