import type {
  MatchedFace,
  RecognizedFace,
} from 'react-native-vision-camera-face-recognizer';
import { MAX_FACES, type MatchOut, type OverlayState } from '../types';

function isMatchedFace(face: RecognizedFace): face is MatchedFace {
  'worklet';

  return (
    face.status === 'matched' &&
    typeof face.enrollmentId === 'string' &&
    typeof face.similarity === 'number'
  );
}

function formatRecognizedFace(face: RecognizedFace): string {
  'worklet';

  if (isMatchedFace(face)) {
    return `${face.enrollmentId} (${face.similarity.toFixed(2)})`;
  }
  if (face.status === 'collecting') {
    return `collecting ${face.samplesCollected}/${face.samplesRequired}`;
  }
  return face.status;
}

export function createMatchesFromFaces(
  faces: OverlayState['faces'],
  version: number,
): MatchOut[] {
  'worklet';

  const matches: MatchOut[] = [];
  for (let index = 0; index < MAX_FACES; index += 1) {
    const face = faces[index];
    matches.push(
      face != null && isMatchedFace(face)
        ? {
            id: face.enrollmentId,
            similarity: face.similarity,
            version,
            faceIndex: index,
          }
        : null,
    );
  }
  return matches;
}

export function selectBestMatchFromMatches(matches: MatchOut[]): MatchOut {
  'worklet';

  let bestMatch: MatchOut = null;
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    if (
      match != null &&
      (bestMatch == null || match.similarity > bestMatch.similarity)
    ) {
      bestMatch = match;
    }
  }
  return bestMatch;
}

export function formatRecognitionStatus(
  recognizedFaces: RecognizedFace[],
): string {
  'worklet';

  if (recognizedFaces.length === 0) {
    return 'No faces';
  }

  let summary = '';
  for (let index = 0; index < recognizedFaces.length; index += 1) {
    const label = formatRecognizedFace(recognizedFaces[index]);
    summary = index === 0 ? label : `${summary}, ${label}`;
  }
  return `Recognized: ${summary}`;
}
