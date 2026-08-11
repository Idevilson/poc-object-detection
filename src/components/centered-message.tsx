import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C, MONO, S } from '../constants/theme';

interface CenteredMessageProps {
  message: string;
}

export function CenteredMessage({
  message,
}: CenteredMessageProps): React.JSX.Element {
  return (
    <View style={styles.root}>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
  },
  message: {
    fontFamily: MONO,
    fontSize: 14,
    letterSpacing: 0.5,
    color: C.white,
    paddingHorizontal: S.xl,
    textAlign: 'center',
  },
});
