import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { endPool, getClient, getSystemClient } from '../db/poolManager.js';
import repository from '../models/familyAccessRepository.js';
import { assertChallengeTestDatabase } from './helpers/challengeTestDatabase.js';

const owner = randomUUID();
const contact = randomUUID();
const outsider = randomUUID();
const relationship = randomUUID();
const ids = [owner, contact, outsider];
let fixturesAuthorized = false;

async function sql(
  actor: string,
  text: string,
  values: unknown[] = [],
  target = actor
) {
  const client = await getClient(target, actor);
  try {
    return await client.query(text, values);
  } finally {
    client.release();
  }
}

describe.runIf(process.env.RUN_CHALLENGE_DB_TESTS === '1')(
  'Family & Friends display names without diary or profile access',
  () => {
    beforeAll(async () => {
      assertChallengeTestDatabase();
      fixturesAuthorized = true;
      const client = await getSystemClient();
      try {
        for (const [index, id] of ids.entries()) {
          await client.query(
            'INSERT INTO public."user"(id,email,email_verified) VALUES($1,$2,true)',
            [id, `${id}@example.test`]
          );
          await client.query(
            'INSERT INTO profiles(id,full_name) VALUES($1,$2)',
            [id, ['Test Owner', 'Test Contact', 'Test Outsider'][index]]
          );
        }
        await client.query(
          "INSERT INTO family_access(id,owner_user_id,family_user_id,family_email,access_permissions,status,is_active) VALUES($1,$2,$3,$4,'{}','active',true)",
          [relationship, owner, contact, `${contact}@example.test`]
        );
      } finally {
        client.release();
      }
    });
    afterAll(async () => {
      if (fixturesAuthorized) {
        const client = await getSystemClient();
        try {
          await client.query(
            'DELETE FROM public."user" WHERE id=ANY($1::uuid[])',
            [ids]
          );
        } finally {
          client.release();
        }
      }
      await endPool();
    });

    it.each([
      ['owner', owner],
      ['contact', contact],
    ])(
      'resolves both names for the %s in the existing connection listing',
      async (_label, actor) => {
        const rows = await repository.getFamilyAccessEntriesByUserId(actor);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
          id: relationship,
          owner_full_name: 'Test Owner',
          family_full_name: 'Test Contact',
          access_permissions: {},
        });
      }
    );

    it('keeps the owner listing compatible', async () => {
      expect(await repository.getFamilyAccessEntriesByOwner(owner)).toEqual([
        expect.objectContaining({
          owner_full_name: 'Test Owner',
          family_full_name: 'Test Contact',
        }),
      ]);
    });

    it('projects exactly two names, without widening ordinary profile or diary policies', async () => {
      expect(
        (
          await sql(owner, 'SELECT * FROM family_access_display_names($1)', [
            relationship,
          ])
        ).rows
      ).toEqual([
        { owner_full_name: 'Test Owner', family_full_name: 'Test Contact' },
      ]);
      for (const [actor, other] of [
        [owner, contact],
        [contact, owner],
      ]) {
        expect(
          (await sql(actor!, 'SELECT * FROM profiles WHERE id=$1', [other]))
            .rows
        ).toEqual([]);
        expect(
          (
            await sql(
              actor!,
              "SELECT can_access_user_data($1,'diary_read',$2) AS allowed",
              [other, actor]
            )
          ).rows
        ).toEqual([{ allowed: false }]);
      }
    });

    it('denies a stranger even with a known relationship ID', async () => {
      expect(
        (
          await sql(outsider, 'SELECT * FROM family_access_display_names($1)', [
            relationship,
          ])
        ).rows
      ).toEqual([]);
      expect(await repository.getFamilyAccessEntriesByUserId(outsider)).toEqual(
        []
      );
    });

    it('denies switched contexts, including a relationship participant', async () => {
      for (const actor of [contact, outsider]) {
        expect(
          (
            await sql(
              actor,
              'SELECT * FROM family_access_display_names($1)',
              [relationship],
              owner
            )
          ).rows
        ).toEqual([]);
      }
    });

    it('denies an absent authenticated actor', async () => {
      const client = await getClient(owner, owner);
      try {
        await client.query(
          "SELECT set_config('app.authenticated_user_id','',false)"
        );
        expect(
          (
            await client.query(
              'SELECT * FROM family_access_display_names($1)',
              [relationship]
            )
          ).rows
        ).toEqual([]);
      } finally {
        client.release();
      }
    });

    it('does not turn an arbitrary identifier into profile lookup', async () => {
      expect(
        (
          await sql(owner, 'SELECT * FROM family_access_display_names($1)', [
            outsider,
          ])
        ).rows
      ).toEqual([]);
    });

    it('removing the relationship removes the name projection', async () => {
      await sql(owner, 'DELETE FROM family_access WHERE id=$1', [relationship]);
      expect(
        (
          await sql(contact, 'SELECT * FROM family_access_display_names($1)', [
            relationship,
          ])
        ).rows
      ).toEqual([]);
    });
  }
);
