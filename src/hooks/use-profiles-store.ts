import { useEffect, useRef, useState } from 'react';
import type { FaceRecognizer } from 'react-native-vision-camera-face-recognizer';
import type { Profile } from '../types';
import {
  type PersistedProfile,
  profilesRepository,
} from '../storage/profiles-repository';

export type NewProfile = Omit<Profile, 'enrolledAt'>;

/** Where the gallery load currently is. Recognition waits for `ready`. */
export type ProfilesStatus = 'loading' | 'ready' | 'error';

export interface ProfilesStore {
  status: ProfilesStatus;
  /** Failure from the latest load, when `status` is `error`. */
  error: string | undefined;
  /** Retries the load. No-op while one is already running. */
  reload(): void;
  /**
   * Bumped on every successful load. A consumer pushes the gallery into a
   * recognizer when this changes, instead of tracking that itself.
   */
  generation: number;

  list: Profile[];

  /**
   * Writes the identity to the backend, then mirrors it locally.
   *
   * Rejects when the backend refuses. The caller must undo whatever it already
   * did natively, since the backend is the source of truth.
   */
  add(profile: NewProfile, enrollment: ArrayBuffer): Promise<void>;
  /** Removes remotely first, then from the recognizer and local state. */
  remove(id: string, recognizer: FaceRecognizer): Promise<void>;

  get(id: string): Profile | undefined;
  getEnrollment(id: string): ArrayBuffer | undefined;
  restoreEnrollments(recognizer: FaceRecognizer): void;
}

function toProfileList(profiles: Map<string, Profile>): Profile[] {
  return Array.from(profiles.values());
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useProfilesStore(): ProfilesStore {
  const [status, setStatus] = useState<ProfilesStatus>('loading');
  const [error, setError] = useState<string>();
  const [list, setList] = useState<Profile[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const [generation, setGeneration] = useState(0);

  const store = useRef<Map<string, Profile>>(new Map());
  const enrollmentStore = useRef<Map<string, ArrayBuffer>>(new Map());

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    // `loading` is the initial state and `reload` restores it from the event
    // handler, so nothing has to be set synchronously here.
    profilesRepository
      .list(controller.signal)
      .then((records: PersistedProfile[]) => {
        if (cancelled) {
          return;
        }

        const profiles = new Map<string, Profile>();
        const enrollments = new Map<string, ArrayBuffer>();
        records.forEach((record: PersistedProfile): void => {
          profiles.set(record.profile.id, record.profile);
          enrollments.set(record.profile.id, record.enrollment);
        });

        store.current = profiles;
        enrollmentStore.current = enrollments;
        setList(toProfileList(profiles));
        setGeneration(previous => previous + 1);
        setStatus('ready');
      })
      .catch((loadError: unknown) => {
        if (cancelled || controller.signal.aborted) {
          return;
        }
        setError(getErrorMessage(loadError));
        setStatus('error');
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reloadToken]);

  const reload = (): void => {
    setStatus('loading');
    setError(undefined);
    setReloadToken(previous => previous + 1);
  };

  const add = async (
    profile: NewProfile,
    enrollment: ArrayBuffer,
  ): Promise<void> => {
    const storedProfile: Profile = { ...profile, enrolledAt: Date.now() };

    // Remote first: if this throws, nothing local has changed yet.
    await profilesRepository.upsert(storedProfile, enrollment);

    store.current.set(profile.id, storedProfile);
    enrollmentStore.current.set(profile.id, enrollment);
    setList(toProfileList(store.current));
  };

  const remove = async (
    id: string,
    recognizer: FaceRecognizer,
  ): Promise<void> => {
    if (!store.current.has(id)) {
      return;
    }

    await profilesRepository.remove(id);

    recognizer.removeEnrollment(id);
    store.current.delete(id);
    enrollmentStore.current.delete(id);
    setList(toProfileList(store.current));
  };

  const get = (id: string): Profile | undefined => store.current.get(id);

  const getEnrollment = (id: string): ArrayBuffer | undefined =>
    enrollmentStore.current.get(id);

  const restoreEnrollments = (recognizer: FaceRecognizer): void => {
    let didDropInvalid = false;

    enrollmentStore.current.forEach(
      (enrollment: ArrayBuffer, id: string): void => {
        try {
          recognizer.addEnrollment(id, enrollment);
        } catch (restoreError: unknown) {
          // Drop locally only. The backend keeps the row so the problem stays
          // visible and can be fixed there rather than silently erased.
          console.warn('Recognizer rejected a stored enrollment', {
            id,
            error: getErrorMessage(restoreError),
          });
          store.current.delete(id);
          enrollmentStore.current.delete(id);
          didDropInvalid = true;
        }
      },
    );

    if (didDropInvalid) {
      setList(toProfileList(store.current));
    }
  };

  return {
    status,
    error,
    reload,
    generation,
    list,
    add,
    remove,
    get,
    getEnrollment,
    restoreEnrollments,
  };
}
