/**
 * robbo-bank-local · db entrypoint (WP0)
 *
 * TODO TAURI: initialise `tauri-plugin-sql` here and run
 * `src/lib/schema.sql` on first launch. Until then this module
 * re-exports the localStorage/in-memory LocalRepo from localRepo.ts
 * so WP1 screens can build against a stable interface.
 */
export * from './localRepo';
export { localRepo as db } from './localRepo';
