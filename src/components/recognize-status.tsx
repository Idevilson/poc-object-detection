import { StyleSheet, Text, View } from 'react-native';
import { C, MONO, S, TYPE } from '../constants/theme';

interface RecognizeStatusProps {
  status: string;
  /** Transient confirmation shown right after an identity is enrolled. */
  notice: string | null;
  enrolledCount: number;
}

export function RecognizeStatus({
  status,
  notice,
  enrolledCount,
}: RecognizeStatusProps): React.JSX.Element {
  const isEmpty = enrolledCount === 0;
  const line =
    notice ??
    (isEmpty ? 'No identities yet — tap ENROLL to add one.' : status);

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <View
          style={[
            styles.dot,
            !isEmpty && styles.dotLive,
            notice != null && styles.dotGood,
          ]}
        />
        <Text style={styles.status} numberOfLines={2}>
          {line}
        </Text>
      </View>
      <Text style={TYPE.micro}>
        {isEmpty
          ? 'STANDBY'
          : `WATCHING FOR ${enrolledCount} ${
              enrolledCount === 1 ? 'IDENTITY' : 'IDENTITIES'
            }`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: S.sm,
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
    backgroundColor: C.neutral,
  },
  dotLive: {
    backgroundColor: C.hud,
  },
  dotGood: {
    backgroundColor: C.good,
  },
  status: {
    flex: 1,
    fontFamily: MONO,
    fontSize: 13,
    letterSpacing: 0.3,
    color: C.white,
  },
});
