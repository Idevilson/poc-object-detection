export function adaptiveTrackingAlpha(
  delta: number,
  responsePx: number,
  minAlpha: number,
  maxAlpha: number,
): number {
  'worklet';

  const response = Math.min(delta / responsePx, 1);
  return minAlpha + response * (maxAlpha - minAlpha);
}

export function smoothTrackingValue(
  current: number,
  next: number,
  epsilon: number,
  responsePx: number,
  minAlpha: number,
  maxAlpha: number,
): number {
  'worklet';

  const delta = next - current;
  const distance = Math.abs(delta);
  if (distance <= epsilon) {
    return current;
  }
  const alpha = adaptiveTrackingAlpha(distance, responsePx, minAlpha, maxAlpha);
  return current + delta * alpha;
}
