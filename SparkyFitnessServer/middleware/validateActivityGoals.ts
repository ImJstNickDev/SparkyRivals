import type { RequestHandler } from 'express';
import { z } from 'zod';
import { challengeTargetSchema } from '@workspace/shared';

/** Validate only the additive activity fields; preserve existing nutrition contracts. */
export function validateActivityGoals(prefix: '' | 'p_' = ''): RequestHandler {
  const goal = z.preprocess(
    (value) =>
      value === '' ? null : typeof value === 'string' ? Number(value) : value,
    challengeTargetSchema.nullable().optional()
  );
  const schema = z
    .object(
      Object.fromEntries(
        ['steps_goal', 'distance_goal_meters', 'active_calories_goal'].map(
          (field) => [prefix + field, goal]
        )
      )
    )
    .passthrough();
  return (req, res, next) => {
    const input: unknown = req.body;
    const result = schema.safeParse(input);
    if (!result.success) {
      res.status(400).json({
        error: 'Invalid personal activity goal',
        details: result.error.issues.map(({ path, message }) => ({
          path,
          message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
