import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { applyMigrations } from '../utils/dbMigrations.js';
import { applyRlsPolicies } from '../utils/applyRlsPolicies.js';
import { endPool, getSystemClient } from '../db/poolManager.js';
import { assertChallengeTestDatabase } from './helpers/challengeTestDatabase.js';

afterAll(endPool);
describe.runIf(process.env.RUN_CHALLENGE_DB_TESTS === '1')(
  'private first-admin onboarding',
  () => {
    it('requires closed signup and an empty DB, serializes callers and never resets credentials', async () => {
      assertChallengeTestDatabase();
      const database = `sparkyrivals_admin_test_${randomUUID().replaceAll('-', '')}`;
      const admin = await getSystemClient();
      try {
        await admin.query(`CREATE DATABASE "${database}"`);
      } finally {
        admin.release();
      }
      const pool = new pg.Pool({
        host: process.env.SPARKY_FITNESS_DB_HOST,
        port: Number(process.env.SPARKY_FITNESS_DB_PORT),
        user: process.env.SPARKY_FITNESS_DB_USER,
        password: process.env.SPARKY_FITNESS_DB_PASSWORD,
        database,
      });
      const client = await pool.connect();
      const password = randomUUID();
      const invoke = (signup: string, email = 'admin@example.test') =>
        new Promise<{ code: number | null; output: string }>(
          (resolve, reject) => {
            const child = spawn(
              process.execPath,
              ['--import', 'tsx', 'scripts/initializeFirstAdmin.script.ts'],
              {
                env: {
                  ...process.env,
                  SPARKY_FITNESS_DB_NAME: database,
                  SPARKY_FITNESS_DISABLE_SIGNUP: signup,
                  SPARKY_FITNESS_ADMIN_EMAIL: email,
                  SPARKY_FITNESS_DEMO_MODE: 'false',
                  SPARKY_FITNESS_LOG_LEVEL: 'SILENT',
                },
                stdio: ['pipe', 'pipe', 'pipe'],
              }
            );
            let output = '';
            child.stdout.on('data', (data) => {
              output += String(data);
            });
            child.stderr.on('data', (data) => {
              output += String(data);
            });
            child.on('error', reject);
            child.on('close', (code) => resolve({ code, output }));
            child.stdin.end(
              JSON.stringify({ name: 'Synthetic administrator', password })
            );
          }
        );
      try {
        await applyMigrations(client);
        await applyRlsPolicies(client);
        expect((await invoke('false')).code).toBe(1);
        expect((await invoke('true', '')).code).toBe(1);
        expect(
          (await client.query('SELECT 1 FROM public."user"')).rowCount
        ).toBe(0);
        const results = await Promise.all([invoke('true'), invoke('true')]);
        expect(results.map((result) => result.code).sort()).toEqual([0, 1]);
        for (const result of results)
          expect(result.output).not.toContain(password);
        const before = (await client.query('SELECT password FROM account'))
          .rows;
        expect(before).toHaveLength(1);
        expect(before[0].password).not.toBe(password);
        expect(
          (await client.query('SELECT role FROM public."user"')).rows
        ).toEqual([{ role: 'admin' }]);
        expect((await client.query('SELECT 1 FROM profiles')).rowCount).toBe(1);
        expect((await client.query('SELECT 1 FROM session')).rowCount).toBe(0);
        expect((await invoke('true')).code).toBe(1);
        expect(
          (await client.query('SELECT password FROM account')).rows
        ).toEqual(before);
      } finally {
        client.release();
        await pool.end();
      }
    }, 60_000);
  }
);
