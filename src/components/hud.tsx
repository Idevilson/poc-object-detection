import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import {
  KeyboardController,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FaceRecognizer } from 'react-native-vision-camera-face-recognizer';
import { C, S } from '../constants/theme';
import type { FaceEngine } from '../hooks/use-face-engine';
import { type EnrollJob, useEnrollment } from '../hooks/use-enrollment';
import type { ProfilesStore } from '../hooks/use-profiles-store';
import { useScheduler } from '../hooks/use-scheduler';
import type { Mode, Profile } from '../types';
import { EnrollSheet } from './enroll-sheet';
import { GalleryStatus } from './gallery-status';
import { RecognizeStatus } from './recognize-status';
import { TopBar } from './top-bar';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface HudProps {
  engine: FaceEngine;
  recognizer: FaceRecognizer;
  profiles: ProfilesStore;
  recognitionStatus: string;
}

/** How long the "· registered" line stays on the scanner status. */
const NOTICE_MS = 4000;

/** Scheduler keys for this component's cancelable work. */
const GALLERY_WRITE = 'gallery-write';
const NOTICE_CLEAR = 'notice-clear';

export function Hud({
  engine,
  recognizer,
  profiles,
  recognitionStatus,
}: HudProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const scheduler = useScheduler();
  const posture = engine.posture;

  const onRegistered = (
    job: EnrollJob,
    enrollment: ArrayBuffer,
    sampleCount: number,
  ): void => {
    setNotice(`Saving ${job.fullName}…`);
    profiles
      .add({ id: job.slug, fullName: job.fullName, sampleCount }, enrollment)
      .then((): void => {
        setNotice(`${job.fullName} enrolled`);
      })
      .catch((saveError: unknown): void => {
        // The backend is the source of truth. It refused, so undo the native
        // enrollment rather than leave the device matching someone the server
        // has never heard of.
        recognizer.removeEnrollment(job.slug);
        setNotice(
          `Could not save ${job.fullName}: ${getErrorMessage(saveError)}`,
        );
      });
  };

  const onDiscarded = (job: EnrollJob): void => {
    const saved = profiles.getEnrollment(job.slug);
    scheduler.afterInteractions(GALLERY_WRITE, () => {
      if (saved == null) {
        recognizer.removeEnrollment(job.slug);
      } else {
        recognizer.addEnrollment(job.slug, saved);
      }
    });
  };

  const enrollment = useEnrollment(
    recognizer,
    engine.enrollRequest,
    engine.enrollResults,
    { onRegistered, onDiscarded },
    posture.check,
  );

  const setMode = (mode: Mode): void => {
    engine.modeSync.setBlocking(mode);
  };

  const openSheet = (): void => {
    setIsSheetOpen(true);
    setNotice(null);
    scheduler.cancel(NOTICE_CLEAR);
    setMode('register');
  };

  const closeSheet = (): void => {
    setIsSheetOpen(false);
    KeyboardController.dismiss();
    enrollment.cancel();
    setMode('recognize');
    if (notice != null) {
      scheduler.after(NOTICE_CLEAR, NOTICE_MS, () => setNotice(null));
    }
  };

  const isGalleryReady = profiles.status === 'ready';

  const onToggleSheet = (): void => {
    if (isSheetOpen) {
      closeSheet();
      return;
    }
    // Enrolling before the gallery has loaded could overwrite an identity the
    // app has not seen yet, so the sheet stays shut until the backend answers.
    if (!isGalleryReady) {
      return;
    }
    openSheet();
  };

  const onForget = (profile: Profile): void => {
    Alert.alert(
      `Forget ${profile.fullName}?`,
      'This deletes the saved face samples for this identity.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget',
          style: 'destructive',
          onPress: () => {
            scheduler.afterInteractions(GALLERY_WRITE, () => {
              profiles
                .remove(profile.id, recognizer)
                .catch((removeError: unknown): void => {
                  setNotice(
                    `Could not forget ${profile.fullName}: ${getErrorMessage(removeError)}`,
                  );
                });
            });
          },
        },
      ],
    );
  };

  const mode: Mode = isSheetOpen ? 'register' : 'recognize';
  const dockBottom = S.xxl + Math.max(insets.bottom, S.lg);

  return (
    <>
      <TopBar mode={mode} expanded={isSheetOpen} onToggle={onToggleSheet} />

      <KeyboardStickyView
        offset={{ closed: 0, opened: insets.bottom }}
        style={[styles.dock, { bottom: dockBottom }]}
        pointerEvents="box-none"
      >
        <Animated.View
          style={styles.panel}
          layout={LinearTransition.duration(220)}
        >
          {!isGalleryReady ? (
            <Animated.View key="gallery" entering={FadeIn.duration(180)}>
              <GalleryStatus
                status={profiles.status}
                error={profiles.error}
                onRetry={profiles.reload}
              />
            </Animated.View>
          ) : isSheetOpen ? (
            <EnrollSheet
              enrollment={enrollment}
              profiles={profiles.list}
              onForget={onForget}
              onDone={closeSheet}
              posture={posture}
            />
          ) : (
            <Animated.View key="recognize" entering={FadeIn.duration(180)}>
              <RecognizeStatus
                status={recognitionStatus}
                notice={notice}
                enrolledCount={profiles.list.length}
              />
            </Animated.View>
          )}
        </Animated.View>
      </KeyboardStickyView>
    </>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: S.lg,
    right: S.lg,
    gap: S.md,
  },
  panel: {
    padding: S.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.panelBorder,
    backgroundColor: 'black',
  },
});
