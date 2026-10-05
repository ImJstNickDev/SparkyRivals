import express from 'express';
// @ts-expect-error TS(7016): supertest does not ship declarations.
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { validateActivityGoals } from '../middleware/validateActivityGoals.js';
for (const prefix of ['', 'p_'] as const) {
  describe(`personal goal validation ${prefix}`, () => {
    const app = express();
    app.use(express.json());
    app.post('/', validateActivityGoals(prefix), (req, res) =>
      res.json(req.body)
    );
    it.each([0, -1, 1e10, 0.0000001, 'invalid'])(
      'rejects invalid target %s with 400',
      async (value) => {
        expect(
          (
            await request(app)
              .post('/')
              .send({ [prefix + 'steps_goal']: value })
          ).status
        ).toBe(400);
      }
    );
    it('preserves nutrition and accepts precise positive goals', async () => {
      const value = {
        [prefix + 'steps_goal']: 0.000001,
        [prefix + 'active_calories_goal']: '450',
        calories: 2000,
      };
      const response = await request(app).post('/').send(value);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ...value,
        [prefix + 'active_calories_goal']: 450,
      });
    });
    it('distinguishes omitted fields from explicit removal', async () => {
      const response = await request(app)
        .post('/')
        .send({ calories: 2000, [prefix + 'distance_goal_meters']: null });
      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty(prefix + 'steps_goal');
      expect(response.body[prefix + 'distance_goal_meters']).toBeNull();
    });
  });
}
