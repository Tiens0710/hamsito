import { isDeepStrictEqual } from 'node:util';
export const PROFILE_REVISION = Symbol('profileRevision');
export class ProfileConflictError extends Error {
  constructor() {
    super('Tiến độ vừa thay đổi ở phiên khác. Tải lại trang trước khi tiếp tục nhé.');
    this.name = 'ProfileConflictError';
    this.status = 409;
  }
}
export function withRevision(payload, revision) {
  if (payload)
    Object.defineProperty(payload, PROFILE_REVISION, {
      value: revision,
      configurable: true,
    });
  return payload;
}
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const transient = new Set([
  'progress.updatedAt',
  'progress.learning.selectedCardId',
  'progress.learning.vocabulary.selectedSet',
]);

// Apply only this request's changes to a newer profile. Conflicting edits require
// an explicit reload; AI requests are never silently repeated to resolve a race.
export function mergeProfileChanges(base, proposed, current, path = '') {
  if (isDeepStrictEqual(base, proposed)) return structuredClone(current);
  if (isDeepStrictEqual(current, base) || isDeepStrictEqual(current, proposed))
    return structuredClone(proposed);
  if (transient.has(path)) return structuredClone(proposed);
  if (object(proposed) && object(current) && (object(base) || base === undefined)) {
    const merged = {};
    for (const key of new Set([
      ...Object.keys(base || {}),
      ...Object.keys(proposed),
      ...Object.keys(current),
    ])) {
      const value = mergeProfileChanges(
        base?.[key],
        proposed[key],
        current[key],
        path ? `${path}.${key}` : key,
      );
      if (value !== undefined) merged[key] = value;
    }
    return merged;
  }
  throw new ProfileConflictError();
}
