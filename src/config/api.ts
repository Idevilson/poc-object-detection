/**
 * Backend that owns the identity gallery.
 *
 * Postgres is the source of truth: the app holds no durable copy, so every
 * launch reads from here before recognition can match anyone.
 *
 * Point this at your server. On Android an emulator reaches the host machine
 * at `10.0.2.2`, not `localhost`; a physical device needs the machine's LAN
 * address and a server bound to `0.0.0.0`.
 */
export const API_BASE_URL = 'http://localhost:3000';

/** Ceiling for any single request, so a dead server fails visibly, not silently. */
export const API_TIMEOUT_MS = 10_000;
