import { useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Swipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import {
  runOnJS,
  useAnimatedReaction,
  type SharedValue,
} from 'react-native-reanimated';
import type { ChallengeParticipantResponse } from '@workspace/shared';
import { DeleteRowAction } from '../SwipeableDeleteRow';

function RemovalAction({
  translation,
  width,
  confirm,
  disabled,
}: {
  translation: SharedValue<number>;
  width: number;
  confirm: () => void;
  disabled: boolean;
}) {
  useAnimatedReaction(
    () => !disabled && width > 0 && -translation.value >= width * 0.75,
    (full, previous) => {
      if (full && !previous) runOnJS(confirm)();
    },
    [width, disabled, confirm]
  );
  return <DeleteRowAction onPress={confirm} disabled={disabled} />;
}

export function ChallengeParticipantRow({
  participant,
  status,
  removable,
  pending,
  onRemove,
}: {
  participant: ChallengeParticipantResponse;
  status: string;
  removable: boolean;
  pending: boolean;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const swipe = useRef<SwipeableMethods>(null);
  const confirming = useRef(false);
  const [width, setWidth] = useState(0);
  const confirm = () => {
    if (confirming.current || pending || !removable) return;
    confirming.current = true;
    const close = () => {
      swipe.current?.close();
      confirming.current = false;
    };
    Alert.alert(
      t('challenges.ux.removeParticipant', {
        defaultValue: 'Remove {{name}}?',
        name: participant.display_name,
      }),
      undefined,
      [
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
          onPress: close,
        },
        {
          text: t('common.remove', { defaultValue: 'Remove' }),
          style: 'destructive',
          onPress: () => {
            close();
            onRemove();
          },
        },
      ],
      { cancelable: true, onDismiss: close }
    );
  };
  const Row = removable ? Pressable : View;
  const row = (
    <Row
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onLongPress={removable ? confirm : undefined}
      accessible
      accessibilityLabel={`${participant.display_name}, ${status}`}
      accessibilityActions={
        removable
          ? [
              {
                name: 'remove',
                label: t('common.remove', { defaultValue: 'Remove' }),
              },
            ]
          : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'remove') confirm();
      }}
      className="bg-background flex-row items-center gap-3 py-4 border-b border-border-subtle min-h-12"
    >
      <Text className="text-text-primary font-semibold flex-1">
        {participant.display_name}
      </Text>
      <Text className="text-text-secondary flex-shrink">{status}</Text>
    </Row>
  );
  if (!removable) return row;
  return (
    <View>
      <Swipeable
        ref={swipe}
        enabled={!pending}
        rightThreshold={40}
        overshootFriction={1}
        renderRightActions={(_progress, translation) => (
          <RemovalAction
            translation={translation}
            width={width}
            confirm={confirm}
            disabled={pending}
          />
        )}
      >
        {row}
      </Swipeable>
    </View>
  );
}
