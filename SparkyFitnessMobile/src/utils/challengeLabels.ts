import type { TFunction } from 'i18next';
import type {
  ChallengeMetric,
  ChallengeScoringMode,
  ChallengeScoreUnit,
} from '@workspace/shared';

export function challengeTypeText(
  t: TFunction,
  metric: ChallengeMetric,
  mode: ChallengeScoringMode
): string {
  const labels: Record<string, string> = {
    'steps/sum': t('challenges.types.step-race', { defaultValue: 'Step Race' }),
    'steps/goal_progress': t('challenges.types.step-goal', {
      defaultValue: 'Step Goal',
    }),
    'steps/goal_days': t('challenges.types.step-streak', {
      defaultValue: 'Step Streak',
    }),
    'distance/sum': t('challenges.types.distance-race', {
      defaultValue: 'Distance Race',
    }),
    'distance/goal_progress': t('challenges.types.distance-goal', {
      defaultValue: 'Distance Goal',
    }),
    'distance/goal_days': t('challenges.types.distance-streak', {
      defaultValue: 'Distance Streak',
    }),
    'active_calories/sum': t('challenges.types.active-calories', {
      defaultValue: 'Active Calories',
    }),
    'active_calories/goal_progress': t('challenges.types.move-goal', {
      defaultValue: 'Move Goal',
    }),
    'active_calories/goal_days': t('challenges.types.move-streak', {
      defaultValue: 'Move Goal Streak',
    }),
    'workout_time/sum': t('challenges.types.workout-minutes', {
      defaultValue: 'Workout Minutes',
    }),
    'workout_time/goal_progress': t('challenges.types.workout-minutes-goal', {
      defaultValue: 'Workout Minutes Goal',
    }),
    'workout_time/goal_days': t('challenges.types.workout-minutes-streak', {
      defaultValue: 'Workout Minutes Streak',
    }),
    'workout_calories/sum': t('challenges.types.workout-calories', {
      defaultValue: 'Workout Calories',
    }),
    'workout_calories/goal_progress': t(
      'challenges.types.workout-calorie-goal',
      { defaultValue: 'Workout Calorie Goal' }
    ),
    'workout_calories/goal_days': t('challenges.types.workout-calorie-streak', {
      defaultValue: 'Workout Calorie Streak',
    }),
    'workout_distance/sum': t('challenges.types.workout-distance', {
      defaultValue: 'Workout Distance',
    }),
    'hydration/goal_progress': t('challenges.types.hydration-goal', {
      defaultValue: 'Hydration Goal',
    }),
    'hydration/goal_days': t('challenges.types.hydration-streak', {
      defaultValue: 'Hydration Streak',
    }),
  };
  return (
    labels[`${metric}/${mode}`] ??
    t('challenges.title', { defaultValue: 'Challenges' })
  );
}
export function challengeUnitText(
  t: TFunction,
  unit: ChallengeScoreUnit
): string {
  return {
    steps: t('challenges.units.steps', { defaultValue: 'steps' }),
    meters: t('challenges.units.meters', { defaultValue: 'distance' }),
    kcal: t('challenges.units.kcal', { defaultValue: 'kcal' }),
    seconds: t('challenges.units.seconds', { defaultValue: 'workout time' }),
    milliliters: t('challenges.units.milliliters', {
      defaultValue: 'hydration',
    }),
    points: t('challenges.units.points', { defaultValue: 'points' }),
    goal_days: t('challenges.units.goal_days', { defaultValue: 'goal days' }),
  }[unit];
}
