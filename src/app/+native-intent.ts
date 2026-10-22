import { resolveSystemPath } from '~/lib/deepLinks';

/** expo-router hook for incoming URLs (universal links, the custom scheme, push taps). */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  try {
    return resolveSystemPath(path) ?? path;
  } catch {
    return path;
  }
}
