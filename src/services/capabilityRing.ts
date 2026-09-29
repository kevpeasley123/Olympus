import type { CapabilityDomain } from "./capabilities";

/**
 * The Command ring's sectors: one per capability domain, in the backend's
 * order, clockwise from twelve o'clock, with a gap at the top where the
 * project ring always had one. Equal sectors, because a domain's
 * importance is not its item count; the count is printed, not drawn as width.
 */
export interface RingSegment {
  id: string;
  label: string;
  count: number;
  available: boolean;
  startAngle: number;
  endAngle: number;
  midAngle: number;
}
export interface CapabilityRingLayout { segments: RingSegment[]; gapAngle: number }

export const RING_GAP_ANGLE = 3.2;

export function layoutCapabilityRing(domains: CapabilityDomain[], gapAngle = RING_GAP_ANGLE): CapabilityRingLayout {
  const sector = domains.length ? 360 / domains.length : 360;
  const segments = domains.map((domain, index) => {
    const midAngle = index * sector + sector / 2;
    return {
      id: domain.id,
      label: domain.label,
      count: domain.tools + domain.skills,
      available: domain.available > 0,
      startAngle: midAngle - sector / 2 + gapAngle / 2,
      endAngle: midAngle + sector / 2 - gapAngle / 2,
      midAngle
    };
  });
  return { segments, gapAngle };
}

/** The engraved or drawn name: the label, with its count when both fit. */
export function segmentCaption(segment: RingSegment, capacity: number): string {
  const name = segment.label.toUpperCase();
  const withCount = `${name} · ${segment.count}`;
  if (withCount.length <= capacity) return withCount;
  if (name.length <= capacity) return name;
  return capacity <= 1 ? "…" : `${name.slice(0, capacity - 1).trimEnd()}…`;
}
