export function mergePreferences<T extends Record<string, unknown>>(
  longTerm: T,
  currentTurn: Partial<T>,
): T {
  const overrides = Object.fromEntries(
    Object.entries(currentTurn).filter(([, value]) => value !== undefined),
  ) as Partial<T>;

  return { ...longTerm, ...overrides };
}
