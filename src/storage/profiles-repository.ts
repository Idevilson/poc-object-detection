import { API_BASE_URL, API_TIMEOUT_MS } from '../config/api';
import type { Profile } from '../types';
import { decodeBase64, encodeBase64 } from '../utils/base64';

/**
 * Wire shape of one identity.
 *
 * `enrollment` is the native `EnrollmentCodec` payload in base64 — the app
 * never interprets it, and neither should the backend. Store it as `BYTEA`.
 */
interface ProfilePayload {
  id: string;
  fullName: string;
  enrolledAt: number;
  sampleCount: number;
  enrollment: string;
}

export interface PersistedProfile {
  profile: Profile;
  enrollment: ArrayBuffer;
}

/**
 * Remote gallery. Every method talks to the backend, which is authoritative:
 * there is no local fallback, so a failure surfaces instead of serving stale
 * identities.
 */
export interface ProfilesRepository {
  list(signal?: AbortSignal): Promise<PersistedProfile[]>;
  upsert(profile: Profile, enrollment: ArrayBuffer): Promise<void>;
  remove(id: string): Promise<void>;
}

function profilesUrl(id?: string): string {
  const base = `${API_BASE_URL.replace(/\/+$/, '')}/face-profiles`;
  return id == null ? base : `${base}/${encodeURIComponent(id)}`;
}

/**
 * Fetch with a hard deadline.
 *
 * A caller-supplied signal is honoured too, so unmounting cancels an in-flight
 * load instead of resolving into a dead component.
 */
async function request(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const onAbort = (): void => controller.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(
        `${init.method ?? 'GET'} ${url} failed: ${response.status} ${response.statusText}`,
      );
    }
    return response;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

function parsePayload(value: unknown): PersistedProfile {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    throw new TypeError('Expected a profile object');
  }

  const payload = value as Record<keyof ProfilePayload, unknown>;
  if (
    typeof payload.id !== 'string' ||
    payload.id.length === 0 ||
    typeof payload.fullName !== 'string' ||
    typeof payload.enrolledAt !== 'number' ||
    !Number.isFinite(payload.enrolledAt) ||
    typeof payload.sampleCount !== 'number' ||
    !Number.isInteger(payload.sampleCount) ||
    payload.sampleCount <= 0 ||
    typeof payload.enrollment !== 'string' ||
    payload.enrollment.length === 0
  ) {
    throw new TypeError(
      `Invalid profile payload for ID "${String(payload.id)}"`,
    );
  }

  const enrollment = decodeBase64(payload.enrollment);
  if (enrollment.byteLength === 0) {
    throw new TypeError(`Empty enrollment for ID "${payload.id}"`);
  }

  return {
    profile: {
      id: payload.id,
      fullName: payload.fullName,
      enrolledAt: payload.enrolledAt,
      sampleCount: payload.sampleCount,
    },
    enrollment,
  };
}

function toPayload(
  profile: Profile,
  enrollment: ArrayBuffer,
): ProfilePayload {
  if (enrollment.byteLength === 0) {
    throw new TypeError(
      `Refusing to upload an empty enrollment for ID "${profile.id}"`,
    );
  }

  return {
    id: profile.id,
    fullName: profile.fullName,
    enrolledAt: profile.enrolledAt,
    sampleCount: profile.sampleCount,
    enrollment: encodeBase64(enrollment),
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createProfilesRepository(): ProfilesRepository {
  return {
    async list(signal?: AbortSignal): Promise<PersistedProfile[]> {
      const response = await request(
        profilesUrl(),
        { method: 'GET', headers: { Accept: 'application/json' } },
        signal,
      );
      const body: unknown = await response.json();
      const rows =
        typeof body === 'object' && body != null && 'profiles' in body
          ? (body as { profiles: unknown }).profiles
          : body;

      if (!Array.isArray(rows)) {
        throw new TypeError('Expected an array of profiles');
      }

      const profiles: PersistedProfile[] = [];
      rows.forEach((row: unknown): void => {
        try {
          profiles.push(parsePayload(row));
        } catch (error: unknown) {
          // One bad row must not blank the whole gallery.
          console.warn('Skipping invalid profile from the backend', {
            error: getErrorMessage(error),
          });
        }
      });
      return profiles;
    },

    async upsert(profile: Profile, enrollment: ArrayBuffer): Promise<void> {
      await request(profilesUrl(profile.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(profile, enrollment)),
      });
    },

    async remove(id: string): Promise<void> {
      await request(profilesUrl(id), { method: 'DELETE' });
    },
  };
}

export const profilesRepository = createProfilesRepository();
