/** Locale-independent ordering for checksum-affecting simulation data. */
export function compareOrdinal(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
