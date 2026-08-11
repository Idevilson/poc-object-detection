import { useEffect, useRef, useState } from 'react';
import { type SharedValue, useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { MAX_FACES, type RecognitionState } from '../types';
import type { ProfilesStore } from './use-profiles-store';

const MATCH_NAME_HOLD_MS = 3500;

type MatchNameList = (string | null)[];
type MatchNameHoldTimers = Array<ReturnType<typeof setTimeout> | null>;

export interface RecognitionViewState {
  status: string;
  matchNames: MatchNameList;
}

function createEmptyMatchNames(): MatchNameList {
  const names: MatchNameList = [];
  for (let index = 0; index < MAX_FACES; index += 1) {
    names.push(null);
  }
  return names;
}

function createEmptyMatchNameHoldTimers(): MatchNameHoldTimers {
  const timers: MatchNameHoldTimers = [];
  for (let index = 0; index < MAX_FACES; index += 1) {
    timers.push(null);
  }
  return timers;
}

function didNamesChange(
  previousNames: MatchNameList,
  nextNames: MatchNameList,
): boolean {
  for (let index = 0; index < nextNames.length; index += 1) {
    if (previousNames[index] !== nextNames[index]) {
      return true;
    }
  }
  return false;
}

export function useRecognitionViewState(
  recognitionOut: SharedValue<RecognitionState>,
  profiles: ProfilesStore,
): RecognitionViewState {
  const [status, setStatus] = useState('');
  const [matchNames, setMatchNames] = useState<MatchNameList>(
    createEmptyMatchNames,
  );
  const matchNamesRef = useRef<MatchNameList>(matchNames);
  const matchNameHoldTimers = useRef<MatchNameHoldTimers | null>(null);
  if (matchNameHoldTimers.current === null) {
    matchNameHoldTimers.current = createEmptyMatchNameHoldTimers();
  }

  const publishMatchNames = (nextNames: MatchNameList): void => {
    if (!didNamesChange(matchNamesRef.current, nextNames)) {
      return;
    }

    matchNamesRef.current = nextNames;
    setMatchNames(nextNames);
  };

  const clearMatchNameHoldTimer = (faceIndex: number): void => {
    const timer = matchNameHoldTimers.current![faceIndex] ?? null;
    if (timer == null) {
      return;
    }

    clearTimeout(timer);
    matchNameHoldTimers.current![faceIndex] = null;
  };

  const scheduleMatchNameClear = (faceIndex: number): void => {
    if (matchNameHoldTimers.current![faceIndex] != null) {
      return;
    }

    matchNameHoldTimers.current![faceIndex] = setTimeout(() => {
      matchNameHoldTimers.current![faceIndex] = null;
      const nextNames = matchNamesRef.current.slice();
      if (nextNames[faceIndex] == null) {
        return;
      }

      nextNames[faceIndex] = null;
      publishMatchNames(nextNames);
    }, MATCH_NAME_HOLD_MS);
  };

  const updateState = (recognition: RecognitionState): void => {
    setStatus(previousStatus =>
      previousStatus === recognition.status
        ? previousStatus
        : recognition.status,
    );

    const nextNames = matchNamesRef.current.slice();
    for (let index = 0; index < MAX_FACES; index += 1) {
      if (recognition.visibleFaceSlots[index] !== true) {
        clearMatchNameHoldTimer(index);
        nextNames[index] = null;
        continue;
      }

      const match = recognition.matches[index] ?? null;
      if (match != null && match.faceIndex === index) {
        const matchName = profiles.get(match.id)?.fullName ?? null;
        if (matchName != null) {
          clearMatchNameHoldTimer(index);
          nextNames[index] = matchName;
          continue;
        }
      }

      if (nextNames[index] != null) {
        scheduleMatchNameClear(index);
      }
    }

    publishMatchNames(nextNames);
  };

  useEffect(() => {
    return () => {
      const timers = matchNameHoldTimers.current;
      if (timers == null) {
        return;
      }
      for (let index = 0; index < MAX_FACES; index += 1) {
        const timer = timers[index];
        if (timer != null) {
          clearTimeout(timer);
          timers[index] = null;
        }
      }
    };
  }, []);

  useAnimatedReaction(
    () => {
      const recognition = recognitionOut.get();
      return {
        recognition,
        recognitionVersion: recognition.version,
      };
    },
    (current, previous) => {
      if (
        previous == null ||
        current.recognitionVersion !== previous.recognitionVersion
      ) {
        scheduleOnRN(updateState, current.recognition);
      }
    },
    [updateState],
  );

  return { status, matchNames };
}
