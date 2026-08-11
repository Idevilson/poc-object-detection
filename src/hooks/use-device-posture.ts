import { useEffect, useRef, useState } from 'react';
import {
  IOSReferenceFrame,
  SensorType,
  useAnimatedSensor,
} from 'react-native-reanimated';

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Sensor and evaluation cadence. The gate only needs to feel responsive to a
 * human wrist, so this stays far below the camera's frame rate.
 */
const SAMPLE_MS = 150;

/**
 * Angles that define "the device is held the way capture requires".
 *
 * `reference*` must be measured on a real device, not assumed: the zero point
 * and sign of the rotation sensor differ between iOS (CoreMotion) and Android,
 * and shift again with `adjustToInterfaceOrientation`. Read the live values
 * through {@linkcode DevicePosture.read} while holding the device in the target
 * pose, then write those numbers here.
 */
export interface PostureLimits {
  /** Pitch, in degrees, of the accepted pose. */
  referencePitchDeg: number;
  /** Roll, in degrees, of the accepted pose. */
  referenceRollDeg: number;
  /** Deviation allowed to ENTER the valid state. */
  enterToleranceDeg: number;
  /**
   * Deviation allowed to STAY valid. Wider than `enterToleranceDeg` on
   * purpose: without that gap the gate flickers while the operator holds the
   * device near the boundary.
   */
  exitToleranceDeg: number;
}

export const DEFAULT_POSTURE_LIMITS: PostureLimits = {
  referencePitchDeg: 0,
  referenceRollDeg: 0,
  enterToleranceDeg: 12,
  exitToleranceDeg: 18,
};

export interface DevicePosture {
  /** Reactive state, for enabling or disabling controls. */
  inPosition: boolean;
  /**
   * Immediate read, for gating an action at the moment it is attempted.
   *
   * Kept separate from {@linkcode inPosition} so the capture gate never acts on
   * a value that is one render behind the device.
   */
  check(): boolean;
  /** Raw angles in degrees. Used to calibrate, and to show the operator. */
  read(): { pitchDeg: number; rollDeg: number };
  /** `false` when the device exposes no rotation sensor. */
  isAvailable: boolean;
}

function isWithinLimits(
  pitchDeg: number,
  rollDeg: number,
  limits: PostureLimits,
  wasInPosition: boolean,
): boolean {
  const tolerance = wasInPosition
    ? limits.exitToleranceDeg
    : limits.enterToleranceDeg;

  return (
    Math.abs(pitchDeg - limits.referencePitchDeg) <= tolerance &&
    Math.abs(rollDeg - limits.referenceRollDeg) <= tolerance
  );
}

/**
 * Reports whether the device is currently held in the pose capture requires.
 *
 * A device with no rotation sensor always reports `true`: refusing to enroll
 * anyone at all is a worse failure than skipping the check.
 */
export function useDevicePosture(
  limits: PostureLimits = DEFAULT_POSTURE_LIMITS,
): DevicePosture {
  const { sensor, isAvailable } = useAnimatedSensor(SensorType.ROTATION, {
    interval: SAMPLE_MS,
    // Reanimated rewrites the values for the current interface orientation, so
    // the reference angles below stay valid when the screen rotates.
    adjustToInterfaceOrientation: true,
    iosReferenceFrame: IOSReferenceFrame.Auto,
  });

  const [inPosition, setInPosition] = useState(false);
  // Owned by the sampling effect. `check` reads it to pick the hysteresis
  // tolerance, but never writes, so there is a single writer.
  const inPositionRef = useRef(false);

  const {
    referencePitchDeg,
    referenceRollDeg,
    enterToleranceDeg,
    exitToleranceDeg,
  } = limits;

  const read = (): { pitchDeg: number; rollDeg: number } => {
    const { pitch, roll } = sensor.get();
    return { pitchDeg: pitch * RAD_TO_DEG, rollDeg: roll * RAD_TO_DEG };
  };

  const check = (): boolean => {
    if (!isAvailable) {
      return true;
    }

    const { pitchDeg, rollDeg } = read();
    return isWithinLimits(pitchDeg, rollDeg, limits, inPositionRef.current);
  };

  useEffect(() => {
    if (!isAvailable) {
      return;
    }

    const timer = setInterval((): void => {
      const { pitch, roll } = sensor.get();
      const next = isWithinLimits(
        pitch * RAD_TO_DEG,
        roll * RAD_TO_DEG,
        {
          referencePitchDeg,
          referenceRollDeg,
          enterToleranceDeg,
          exitToleranceDeg,
        },
        inPositionRef.current,
      );

      // Only re-render on the transition, not on every sample.
      if (next !== inPositionRef.current) {
        inPositionRef.current = next;
        setInPosition(next);
      }
    }, SAMPLE_MS);

    return () => clearInterval(timer);
  }, [
    sensor,
    isAvailable,
    referencePitchDeg,
    referenceRollDeg,
    enterToleranceDeg,
    exitToleranceDeg,
  ]);

  return {
    inPosition: isAvailable ? inPosition : true,
    check,
    read,
    isAvailable,
  };
}
