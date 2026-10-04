import { remoteInvitationDataSchema } from '@workspace/shared';
import {
  remotePushRegistration,
  remoteInvitationsEligible,
} from './remotePushRegistration';
import {
  getChallengeSurfaceUrl,
  isChallengeSurfaceLinkAllowed,
} from '../utils/challengeSurfaceLinks';
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getCompanionChallengeSession } from './companionChallengeSession';
import { getActiveServerConfigId } from './storage';
import { fetchProfile } from './api/profileApi';
import { queryClient } from '../hooks/queryClient';
import { profileQueryKey } from '../hooks/queryKeys';

async function verifiedLink(url: string | null): Promise<string | null> {
  if (!url) return null;
  let challenge = false;
  try {
    challenge = new URL(url).hostname === 'challenges';
  } catch {
    return null;
  }
  if (!challenge) return url;
  const session = getCompanionChallengeSession();
  if (session.blocked) return null;
  try {
    const config = await getActiveServerConfigId();
    if (!config) return null;
    const profile = await queryClient.fetchQuery({
      queryKey: profileQueryKey,
      queryFn: fetchProfile,
      staleTime: 30_000,
    });
    if (
      getCompanionChallengeSession() !== session ||
      config !== (await getActiveServerConfigId())
    )
      return null;
    return isChallengeSurfaceLinkAllowed(url, `${config}:${profile.id}`)
      ? url
      : null;
  } catch {
    return null;
  }
}
async function responseUrl(
  response: Notifications.NotificationResponse | null
) {
  const data = response?.notification.request.content.data;
  if (data?.type === 'challenge_invitation') {
    const parsed = remoteInvitationDataSchema.safeParse(data);
    if (!parsed.success) return null;
    if (!remoteInvitationsEligible()) return null;
    const account = await remotePushRegistration.accountForGuard(
      parsed.data.accountGuard
    );
    return account
      ? getChallengeSurfaceUrl(parsed.data.challengeId, account)
      : null;
  }
  return data?.type === 'challenge' && typeof data.url === 'string'
    ? data.url
    : null;
}
export const challengeSurfaceLinking = {
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (url) return verifiedLink(url);
    const response = await Notifications.getLastNotificationResponseAsync();
    const candidate = await responseUrl(response).catch(() => null);
    if (candidate) await Notifications.clearLastNotificationResponseAsync();
    return verifiedLink(candidate);
  },
  subscribe(listener: (url: string) => void) {
    const forward = (url: string | null) => {
      void verifiedLink(url).then((value) => {
        if (value) listener(value);
      });
    };
    const links = Linking.addEventListener('url', (event) =>
      forward(event.url)
    );
    const notifications = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void responseUrl(response)
          .then(forward)
          .catch(() => {});
      }
    );
    return () => {
      links.remove();
      notifications.remove();
    };
  },
};
