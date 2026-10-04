import express from 'express';
import {
  pushRegistrationRequestSchema,
  pushUnregisterRequestSchema,
} from '../../schemas/pushSchemas.js';
import { registerPush } from '../../services/pushRegistrationService.js';
import { revokePushInstallation } from '../../models/pushRegistrationRepository.js';
import { requireSelfActor } from '../../middleware/requireSelfMiddleware.js';
import { log } from '../../config/logging.js';

const router = express.Router();
router.put('/installation', requireSelfActor, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const parsed = pushRegistrationRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid push registration' });
    return;
  }
  res.json(await registerPush(req.userId, parsed.data));
});
router.delete('/installation', requireSelfActor, async (req, res) => {
  const parsed = pushUnregisterRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid push registration' });
    return;
  }
  await revokePushInstallation(req.userId, parsed.data);
  res.status(204).end();
});
// SQL/transport errors can contain routing tokens. Never forward them to global
// logging or return the input/validation object, even with debug logging enabled.
const safeError: express.ErrorRequestHandler = (
  _error: unknown,
  _req,
  res,
  _next
) => {
  log('warn', '[Push] Registration operation failed');
  res.status(503).json({ error: 'Push registration unavailable' });
};
router.use(safeError);
export default router;
/**
 * @swagger
 * /v2/push/installation:
 *   put:
 *     summary: Opt in this installation to remote Challenge invitations (self only)
 *     tags: [Push]
 *     responses:
 *       '200': { description: Enabled flag and registration expiry; never a routing token }
 *       '400': { description: Invalid registration }
 *       '401': { description: Authentication required }
 *       '403': { description: Delegated context forbidden }
 *       '503': { description: Registration temporarily unavailable }
 *   delete:
 *     summary: Revoke this account's installation binding idempotently
 *     tags: [Push]
 *     responses:
 *       '204': { description: Revoked or already unavailable }
 *       '401': { description: Authentication required }
 */
