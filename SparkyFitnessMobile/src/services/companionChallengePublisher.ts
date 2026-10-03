import type { CompanionChallengeSnapshot } from '../types/companionChallenges';
import { emptyCompanionChallenges } from '../utils/companionChallenges';
import { getCompanionChallengeSession } from './companionChallengeSession';

/** Serial account-guarded writes shared by Wear and phone widgets. Native transports own delivery. */
export class CompanionChallengePublisher {
  private queue: Promise<void> = Promise.resolve();
  private previous = '';
  constructor(
    private readonly publish: (json: string) => Promise<void>,
    private readonly activeConfig: () => Promise<string | null>,
    private readonly onFailure: () => void
  ) {}
  offer(
    snapshot: CompanionChallengeSnapshot,
    revision: number,
    configId?: string,
    presentationKey = ''
  ): Promise<void> {
    this.queue = this.queue
      .then(async () => {
        let next = snapshot;
        const session = getCompanionChallengeSession();
        if (session.blocked || session.revision !== revision)
          next = emptyCompanionChallenges();
        if (next.state === 'ready') {
          const currentConfig = await this.activeConfig();
          if (
            !configId ||
            currentConfig !== configId ||
            getCompanionChallengeSession() !== session
          )
            next = emptyCompanionChallenges();
        }
        const serialized = JSON.stringify(next);
        const signature = `${presentationKey}:${serialized}`;
        if (signature === this.previous) return;
        await this.publish(serialized);
        this.previous = signature;
      })
      .catch(() => {
        this.previous = '';
        this.onFailure();
      });
    return this.queue;
  }
}
