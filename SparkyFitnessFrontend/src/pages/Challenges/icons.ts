import type { ChallengeMetric } from '@workspace/shared';
import {
  Footprints,
  Route,
  Flame,
  Timer,
  Dumbbell,
  Droplet,
} from 'lucide-react';
export const challengeIcons = {
  steps: Footprints,
  distance: Route,
  active_calories: Flame,
  workout_time: Timer,
  workout_calories: Dumbbell,
  workout_distance: Route,
  hydration: Droplet,
} satisfies Record<ChallengeMetric, typeof Footprints>;
