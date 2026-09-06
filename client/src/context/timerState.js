export function restoredDisplay(persisted, now = Date.now()) {
  if (!persisted) return 25 * 60;
  // A paused timer has no start timestamp; remainingBase is its source of truth.
  if (persisted.isPaused) return Number(persisted.remainingBase) || 25 * 60;
  if (persisted.isRunning && Number.isFinite(persisted.startTs)) {
    const total = (persisted.isBreak ? 5 : persisted.focusMin) * 60;
    return Math.max(0, total - Math.floor((now - persisted.startTs) / 1000));
  }
  return 25 * 60;
}
