import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Footprints } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { useChallengeFormat } from './presentation';

export function ChallengeShell({
  children,
  back = false,
}: {
  children: ReactNode;
  back?: boolean;
}) {
  const { t } = useChallengeFormat();
  const { isActingOnBehalf, switchToUser } = useActiveUser();
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 pb-28 sm:px-6 sm:py-10">
      {back && (
        <Button variant="ghost" asChild>
          <Link to="/challenges">
            <ArrowLeft aria-hidden className="mr-2 h-4 w-4" />
            {t('challenges.title', 'Challenges')}
          </Link>
        </Button>
      )}
      {isActingOnBehalf ? (
        <section className="space-y-4 rounded-3xl border p-8">
          <h1 className="text-2xl font-semibold">
            {t('challenges.selfOnly', 'Your Challenges are personal')}
          </h1>
          <p>
            {t(
              'challenges.selfDescription',
              'Switch back to your own profile to take part.'
            )}
          </p>
          <Button onClick={() => void switchToUser(null)}>
            {t('challenges.switchSelf', 'Use my profile')}
          </Button>
        </section>
      ) : (
        children
      )}
    </main>
  );
}
export function ChallengeLoading() {
  const { t } = useChallengeFormat();
  return (
    <div
      role="status"
      aria-label={t('challenges.loading', 'Loading Challenges')}
      className="space-y-4"
    >
      <Skeleton className="motion-reduce:animate-none h-10 w-2/3" />
      <Skeleton className="motion-reduce:animate-none h-56 w-full rounded-3xl" />
      <Skeleton className="motion-reduce:animate-none h-24 w-full rounded-3xl" />
    </div>
  );
}
export function ChallengeError({ retry }: { retry?: () => void }) {
  const { t } = useChallengeFormat();
  return (
    <div role="alert" className="space-y-3 rounded-2xl border p-5">
      <p>
        {t(
          'challenges.loadError',
          'Could not load Challenges. Check your connection and try again.'
        )}
      </p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          {t('challenges.retry', 'Try again')}
        </Button>
      )}
    </div>
  );
}
export function ChallengeEmpty() {
  const { t } = useChallengeFormat();
  return (
    <section className="flex flex-col items-center gap-5 rounded-3xl border border-dashed bg-muted/30 px-6 py-16 text-center">
      <Footprints aria-hidden className="h-12 w-12" />
      <h2 className="text-3xl font-semibold tracking-tight">
        {t('challenges.emptyTitle', 'Go a little further, together')}
      </h2>
      <p className="max-w-md text-muted-foreground">
        {t(
          'challenges.emptyDescription',
          'Turn everyday steps into friendly competition. Start with a day or make it a week.'
        )}
      </p>
      <Button asChild>
        <Link to="/challenges/new">
          {t('challenges.create', 'Create Challenge')}
        </Link>
      </Button>
    </section>
  );
}
