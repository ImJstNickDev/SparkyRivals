import {
  confirmChallengeReady,
  TargetSavedReadyFailed,
} from '../../src/utils/confirmChallengeReady';
import { actor, detail } from '../helpers/challenges';
const saved = {
  ...detail,
  challenge: { ...detail.challenge, lifecycle: 'lobby' as const },
  participants: detail.participants.map((p) => ({
    ...p,
    target_value: 9000,
    target_revision: 7,
  })),
};
const setup = () => ({
  actor,
  target: 9000,
  revision: 6,
  savedTarget: 8000,
  save: jest.fn().mockResolvedValue(saved),
  ready: jest.fn().mockResolvedValue(saved),
  current: jest.fn(() => true),
});
test('save is acknowledged before Ready uses the returned revision', async () => {
  const input = setup();
  await confirmChallengeReady(input);
  expect(input.save).toHaveBeenCalledWith(9000, 6);
  expect(input.ready).toHaveBeenCalledWith(7);
});
test('unchanged saved target does not write it again', async () => {
  const input = { ...setup(), savedTarget: 9000 };
  await confirmChallengeReady(input);
  expect(input.save).not.toHaveBeenCalled();
  expect(input.ready).toHaveBeenCalledWith(6);
});
test('save conflict never sends Ready', async () => {
  const input = setup();
  input.save.mockRejectedValue(new Error('conflict'));
  await expect(confirmChallengeReady(input)).rejects.toThrow('conflict');
  expect(input.ready).not.toHaveBeenCalled();
});
test('partial success is distinguishable from an unsaved target', async () => {
  const input = setup();
  input.ready.mockRejectedValue(new Error('offline'));
  await expect(confirmChallengeReady(input)).rejects.toBeInstanceOf(
    TargetSavedReadyFailed
  );
});
test('identity change while saving never confirms the new account', async () => {
  const input = setup();
  input.current.mockReturnValueOnce(true).mockReturnValue(false);
  await expect(confirmChallengeReady(input)).rejects.toThrow(
    'CHALLENGE_SESSION_CHANGED'
  );
  expect(input.ready).not.toHaveBeenCalled();
});
test('already obsolete operation never writes', async () => {
  const input = setup();
  input.current.mockReturnValue(false);
  await expect(confirmChallengeReady(input)).rejects.toThrow(
    'CHALLENGE_SESSION_CHANGED'
  );
  expect(input.save).not.toHaveBeenCalled();
});
test('identity change while Ready is acknowledged suppresses the late result', async () => {
  const input = setup();
  input.ready.mockImplementation(async () => {
    input.current.mockReturnValue(false);
    return saved;
  });
  await expect(confirmChallengeReady(input)).rejects.toThrow(
    'CHALLENGE_SESSION_CHANGED'
  );
});
test('mismatched acknowledged target requires reconfirmation', async () => {
  const input = setup();
  input.save.mockResolvedValue({
    ...saved,
    participants: saved.participants.map((p) => ({ ...p, target_value: 42 })),
  });
  await expect(confirmChallengeReady(input)).rejects.toThrow(
    'CHALLENGE_RECONFIRM_REQUIRED'
  );
  expect(input.ready).not.toHaveBeenCalled();
});
