import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { C, MONO, S, TYPE } from '../constants/theme';
import type { ProfilesStatus } from '../hooks/use-profiles-store';

interface GalleryStatusProps {
  status: ProfilesStatus;
  error: string | undefined;
  onRetry: () => void;
}

/**
 * Panel shown while the identity gallery is unavailable.
 *
 * The backend owns the gallery, so until it answers the app cannot claim to
 * recognize anyone. Saying so is better than showing an empty scanner that
 * looks like it works.
 */
export function GalleryStatus({
  status,
  error,
  onRetry,
}: GalleryStatusProps): React.JSX.Element {
  if (status === 'loading') {
    return (
      <View style={styles.root}>
        <View style={styles.row}>
          <ActivityIndicator size="small" color={C.hud} />
          <Text style={styles.message}>Loading identities…</Text>
        </View>
        <Text style={TYPE.micro}>CONNECTING TO GALLERY</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <View style={styles.dot} />
        <Text style={styles.message} numberOfLines={3}>
          {error ?? 'Could not reach the gallery.'}
        </Text>
      </View>

      <Pressable
        style={styles.retry}
        onPress={onRetry}
        accessibilityRole="button"
      >
        <Text style={styles.retryText}>RETRY</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: S.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.bad,
  },
  message: {
    flex: 1,
    fontFamily: MONO,
    fontSize: 13,
    letterSpacing: 0.3,
    color: C.white,
  },
  retry: {
    alignSelf: 'flex-start',
    paddingVertical: S.sm,
    paddingHorizontal: S.lg,
    borderWidth: 1,
    borderColor: C.hud,
    borderRadius: 4,
  },
  retryText: {
    fontFamily: MONO,
    fontSize: 12,
    letterSpacing: 1.6,
    color: C.hud,
  },
});
