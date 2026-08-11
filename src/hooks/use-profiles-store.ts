import { useRef, useState } from 'react';
import type { FaceRecognizer } from 'react-native-vision-camera-face-recognizer';
import type { Profile } from '../types';
import {
  type PersistedProfile,
  profilesRepository,
} from '../storage/profiles-repository';

export type NewProfile = Omit<Profile, 'enrolledAt'>;

export interface ProfilesStore {
  add(profile: NewProfile, enrollment: ArrayBuffer): void;
  remove(id: string, recognizer: FaceRecognizer): void;
  get(id: string): Profile | undefined;
  getEnrollment(id: string): ArrayBuffer | undefined;
  restoreEnrollments(recognizer: FaceRecognizer): void;
  list: Profile[];
}

interface StoredProfiles {
  profiles: Map<string, Profile>;
  enrollments: Map<string, ArrayBuffer>;
}

function readInitialProfiles(): StoredProfiles {
  const profiles = new Map<string, Profile>();
  const enrollments = new Map<string, ArrayBuffer>();

  profilesRepository.list().forEach((record: PersistedProfile): void => {
    profiles.set(record.profile.id, record.profile);
    enrollments.set(record.profile.id, record.enrollment);
  });

  return { profiles, enrollments };
}

function toProfileList(profiles: Map<string, Profile>): Profile[] {
  return Array.from(profiles.values());
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useProfilesStore(): ProfilesStore {
  const [initialProfiles] = useState(readInitialProfiles);
  const store = useRef<Map<string, Profile>>(initialProfiles.profiles);
  const enrollmentStore = useRef<Map<string, ArrayBuffer>>(
    initialProfiles.enrollments,
  );
  const [list, setList] = useState<Profile[]>(() =>
    toProfileList(initialProfiles.profiles),
  );

  const add = (profile: NewProfile, enrollment: ArrayBuffer): void => {
    const storedProfile: Profile = {
      ...profile,
      enrolledAt: Date.now(),
    };

    profilesRepository.upsert(storedProfile, enrollment);
    store.current.set(profile.id, storedProfile);
    enrollmentStore.current.set(profile.id, enrollment);
    setList(toProfileList(store.current));
  };

  const remove = (id: string, recognizer: FaceRecognizer): void => {
    if (!store.current.has(id)) {
      return;
    }

    recognizer.removeEnrollment(id);
    profilesRepository.remove(id);
    store.current.delete(id);
    enrollmentStore.current.delete(id);
    setList(toProfileList(store.current));
  };

  const get = (id: string): Profile | undefined => store.current.get(id);

  const getEnrollment = (id: string): ArrayBuffer | undefined =>
    enrollmentStore.current.get(id);

  const restoreEnrollments = (recognizer: FaceRecognizer): void => {
    let didRemoveInvalidProfile = false;

    enrollmentStore.current.forEach(
      (enrollment: ArrayBuffer, id: string): void => {
        try {
          recognizer.addEnrollment(id, enrollment);
        } catch (error: unknown) {
          console.warn('Removing invalid persisted enrollment', {
            id,
            error: getErrorMessage(error),
          });
          profilesRepository.remove(id);
          store.current.delete(id);
          enrollmentStore.current.delete(id);
          didRemoveInvalidProfile = true;
        }
      },
    );

    if (didRemoveInvalidProfile) {
      setList(toProfileList(store.current));
    }
  };

  return { add, remove, get, getEnrollment, restoreEnrollments, list };
}
