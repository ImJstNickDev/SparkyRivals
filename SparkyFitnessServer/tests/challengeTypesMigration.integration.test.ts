import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { describe, it, expect, vi, afterAll } from 'vitest';
import { applyMigrations } from '../utils/dbMigrations.js';
import { applyRlsPolicies } from '../utils/applyRlsPolicies.js';
import { endPool, getSystemClient } from '../db/poolManager.js';
import { assertChallengeTestDatabase } from './helpers/challengeTestDatabase.js';

const migration = '20261004193000_challenge_types_and_goals.sql';
afterAll(endPool);
describe.runIf(process.env.RUN_CHALLENGE_MIGRATION_TESTS === '1')(
  'Challenge types fresh and upgrade migration',
  () => {
    it.each([false, true])(
      'normal migration runner handles an existing database=%s',
      async (upgrade) => {
        assertChallengeTestDatabase();
        const database = `sparkyrivals_migration_test_${randomUUID().replaceAll('-', '')}`;
        const admin = await getSystemClient();
        try {
          await admin.query(`CREATE DATABASE "${database}"`);
        } finally {
          admin.release();
        }
        // Retained in the explicitly disposable test cluster. Never drop an operator database.
        const pool = new pg.Pool({
          host: process.env.SPARKY_FITNESS_DB_HOST,
          port: Number(process.env.SPARKY_FITNESS_DB_PORT),
          database,
          user: process.env.SPARKY_FITNESS_DB_USER,
          password: process.env.SPARKY_FITNESS_DB_PASSWORD,
        });
        const client = await pool.connect();
        const owner = randomUUID(),
          peer = randomUUID();
        const ids = [randomUUID(), randomUUID()];
        let before: unknown[] = [];
        try {
          if (upgrade) {
            const files = fs
              .readdirSync(new URL('../db/migrations/', import.meta.url))
              .filter((file) => file.endsWith('.sql') && file < migration);
            const original = fs.readdirSync;
            const spy = vi
              .spyOn(fs, 'readdirSync')
              .mockImplementation(((
                directory: Parameters<typeof fs.readdirSync>[0],
                options?: unknown
              ) =>
                String(directory).endsWith('/db/migrations')
                  ? files
                  : Reflect.apply(original, fs, [
                      directory,
                      options,
                    ])) as typeof fs.readdirSync);
            try {
              await applyMigrations(client);
            } finally {
              spy.mockRestore();
            }
            // Valid pre-upgrade rows, inserted without production policy helpers, which
            // startup normally installs only AFTER all migrations have completed.
            await client.query('BEGIN');
            await client.query("SET LOCAL session_replication_role='replica'");
            for (const id of [owner, peer])
              await client.query(
                'INSERT INTO public."user"(id,email,email_verified) VALUES($1,$2,true)',
                [id, `${id}@example.test`]
              );
            for (const [index, metric] of ['steps', 'workout_time'].entries()) {
              await client.query(
                "INSERT INTO challenges(id,creator_user_id,name,metric,scoring_mode,start_date,end_date,timezone) VALUES($1,$2,'Existing challenge',$3,'sum',CURRENT_DATE,CURRENT_DATE+6,'UTC')",
                [ids[index], owner, metric]
              );
              await client.query(
                "INSERT INTO challenge_participants(challenge_id,user_id,invited_by_user_id,status,accepted_at) VALUES($1,$2,$2,'accepted',now()),($1,$3,$2,'pending',null)",
                [ids[index], owner, peer]
              );
            }
            await client.query('COMMIT');
            before = (
              await client.query(
                'SELECT id,metric,scoring_mode,start_date,end_date,created_at,updated_at FROM challenges ORDER BY id'
              )
            ).rows;
          }
          await applyMigrations(client);
          await applyRlsPolicies(client);
          // Repeat startup: no duplicate columns/functions or alteration of existing rows.
          await applyMigrations(client);
          await applyRlsPolicies(client);
          if (upgrade) {
            expect(
              (
                await client.query(
                  'SELECT id,metric,scoring_mode,start_date,end_date,created_at,updated_at FROM challenges ORDER BY id'
                )
              ).rows
            ).toEqual(before);
            expect(
              (
                await client.query(
                  'SELECT duration_days,start_next_day,locked_at FROM challenges'
                )
              ).rows
            ).toEqual([
              { duration_days: 7, start_next_day: false, locked_at: null },
              { duration_days: 7, start_next_day: false, locked_at: null },
            ]);
            expect(
              (
                await client.query(
                  'SELECT status,target_value,ready_at,target_revision FROM challenge_participants ORDER BY status'
                )
              ).rows
            ).toEqual(
              ['accepted', 'accepted', 'pending', 'pending'].map((status) => ({
                status,
                target_value: null,
                ready_at: null,
                target_revision: 0,
              }))
            );
          }
          expect(
            (
              await client.query(
                "SELECT column_name FROM information_schema.columns WHERE table_name='user_goals' AND column_name IN ('steps_goal','distance_goal_meters','active_calories_goal')"
              )
            ).rowCount
          ).toBe(3);
          expect(
            (
              await client.query(
                "SELECT relname FROM pg_class WHERE relname IN ('challenges','challenge_participants','user_goals','goal_presets','push_installations','push_events','push_deliveries') AND relrowsecurity"
              )
            ).rowCount
          ).toBe(7);
        } finally {
          client.release();
          await pool.end();
        }
      },
      120_000
    );
  }
);
