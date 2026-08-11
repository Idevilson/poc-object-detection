import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardController } from 'react-native-keyboard-controller';
import Animated, { FadeIn } from 'react-native-reanimated';
import { C, MONO, S, TYPE } from '../constants/theme';
import type { EnrollmentSession } from '../hooks/use-enrollment';
import type { Profile } from '../types';
import { slugify } from '../utils/identity';

interface EnrollSheetProps {
  enrollment: EnrollmentSession;
  profiles: Profile[];
  onForget: (profile: Profile) => void;
  onDone: () => void;
  /** `false` while the device is held outside the pose capture requires. */
  inPosition: boolean;
}

/**
 * Guided enrollment sheet.
 *
 * One step is visible at a time: name the identity, capture samples, then a
 * result. Capture starts from the name step and runs to completion on its own;
 * the result stays up until the operator dismisses it.
 */
export function EnrollSheet({
  enrollment,
  profiles,
  onForget,
  onDone,
  inPosition,
}: EnrollSheetProps): React.JSX.Element {
  const [fullName, setFullName] = useState('');

  const onStart = (): void => {
    const name = fullName.trim();
    if (name.length === 0) {
      return;
    }
    KeyboardController.dismiss();
    enrollment.start({ slug: slugify(name), fullName: name });
  };

  if (enrollment.phase === 'success') {
    return <SuccessStep enrollment={enrollment} onDone={onDone} />;
  }

  if (enrollment.phase === 'error') {
    return <ErrorStep enrollment={enrollment} />;
  }

  if (enrollment.busy) {
    return <CaptureStep enrollment={enrollment} />;
  }

  return (
    <NameStep
      fullName={fullName}
      onChangeName={setFullName}
      onStart={onStart}
      profiles={profiles}
      onForget={onForget}
      inPosition={inPosition}
    />
  );
}

function NameStep({
  fullName,
  onChangeName,
  onStart,
  profiles,
  onForget,
  inPosition,
}: {
  fullName: string;
  onChangeName: (value: string) => void;
  onStart: () => void;
  profiles: Profile[];
  onForget: (profile: Profile) => void;
  inPosition: boolean;
}): React.JSX.Element {
  const name = fullName.trim();
  const canStart = name.length > 0 && inPosition;
  const existing = profiles.find(profile => profile.id === slugify(name));

  // Device pose outranks the roster note: it is the reason the button is
  // disabled, so it is what the operator needs to read.
  const caption = !inPosition
    ? 'Hold the device in the required position to start.'
    : existing == null
      ? 'The camera captures 5 angles automatically.'
      : `${existing.fullName} is already enrolled — capturing again replaces those samples.`;

  return (
    <View style={styles.step}>
      <StepHeader
        step="STEP 1 OF 2"
        title="Who are we enrolling?"
        caption={caption}
      />

      <TextInput
        style={styles.input}
        value={fullName}
        onChangeText={onChangeName}
        placeholder="Full name"
        placeholderTextColor={C.neutral}
        autoCapitalize="words"
        autoCorrect={false}
        autoFocus
        returnKeyType="go"
        onSubmitEditing={onStart}
      />

      <Pressable
        style={[styles.button, styles.primary, !canStart && styles.disabled]}
        onPress={onStart}
        disabled={!canStart}
        accessibilityRole="button"
      >
        <Text style={styles.primaryText}>START CAPTURE</Text>
      </Pressable>

      <EnrolledRoster profiles={profiles} onForget={onForget} />
    </View>
  );
}

function CaptureStep({
  enrollment,
}: {
  enrollment: EnrollmentSession;
}): React.JSX.Element {
  const name = enrollment.job?.fullName ?? '';

  return (
    <View
      key="capture"
      style={styles.step}
    >
      <StepHeader
        step={`STEP 2 OF 2 · ${enrollment.captured}/${enrollment.target}`}
        title={name}
        caption={enrollment.hint}
      />

      <CaptureProgress
        captured={enrollment.captured}
        target={enrollment.target}
      />

      <Pressable
        style={[styles.button, styles.ghost]}
        onPress={enrollment.cancel}
        accessibilityRole="button"
      >
        <Text style={styles.ghostText}>CANCEL</Text>
      </Pressable>
    </View>
  );
}

function SuccessStep({
  enrollment,
  onDone,
}: {
  enrollment: EnrollmentSession;
  onDone: () => void;
}): React.JSX.Element {
  return (
    <Animated.View
      key="success"
      style={styles.step}
      entering={FadeIn.duration(160)}
    >
      <View style={styles.resultRow}>
        <View style={[styles.badge, styles.badgeGood]}>
          <Text style={styles.badgeGlyph}>✓</Text>
        </View>
        <View style={styles.resultText}>
          <Text style={styles.title} numberOfLines={1}>
            {enrollment.job?.fullName ?? 'Identity'} enrolled
          </Text>
          <Text style={styles.caption}>
            {enrollment.captured} samples saved · press DONE to keep scanning.
          </Text>
        </View>
      </View>

      <Pressable
        style={[styles.button, styles.ghost]}
        onPress={onDone}
        accessibilityRole="button"
      >
        <Text style={styles.ghostText}>DONE</Text>
      </Pressable>
    </Animated.View>
  );
}

function ErrorStep({
  enrollment,
}: {
  enrollment: EnrollmentSession;
}): React.JSX.Element {
  return (
    <Animated.View
      key="error"
      style={styles.step}
      entering={FadeIn.duration(160)}
    >
      <View style={styles.resultRow}>
        <View style={[styles.badge, styles.badgeBad]}>
          <Text style={styles.badgeGlyph}>!</Text>
        </View>
        <View style={styles.resultText}>
          <Text style={styles.title} numberOfLines={1}>
            Capture stopped
          </Text>
          <Text style={styles.caption}>{enrollment.hint}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <Pressable
          style={[styles.button, styles.primary, styles.grow]}
          onPress={enrollment.retry}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>TRY AGAIN</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.ghost]}
          onPress={enrollment.cancel}
          accessibilityRole="button"
        >
          <Text style={styles.ghostText}>BACK</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function StepHeader({
  step,
  title,
  caption,
}: {
  step: string;
  title: string;
  caption: string;
}): React.JSX.Element {
  return (
    <View style={styles.header}>
      <Text style={TYPE.micro}>{step}</Text>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

function CaptureProgress({
  captured,
  target,
}: {
  captured: number;
  target: number;
}): React.JSX.Element {
  const dots: React.JSX.Element[] = [];
  for (let index = 0; index < target; index += 1) {
    dots.push(
      <View
        key={index}
        style={[styles.dot, index < captured ? styles.dotOn : styles.dotOff]}
      />,
    );
  }
  return <View style={styles.progress}>{dots}</View>;
}

function EnrolledRoster({
  profiles,
  onForget,
}: {
  profiles: Profile[];
  onForget: (profile: Profile) => void;
}): React.JSX.Element {
  if (profiles.length === 0) {
    return (
      <Text style={TYPE.micro}>NO IDENTITIES ENROLLED YET</Text>
    );
  }

  return (
    <View style={styles.roster}>
      <Text style={TYPE.micro}>ENROLLED · {profiles.length}</Text>
      <View style={styles.chips}>
        {profiles.map(profile => (
          <Pressable
            key={profile.id}
            style={styles.chip}
            onPress={() => onForget(profile)}
            accessibilityRole="button"
            accessibilityLabel={`Forget ${profile.fullName}`}
          >
            <Text style={styles.chipText} numberOfLines={1}>
              {profile.fullName}
            </Text>
            <Text style={styles.chipRemove}>×</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  step: {
    gap: S.md,
  },
  header: {
    gap: S.xs,
  },
  title: {
    fontFamily: MONO,
    fontSize: 16,
    letterSpacing: 0.2,
    color: C.white,
  },
  caption: {
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0.2,
    color: C.whiteDim,
  },
  input: {
    height: 48,
    paddingHorizontal: S.md,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.hairline,
    backgroundColor: C.input,
    color: C.white,
    fontFamily: MONO,
    fontSize: 15,
  },
  progress: {
    flexDirection: 'row',
    gap: S.xs,
    height: 4,
  },
  dot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  dotOn: {
    backgroundColor: C.hud,
  },
  dotOff: {
    backgroundColor: C.hairline,
  },
  row: {
    flexDirection: 'row',
    gap: S.sm,
  },
  grow: {
    flex: 1,
  },
  button: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: C.hud,
  },
  disabled: {
    opacity: 0.35,
  },
  primaryText: {
    fontFamily: MONO,
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: '700',
    color: C.bg,
  },
  ghost: {
    paddingHorizontal: S.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.hairline,
  },
  ghostText: {
    fontFamily: MONO,
    fontSize: 13,
    letterSpacing: 2,
    color: C.whiteDim,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
  },
  resultText: {
    flex: 1,
    gap: S.xs,
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGood: {
    backgroundColor: C.good,
  },
  badgeBad: {
    backgroundColor: C.bad,
  },
  badgeGlyph: {
    fontFamily: MONO,
    fontSize: 17,
    fontWeight: '700',
    color: C.bg,
  },
  roster: {
    gap: S.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: S.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    maxWidth: '100%',
    paddingLeft: S.md,
    paddingRight: S.sm,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.hairline,
    backgroundColor: C.input,
  },
  chipText: {
    flexShrink: 1,
    fontFamily: MONO,
    fontSize: 12,
    color: C.white,
  },
  chipRemove: {
    fontFamily: MONO,
    fontSize: 15,
    lineHeight: 17,
    color: C.whiteDim,
  },
});
