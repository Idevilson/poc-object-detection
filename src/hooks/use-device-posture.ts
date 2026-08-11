import { useEffect, useRef, useState } from 'react';
import { SensorType, useAnimatedSensor } from 'react-native-reanimated';

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Sensor and evaluation cadence. The gate only has to keep up with a human
 * wrist, so this stays far below the camera's frame rate.
 */
const SAMPLE_MS = 150;

/** Below this the reading is noise (free fall, or a bad sample). */
const MIN_GRAVITY_MAGNITUDE = 1e-6;

/**
 * How the device is being held, derived from gravity alone.
 *
 * Both angles are physical, not sensor-relative: they are computed from the
 * direction gravity points in device axes, so they mean the same thing on iOS
 * and Android and need no per-device calibration.
 */
export interface PostureReading {
  /**
   * Angle between the screen plane and vertical.
   *
   * `0` is the screen straight up-and-down; `90` is the device lying flat.
   */
  screenTiltDeg: number;
  /**
   * Rotation of the device within its own screen plane.
   *
   * `0` is portrait upright; `±90` is landscape; `180` is upside down.
   */
  inPlaneRollDeg: number;
}

/**
 * Limits that define an acceptable capture pose.
 *
 * These are plain physical tolerances — change them to make the gate stricter
 * or looser. Nothing here has to be measured on a device first.
 */
export interface PostureLimits {
  /** Max lean away from a vertical screen. People naturally tilt back a bit. */
  maxScreenTiltDeg: number;
  /** Max sideways rotation. Large values put the face in frame diagonally. */
  maxInPlaneRollDeg: number;
  /**
   * Extra slack allowed to STAY valid once the pose was accepted. Without this
   * gap the gate flickers while the operator holds the device near the limit.
   */
  hysteresisDeg: number;
}

export const DEFAULT_POSTURE_LIMITS: PostureLimits = {
  maxScreenTiltDeg: 30,
  maxInPlaneRollDeg: 15,
  hysteresisDeg: 6,
};

export interface DevicePosture {
  /** Reactive state, for enabling or disabling controls. */
  inPosition: boolean;
  /**
   * Immediate read, for gating an action at the moment it is attempted.
   *
   * Deliberately separate from {@linkcode inPosition}: React state can be one
   * render behind the device, and the capture gate must not decide on stale
   * information.
   */
  check(): boolean;
  /** Current angles. Useful for on-screen guidance or for tuning the limits. */
  read(): PostureReading | null;
  /** `false` when the device exposes no gravity sensor. */
  isAvailable: boolean;
}

interface GravityVector {
  x: number;
  y: number;
  z: number;
}

/**
 * Converts a gravity vector into the two angles the gate cares about.
 *
 * Device axes are the same on both platforms: `x` points right, `y` points at
 * the top of the device, `z` points out of the screen. Magnitude is divided
 * out, so it does not matter that iOS reports G units and Android m/s².
 *
 * Returns `null` for a degenerate sample rather than emitting a bogus angle.
 */
function measurePosture(gravity: GravityVector): PostureReading | null {
  const magnitude = Math.sqrt(
    gravity.x * gravity.x + gravity.y * gravity.y + gravity.z * gravity.z,
  );
  if (magnitude < MIN_GRAVITY_MAGNITUDE) {
    return null;
  }

  // Screen flat on a table puts all of gravity on -z, giving 90 degrees.
  const normalizedZ = Math.min(1, Math.max(-1, -gravity.z / magnitude));

  return {
    screenTiltDeg: Math.abs(Math.asin(normalizedZ) * RAD_TO_DEG),
    inPlaneRollDeg: Math.abs(
      Math.atan2(gravity.x, -gravity.y) * RAD_TO_DEG,
    ),
  };
}

function isWithinLimits(
  reading: PostureReading | null,
  limits: PostureLimits,
  wasInPosition: boolean,
): boolean {
  if (reading == null) {
    return wasInPosition;
  }

  const slack = wasInPosition ? limits.hysteresisDeg : 0;

  return (
    reading.screenTiltDeg <= limits.maxScreenTiltDeg + slack &&
    reading.inPlaneRollDeg <= limits.maxInPlaneRollDeg + slack
  );
}

/**
 * Reports whether the device is currently held in a usable capture pose.
 *
 * A device with no gravity sensor always reports `true`: refusing to enroll
 * anyone at all is a worse failure than skipping the check.
 */
export function useDevicePosture(
  limits: PostureLimits = DEFAULT_POSTURE_LIMITS,
): DevicePosture {
  const { sensor, isAvailable } = useAnimatedSensor(SensorType.GRAVITY, {
    interval: SAMPLE_MS,
    // Raw device axes. The angles below are physical facts about how the
    // handset is held, and must not be rewritten to follow the UI.
    adjustToInterfaceOrientation: false,
  });

  const [inPosition, setInPosition] = useState(false);
  // Owned by the sampling effect. `check` reads it to pick the hysteresis
  // slack but never writes, so there is exactly one writer.
  const inPositionRef = useRef(false);

  const { maxScreenTiltDeg, maxInPlaneRollDeg, hysteresisDeg } = limits;

  const read = (): PostureReading | null => {
    if (!isAvailable) {
      return null;
    }
    return measurePosture(sensor.get());
  };

  const check = (): boolean => {
    if (!isAvailable) {
      return true;
    }
    return isWithinLimits(read(), limits, inPositionRef.current);
  };

  useEffect(() => {
    if (!isAvailable) {
      return;
    }

    const timer = setInterval((): void => {
      const next = isWithinLimits(
        measurePosture(sensor.get()),
        { maxScreenTiltDeg, maxInPlaneRollDeg, hysteresisDeg },
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
    maxScreenTiltDeg,
    maxInPlaneRollDeg,
    hysteresisDeg,
  ]);

  return {
    inPosition: isAvailable ? inPosition : true,
    check,
    read,
    isAvailable,
  };
}
