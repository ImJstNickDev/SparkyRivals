import { formatChallengeDisplay, challengeScoreUnit } from '@workspace/shared';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { useNavigation } from '@react-navigation/native';
import { useNavigationActionGuard } from '../../hooks/useNavigationActionGuard';
import Icon from '../Icon';
import {
  useChallenges,
  useChallengeIdentity,
  useChallengeResults,
} from '../../hooks/useChallenges';
import { useChallengeFormat } from './ChallengeChrome';
import { challengeIcon } from './ChallengeCard';

export default function ChallengeDashboardEntry({
  onPress,
}: {
  onPress: (id?: string) => void;
}) {
  const navigation = useNavigation();
  const { isNavigationLocked, runNavigationAction } =
    useNavigationActionGuard(navigation);
  const query = useChallenges('summary');
  const active = useChallenges('active');
  const activePage = active.data?.pages[0];
  // The server applies the active/accepted filter before its limit + 1 query.
  // A priority summary or a partially loaded My Challenges list cannot prove uniqueness.
  const soleActive =
    !active.isPending &&
    !active.isFetching &&
    !active.isError &&
    activePage?.has_more === false &&
    activePage.challenges.length === 1 &&
    activePage.challenges[0].lifecycle === 'active' &&
    activePage.challenges[0].my_membership === 'accepted'
      ? activePage.challenges[0]
      : undefined;
  const { actor } = useChallengeIdentity();
  const challenge = soleActive ?? query.data?.pages[0]?.challenges[0];
  const result = useChallengeResults(challenge);
  const own = result.data?.entries.find((entry) => entry.user_id === actor);
  const { t, locale, displayPreferences, statuses, unitLabel, day } =
    useChallengeFormat(challenge?.metric, challenge?.scoring_mode);
  const accent = useCSSVariable('--color-accent-primary') as string;
  const pending = challenge?.my_membership === 'pending';
  const hint = pending
    ? t('challenges.reviewInvitation', { defaultValue: 'Review invitation' })
    : challenge?.lifecycle === 'lobby'
      ? challenge.my_ready
        ? t('challenges.ux.readyWaiting', {
            defaultValue: "You're ready · Waiting for others",
          })
        : t('challenges.ux.chooseTargetReady', {
            defaultValue: 'Choose your target and get ready',
          })
      : challenge
        ? statuses[challenge.lifecycle]
        : query.isError
          ? t('challenges.ux.openHub', { defaultValue: 'Open Challenges' })
          : query.isPending
            ? t('challenges.loading', { defaultValue: 'Loading Challenges' })
            : t('challenges.ux.startTogether', {
                defaultValue: 'Start a Challenge together',
              });
  return (
    <Pressable
      onPress={() => runNavigationAction(() => onPress(soleActive?.id))}
      disabled={isNavigationLocked}
      accessibilityRole="button"
      className="mb-4 flex-row items-center gap-3 rounded-2xl bg-surface p-4"
      style={{ minHeight: 80 }}
    >
      <Icon
        name={challenge ? challengeIcon[challenge.metric] : 'trophy'}
        size={24}
        color={accent}
      />
      <View className="flex-1 gap-1">
        <Text className="text-text-secondary text-sm">
          {t('challenges.title', { defaultValue: 'Challenges' })}
        </Text>
        <Text className="text-text-primary text-base font-semibold">
          {challenge?.name ?? hint}
        </Text>
        {challenge && (
          <Text className="text-text-secondary text-sm">
            {own && challenge.lifecycle === 'active'
              ? t('challenges.ux.summaryScore', {
                  defaultValue: '{{value}} {{unit}} · Rank {{rank}}',
                  value: formatChallengeDisplay(
                    own.total_score,
                    challengeScoreUnit(
                      challenge.metric,
                      challenge.scoring_mode
                    ),
                    locale,
                    t,
                    displayPreferences,
                    false,
                    1
                  ),
                  unit: unitLabel(own.total_score),
                  rank: own.rank ?? '—',
                })
              : hint}
            {challenge.lifecycle === 'active' && challenge.end_date
              ? ` · ${t('challenges.ux.endsOn', { defaultValue: 'Ends {{date}}', date: day(challenge.end_date) })}`
              : ''}
          </Text>
        )}
      </View>
      <Icon name="chevron-forward" size={18} color={accent} />
    </Pressable>
  );
}
