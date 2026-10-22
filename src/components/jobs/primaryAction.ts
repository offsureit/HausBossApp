import { CheckCircle2, LogIn, MapPin, Navigation, ThumbsUp } from 'lucide-react-native';
import type { JobStatus } from '@/types';

export type PrimaryActionKind = 'accept' | 'on-my-way' | 'arrived' | 'clock-in' | 'complete' | null;

export interface PrimaryAction {
  label: string;
  icon: typeof ThumbsUp;
  kind: PrimaryActionKind;
}

/** The technician's next action for a status (§8.4) — same table as the web `ContractorDashboard`. */
export function primaryActionFor(status: JobStatus): PrimaryAction {
  switch (status) {
    case 'pending': return { label: 'Accept', icon: ThumbsUp, kind: 'accept' };
    case 'accepted': return { label: 'On My Way', icon: Navigation, kind: 'on-my-way' };
    case 'en-route': return { label: 'At Job Site', icon: MapPin, kind: 'arrived' };
    case 'arrived': return { label: 'Clock In', icon: LogIn, kind: 'clock-in' };
    case 'in-progress': return { label: 'Complete', icon: CheckCircle2, kind: 'complete' };
    default: return { label: 'Done', icon: CheckCircle2, kind: null };
  }
}
