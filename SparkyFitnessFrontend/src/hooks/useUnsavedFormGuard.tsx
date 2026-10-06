import { useBeforeUnload, useBlocker } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/** In-app Back asks before discarding; an in-flight request cannot be cancelled. */
export function UnsavedFormGuard({
  dirty,
  saving,
}: {
  dirty: boolean;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const blocker = useBlocker(dirty || saving);
  useBeforeUnload((event) => {
    if (dirty || saving) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  return (
    <AlertDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(open) => {
        if (!open && blocker.state === 'blocked') blocker.reset();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('challenges.ux.discardTitle', {
              defaultValue: 'Discard unsaved changes?',
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {saving
              ? t('challenges.ux.waitForSave', {
                  defaultValue: 'Wait for the save to finish before leaving.',
                })
              : t('challenges.ux.discardBody', {
                  defaultValue: 'Your changes have not been saved.',
                })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </AlertDialogCancel>
          {!saving && (
            <AlertDialogAction
              onClick={() => {
                if (blocker.state === 'blocked') blocker.proceed();
              }}
            >
              {t('challenges.ux.discard', { defaultValue: 'Discard' })}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
