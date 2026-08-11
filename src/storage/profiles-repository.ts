import {
  type BatchQueryCommand,
  type NitroSQLiteConnection,
  open,
  type SQLiteValue,
} from 'react-native-nitro-sqlite';
import type { Profile } from '../types';

const DATABASE_NAME = 'face-recognizer.sqlite';
const SCHEMA_VERSION = 1;

const CREATE_PROFILES_TABLE_SQL = `
  CREATE TABLE profiles (
    id TEXT PRIMARY KEY NOT NULL,
    full_name TEXT NOT NULL,
    enrolled_at INTEGER NOT NULL CHECK (enrolled_at >= 0),
    sample_count INTEGER NOT NULL CHECK (sample_count > 0),
    enrollment BLOB NOT NULL CHECK (length(enrollment) > 0)
  ) STRICT
`;

const UPSERT_PROFILE_SQL = `
  INSERT INTO profiles (
    id,
    full_name,
    enrolled_at,
    sample_count,
    enrollment
  ) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    full_name = excluded.full_name,
    enrolled_at = excluded.enrolled_at,
    sample_count = excluded.sample_count,
    enrollment = excluded.enrollment
`;

interface UserVersionRow extends Record<string, SQLiteValue> {
  user_version: SQLiteValue;
}

interface ProfileRow extends Record<string, SQLiteValue> {
  sqlite_row_id: SQLiteValue;
  id: SQLiteValue;
  full_name: SQLiteValue;
  enrolled_at: SQLiteValue;
  sample_count: SQLiteValue;
  enrollment: SQLiteValue;
}

export interface PersistedProfile {
  profile: Profile;
  enrollment: ArrayBuffer;
}

export interface ProfilesRepository {
  list(): PersistedProfile[];
  upsert(profile: Profile, enrollment: ArrayBuffer): void;
  remove(id: string): void;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseProfile(value: unknown, expectedId: string): Profile {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    throw new TypeError('Expected profile metadata to be a JSON object');
  }

  const profile = value as Record<keyof Profile, unknown>;
  if (
    profile.id !== expectedId ||
    typeof profile.fullName !== 'string' ||
    typeof profile.enrolledAt !== 'number' ||
    !Number.isFinite(profile.enrolledAt) ||
    typeof profile.sampleCount !== 'number' ||
    !Number.isInteger(profile.sampleCount) ||
    profile.sampleCount <= 0
  ) {
    throw new TypeError(`Invalid profile metadata for ID "${expectedId}"`);
  }

  return {
    id: profile.id,
    fullName: profile.fullName,
    enrolledAt: profile.enrolledAt,
    sampleCount: profile.sampleCount,
  };
}

function parseEnrollment(
  enrollment: ArrayBuffer | undefined,
  id: string,
): ArrayBuffer {
  if (enrollment == null || enrollment.byteLength === 0) {
    throw new TypeError(
      `Expected profile "${id}" to contain a non-empty enrollment buffer`,
    );
  }

  return enrollment;
}

function getSchemaVersion(database: NitroSQLiteConnection): number {
  const row = database
    .execute<UserVersionRow>('PRAGMA user_version')
    .rows.item(0);
  const version = row?.user_version;
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    throw new TypeError(
      `Invalid schema version returned by ${DATABASE_NAME}: ${String(version)}`,
    );
  }

  return version;
}

function toUpsertParams(record: PersistedProfile): SQLiteValue[] {
  return [
    record.profile.id,
    record.profile.fullName,
    record.profile.enrolledAt,
    record.profile.sampleCount,
    record.enrollment,
  ];
}

function initializeDatabase(database: NitroSQLiteConnection): void {
  const version = getSchemaVersion(database);
  if (version > SCHEMA_VERSION) {
    throw new RangeError(
      `${DATABASE_NAME} schema version ${version} is newer than supported version ${SCHEMA_VERSION}`,
    );
  }

  if (version === 0) {
    const commands: BatchQueryCommand[] = [
      { query: CREATE_PROFILES_TABLE_SQL },
      { query: `PRAGMA user_version = ${SCHEMA_VERSION}` },
    ];
    database.executeBatch(commands);
  }
}

function parseProfileRow(row: ProfileRow): PersistedProfile {
  if (
    typeof row.id !== 'string' ||
    typeof row.full_name !== 'string' ||
    typeof row.enrolled_at !== 'number' ||
    typeof row.sample_count !== 'number' ||
    !(row.enrollment instanceof ArrayBuffer)
  ) {
    throw new TypeError('SQLite returned an invalid profile row');
  }

  return {
    profile: parseProfile(
      {
        id: row.id,
        fullName: row.full_name,
        enrolledAt: row.enrolled_at,
        sampleCount: row.sample_count,
      },
      row.id,
    ),
    enrollment: parseEnrollment(row.enrollment, row.id),
  };
}

function removeInvalidProfileRow(
  database: NitroSQLiteConnection,
  row: ProfileRow,
  error: unknown,
): void {
  if (typeof row.sqlite_row_id !== 'number') {
    throw new TypeError(
      `Cannot remove invalid profile row from ${DATABASE_NAME}: invalid row ID`,
    );
  }

  console.warn('Removing invalid SQLite profile record', {
    database: DATABASE_NAME,
    rowId: row.sqlite_row_id,
    profileId: row.id,
    error: getErrorMessage(error),
  });
  database.execute('DELETE FROM profiles WHERE rowid = ?', [row.sqlite_row_id]);
}

function createProfilesRepository(): ProfilesRepository {
  const database = open({ name: DATABASE_NAME });
  initializeDatabase(database);

  return {
    list(): PersistedProfile[] {
      const result = database.execute<ProfileRow>(`
        SELECT rowid AS sqlite_row_id,
               id,
               full_name,
               enrolled_at,
               sample_count,
               enrollment
        FROM profiles
        ORDER BY enrolled_at ASC, id ASC
      `);
      const profiles: PersistedProfile[] = [];
      result.rows._array.forEach((row: ProfileRow): void => {
        try {
          profiles.push(parseProfileRow(row));
        } catch (error: unknown) {
          removeInvalidProfileRow(database, row, error);
        }
      });
      return profiles;
    },

    upsert(profile: Profile, enrollment: ArrayBuffer): void {
      const record: PersistedProfile = {
        profile: parseProfile(profile, profile.id),
        enrollment: parseEnrollment(enrollment, profile.id),
      };
      database.execute(UPSERT_PROFILE_SQL, toUpsertParams(record));
    },

    remove(id: string): void {
      database.execute('DELETE FROM profiles WHERE id = ?', [id]);
    },
  };
}

export const profilesRepository = createProfilesRepository();
