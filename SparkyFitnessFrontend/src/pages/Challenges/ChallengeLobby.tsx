import { useState } from 'react';
import {
  todayInZone,
  challengeTargetInput,
  challengeTargetSchema,
  suggestedChallengeTarget,
  CHALLENGE_METRIC_UNITS,
  formatChallengeValue,
  type ChallengeDetailResponse,
  type ChallengeParticipantResponse,
} from '@workspace/shared';
import {
  useChallengeIdentity,
  useChallengeMutation,
} from '@/hooks/Challenges/useChallenges';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useDailyGoals } from '@/hooks/Goals/useGoals';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useChallengeFormat } from './presentation';

export function ChallengeLobby({
  detail,
}: {
  detail: ChallengeDetailResponse;
}) {
  const { challenge, participants } = detail;
  const { actor } = useChallengeIdentity();
  const { t, locale } = useChallengeFormat(
    challenge.metric,
    challenge.scoring_mode
  );
  const mutation = useChallengeMutation();
  const lobby = challenge.lifecycle === 'lobby';
  const own = participants.find((p) => p.user_id === actor);
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">
        {t(lobby ? 'challenges.lobby' : 'challenges.lockedTargets', {
          defaultValue: lobby ? 'Waiting for players' : 'Locked daily targets',
        })}
      </h2>
      <p>
        {challenge.scoring_mode === 'goal_progress'
          ? t(
              'challenges.progressRules',
              'Each day earns actual ÷ your target × 100 points, without a cap. Points accumulate; equal points tie.'
            )
          : t(
              'challenges.goalDayRules',
              'Each day at or above your target counts once. Equal goal-day totals tie.'
            )}
      </p>
      {lobby && (
        <p>
          {t(
            'challenges.lobbyRules',
            'At least two people must join. Pending invitations block the start. Choose your own target, save it and press Ready. Targets lock when everyone is Ready.'
          )}
        </p>
      )}
      {lobby && (
        <p>
          {challenge.start_next_day
            ? t(
                'challenges.nextDayHint',
                'When everyone is Ready, targets lock and scoring starts on the next full day in the Challenge timezone.'
              )
            : t(
                'challenges.immediateHint',
                'When everyone is Ready, scoring starts immediately. The entire current Challenge-local day counts, including earlier activity.'
              )}
        </p>
      )}
      <ul className="space-y-3">
        {participants.map((p) => (
          <li key={p.user_id}>
            {p.display_name} ·{' '}
            {p.target_value == null
              ? '—'
              : formatChallengeValue(
                  p.target_value,
                  CHALLENGE_METRIC_UNITS[challenge.metric],
                  locale
                )}{' '}
            ·{' '}
            {p.status === 'accepted'
              ? t(p.ready_at ? 'challenges.ready' : 'challenges.notReady', {
                  defaultValue: p.ready_at ? 'Ready' : 'Not ready',
                })
              : t(`challenges.membership.${p.status}`, {
                  defaultValue: p.status,
                })}
            {lobby &&
              actor === challenge.creator_user_id &&
              p.status === 'pending' && (
                <Button
                  className="ml-3"
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({
                      action: 'withdraw',
                      id: challenge.id,
                      userId: p.user_id,
                    })
                  }
                >
                  {t('challenges.withdraw', 'Withdraw invitation')}
                </Button>
              )}
          </li>
        ))}
      </ul>
      {lobby && own && (
        <SuggestedTarget
          key={`${own.target_revision}:${own.target_value}`}
          detail={detail}
          own={own}
        />
      )}
      {mutation.isError && (
        <p role="alert">
          {t(
            'challenges.actionError',
            'Could not save. Refresh and try again.'
          )}
        </p>
      )}
    </section>
  );
}
function SuggestedTarget({
  detail,
  own,
}: {
  detail: ChallengeDetailResponse;
  own: ChallengeParticipantResponse;
}) {
  const { timezone } = usePreferences();
  const goals = useDailyGoals(
    todayInZone(timezone || detail.challenge.timezone)
  );
  const { t } = useChallengeFormat();
  if (goals.isPending) return <p>{t('common.loading', 'Loading…')}</p>;
  return (
    <TargetForm
      detail={detail}
      own={own}
      suggested={
        goals.data
          ? suggestedChallengeTarget(detail.challenge.metric, goals.data)
          : null
      }
    />
  );
}
function TargetForm({
  detail,
  own,
  suggested,
}: {
  detail: ChallengeDetailResponse;
  own: ChallengeParticipantResponse;
  suggested: number | null;
}) {
  const { challenge } = detail;
  const { t } = useChallengeFormat(challenge.metric, challenge.scoring_mode);
  const input = challengeTargetInput(challenge.metric);
  const [value, setValue] = useState(
    own.target_value == null
      ? suggested == null
        ? ''
        : String(suggested / input.factor)
      : String(own.target_value / input.factor)
  );
  const [invalid, setInvalid] = useState(false);
  const mutation = useChallengeMutation();
  const canonical = Number(value) * input.factor;
  const revision = own.target_revision ?? 0;
  return (
    <div className="space-y-3">
      <Label htmlFor="challenge-target">
        {t('challenges.dailyTarget', {
          defaultValue: 'Your daily target ({{unit}})',
          unit: input.unit,
        })}
      </Label>
      {own.target_value == null && suggested != null && (
        <p>
          {t(
            'challenges.goalSuggested',
            'Suggested from your personal goal. You can choose a different target for this Challenge.'
          )}
        </p>
      )}
      <Input
        id="challenge-target"
        type="number"
        step="any"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={mutation.isPending}
      />
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={mutation.isPending}
          onClick={() => {
            const parsed = challengeTargetSchema.safeParse(canonical);
            setInvalid(!parsed.success);
            if (parsed.success)
              mutation.mutate({
                action: 'target',
                id: challenge.id,
                target: parsed.data,
                revision,
              });
          }}
        >
          {t('challenges.saveTarget', 'Save target')}
        </Button>
        <Button
          variant="outline"
          disabled={
            mutation.isPending ||
            own.target_value == null ||
            canonical !== own.target_value
          }
          onClick={() =>
            mutation.mutate({
              action: 'ready',
              id: challenge.id,
              ready: !own.ready_at,
              revision,
            })
          }
        >
          {t(own.ready_at ? 'challenges.unready' : 'challenges.ready', {
            defaultValue: own.ready_at ? 'Not ready' : 'Ready',
          })}
        </Button>
      </div>
      {invalid && (
        <p role="alert">
          {t(
            'challenges.invalidTarget',
            'Enter a positive target with at most six decimal places in the canonical unit.'
          )}
        </p>
      )}
      {mutation.isError && (
        <p role="alert">
          {t(
            'challenges.actionError',
            'Could not save. Refresh and try again.'
          )}
        </p>
      )}
    </div>
  );
}
