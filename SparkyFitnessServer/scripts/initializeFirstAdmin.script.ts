// Operator-only stdin tool. No listener, route, password argument or env password.
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { loadSecrets } from '../utils/secretLoader.js';

async function main() {
  const email = z
    .email()
    .parse(process.env.SPARKY_FITNESS_ADMIN_EMAIL)
    .toLowerCase();
  if (
    process.env.SPARKY_FITNESS_DISABLE_SIGNUP !== 'true' ||
    process.env.SPARKY_FITNESS_DEMO_MODE === 'true'
  ) {
    throw new Error('Requires closed signup and demo mode disabled');
  }
  const input = z
    .object({
      name: z.string().trim().min(1).max(100),
      password: z.string().min(8).max(128),
    })
    .strict()
    .parse(JSON.parse(readFileSync(0, 'utf8')));
  loadSecrets();
  // Import pools only after loading the existing runtime secret files.
  const { getSystemClient, endPool } = await import('../db/poolManager.js');
  const client = await getSystemClient();
  try {
    await client.query(
      "SELECT pg_advisory_lock(hashtext('sparkyrivals-first-admin'))"
    );
    const users = await client.query('SELECT 1 FROM public."user" LIMIT 1');
    if (users.rowCount)
      throw new Error(
        'Database already has users; use existing admin recovery'
      );
    // This short-lived, non-listening process alone permits Better Auth's normal
    // user creation hook. The running HTTP server keeps signup disabled.
    process.env.SPARKY_FITNESS_DISABLE_SIGNUP = 'false';
    try {
      const { auth } = await import('../auth.js');
      const result = await auth.api.signUpEmail({ body: { ...input, email } });
      const { default: userRepository } =
        await import('../models/userRepository.js');
      await userRepository.updateUserRole(result.user.id, 'admin');
      // No bootstrap session leaves this process; the operator signs in normally.
      await client.query('DELETE FROM session WHERE user_id=$1', [
        result.user.id,
      ]);
      const state = await client.query(
        `SELECT u.role, EXISTS(SELECT 1 FROM account a WHERE a.user_id=u.id AND a.provider_id='credential' AND a.password IS NOT NULL) AS credential,
         EXISTS(SELECT 1 FROM profiles p WHERE p.id=u.id) AS profile
         FROM public."user" u WHERE u.id=$1`,
        [result.user.id]
      );
      if (
        state.rows[0]?.role !== 'admin' ||
        !state.rows[0]?.credential ||
        !state.rows[0]?.profile
      ) {
        throw new Error(
          'Incomplete initialization; preserve database and inspect before retry'
        );
      }
      console.log(
        'First administrator initialized; public signup remains closed.'
      );
    } finally {
      process.env.SPARKY_FITNESS_DISABLE_SIGNUP = 'true';
    }
  } finally {
    await client.query(
      "SELECT pg_advisory_unlock(hashtext('sparkyrivals-first-admin'))"
    );
    client.release();
    await endPool();
  }
}

main().catch(() => {
  // Do not serialize input, auth errors or database errors containing private data.
  console.error(
    'Admin initialization refused or failed. Check closed signup, configured admin email and empty database; do not delete existing users to retry.'
  );
  process.exitCode = 1;
});
