import { Entry, entryValue } from './entries';

export const TARGET = 15;

/**
 * All combinations of table cards whose value, together with the played card,
 * total exactly 15. Only entries with a known numeric value can be captured.
 */
export function legalCaptures(table: Entry[], playedValue: number): Entry[][] {
  const target = TARGET - playedValue;
  if (target <= 0) return [];
  const candidates = table.filter((e) => entryValue(e) !== null);
  const found: Entry[][] = [];
  const visit = (start: number, sum: number, picked: Entry[]) => {
    if (sum === target) {
      if (picked.length) found.push([...picked]);
      return;
    }
    if (sum > target) return;
    for (let i = start; i < candidates.length; i += 1) {
      const v = entryValue(candidates[i]);
      if (v === null) continue;
      if (sum + v > target) continue;
      picked.push(candidates[i]);
      visit(i + 1, sum + v, picked);
      picked.pop();
    }
  };
  visit(0, 0, []);
  return found;
}

export function hasCapture(table: Entry[], playedValue: number): boolean {
  return legalCaptures(table, playedValue).length > 0;
}

export function anyCaptureAvailable(hand: Entry[], table: Entry[]): boolean {
  return hand.some((e) => {
    const v = entryValue(e);
    return v !== null && hasCapture(table, v);
  });
}

export function captureTotal(capture: Entry[]): number {
  return capture.reduce((sum, e) => sum + (entryValue(e) ?? 0), 0);
}

export function isSameCapture(a: Entry[], b: Entry[]): boolean {
  if (a.length !== b.length) return false;
  const ids = new Set(b.map((e) => e.id));
  return a.every((e) => ids.has(e.id));
}

export function isSweep(table: Entry[], capture: Entry[]): boolean {
  return capture.length > 0 && capture.length === table.length;
}

export function tableSum(table: Entry[]): number | null {
  let total = 0;
  for (const e of table) {
    const v = entryValue(e);
    if (v === null) return null;
    total += v;
  }
  return total;
}
