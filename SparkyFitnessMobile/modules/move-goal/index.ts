import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { challengeTargetSchema } from '@workspace/shared';

interface MoveGoalBridge {
  requestAndReadCurrentMoveGoal(): Promise<number | null>;
}
const bridge =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<MoveGoalBridge>('MoveGoal')
    : null;
/** Called only from the explicit personal-goal import action. */
export async function readAppleMoveGoal(): Promise<number | null> {
  if (!bridge) return null;
  const value = await bridge.requestAndReadCurrentMoveGoal();
  const parsed = challengeTargetSchema.safeParse(
    value == null ? null : Math.round(value * 1_000_000) / 1_000_000
  );
  return parsed.success ? parsed.data : null;
}
