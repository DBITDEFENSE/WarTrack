import type { Vector2 } from '../types/index.ts';

export function distance(a: Vector2, b: Vector2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function normalize(v: Vector2): Vector2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function direction(from: Vector2, to: Vector2): Vector2 {
  return normalize({ x: to.x - from.x, y: to.y - from.y });
}

export function angleBetween(from: Vector2, to: Vector2): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

export function lerpVec2(a: Vector2, b: Vector2, t: number): Vector2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Interpolate along a polyline path. t = 0..1 */
export function getPointOnPath(path: Vector2[], t: number): Vector2 {
  if (path.length < 2) return path[0] || { x: 0, y: 0 };
  const totalSegments = path.length - 1;
  const segFloat = t * totalSegments;
  const segIndex = Math.min(Math.floor(segFloat), totalSegments - 1);
  const segT = segFloat - segIndex;
  return lerpVec2(path[segIndex], path[segIndex + 1], segT);
}

/** Get angle along a polyline path at t */
export function getAngleOnPath(path: Vector2[], t: number): number {
  if (path.length < 2) return 0;
  const totalSegments = path.length - 1;
  const segIndex = Math.min(Math.floor(t * totalSegments), totalSegments - 1);
  return angleBetween(path[segIndex], path[segIndex + 1]);
}
