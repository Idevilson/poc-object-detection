import { useEffect, useRef, useState } from 'react';
import {
  type SharedValue,
  SensorType,
  useAnimatedSensor,
  useDerivedValue,
} from 'react-native-reanimated';

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
 * Both angles are physical, not sensor-relative: they come from the direction
 * gravity points in device axes, so they mean the same thing on iOS and
 * Android and need no per-device calibration. Values are signed so a UI can
 * show which way to correct.
 */
export interface PostureReading {
  /**
   * Angle between the screen plane and vertical.
   *
   * `0` is the screen straight up-and-down, `+90` is lying flat face up,
   * `-90` is lying flat face down.
   */
  screenTiltDeg: number;
  /**
   * Rotation of the device within its own screen plane.
   *
   * `0` is portrait upright, `±90` is landscape, `±180` is upside down.
   */
  inPlaneRollDeg: number;
}

/**
 * Limits that define an acceptable capture pose.
 *
 * Plain physical tolerances — raise or lower them to loosen or tighten the
 * gate. Nothing here has to be measured on a device first.
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

/** What the operator should do next, when anything. */
export type PostureGuidance = 'ready' | 'holdUpright' | 'straighten';

export interface DevicePosture {
  /** Reactive state, for enabling or disabling controls. */
  inPosition: boolean;
  /** Which correction to ask for. Changes at most a few times per second. */
  guidance: PostureGuidance;
  /**
   * Live reading on the UI runtime, for driving an indicator at display rate
   * without a round trip through JS. `null` on a degenerate sample.
   */
  reading: SharedValue<PostureReading | null>;
  /**
   * Immediate read, for gating an action at the moment it is attempted.
   *
   * Deliberately separate from {@linkcode inPosition}: React state can be one
   * render behind the device, and the capture gate must not decide on stale
   * information.
   */
  check(): boolean;
  /** Tolerances in force, so an indicator can scale itself to them. */
  limits: PostureLimits;
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
  'worklet';

  const magnitude = Math.sqrt(
    gravity.x * gravity.x + gravity.y * gravity.y + gravity.z * gravity.z,
  );
  if (magnitude < MIN_GRAVITY_MAGNITUDE) {
    return null;
  }

  // Screen flat on a table puts all of gravity on -z, giving 90 degrees.
  const normalizedZ = Math.min(1, Math.max(-1, -gravity.z / magnitude));

  return {
    screenTiltDeg: Math.asin(normalizedZ) * RAD_TO_DEG,
    inPlaneRollDeg: Math.atan2(gravity.x, -gravity.y) * RAD_TO_DEG,
  };
}

function isWithinLimits(
  reading: PostureReading | null,
  limits: PostureLimits,
  wasInPosition: boolean,
): boolean {
  'worklet';

  // A dropped sample must not interrupt a run in progress.
  if (reading == null) {
    return wasInPosition;
  }

  const slack = wasInPosition ? limits.hysteresisDeg : 0;

  return (
    Math.abs(reading.screenTiltDeg) <= limits.maxScreenTiltDeg + slack &&
    Math.abs(reading.inPlaneRollDeg) <= limits.maxInPlaneRollDeg + slack
  );
}

/** Picks the correction to show: whichever axis is further out of range. */
function guidanceFor(
  reading: PostureReading | null,
  limits: PostureLimits,
): PostureGuidance {
  if (reading == null) {
    return 'ready';
  }

  const tiltExcess =
    Math.abs(reading.screenTiltDeg) - limits.maxScreenTiltDeg;
  const rollExcess =
    Math.abs(reading.inPlaneRollDeg) - limits.maxInPlaneRollDeg;

  if (tiltExcess <= 0 && rollExcess <= 0) {
    return 'ready';
  }
  return tiltExcess >= rollExcess ? 'holdUpright' : 'straighten';
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
    // Raw device axes. These angles are physical facts about how the handset
    // is held, and must not be rewritten to follow the UI.
    adjustToInterfaceOrientation: false,
  });

  const [inPosition, setInPosition] = useState(false);
  const [guidance, setGuidance] = useState<PostureGuidance>('holdUpright');
  // Owned by the sampling effect. `check` reads it to pick the hysteresis
  // slack but never writes, so there is exactly one writer.
  const inPositionRef = useRef(false);
  const guidanceRef = useRef<PostureGuidance>('holdUpright');

  const { maxScreenTiltDeg, maxInPlaneRollDeg, hysteresisDeg } = limits;

  const reading = useDerivedValue<PostureReading | null>(() => {
    return measurePosture(sensor.get());
  });

  const check = (): boolean => {
    if (!isAvailable) {
      return true;
    }
    return isWithinLimits(measurePosture(sensor.get()), limits, inPositionRef.current);
  };

  useEffect(() => {
    if (!isAvailable) {
      return;
    }

    const activeLimits: PostureLimits = {
      maxScreenTiltDeg,
      maxInPlaneRollDeg,
      hysteresisDeg,
    };

    const timer = setInterval((): void => {
      const sample = measurePosture(sensor.get());
      const nextInPosition = isWithinLimits(
        sample,
        activeLimits,
        inPositionRef.current,
      );
      const nextGuidance = nextInPosition
        ? 'ready'
        : guidanceFor(sample, activeLimits);

      // Only re-render on a transition, not on every sample.
      if (nextInPosition !== inPositionRef.current) {
        inPositionRef.current = nextInPosition;
        setInPosition(nextInPosition);
      }
      if (nextGuidance !== guidanceRef.current) {
        guidanceRef.current = nextGuidance;
        setGuidance(nextGuidance);
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
    guidance: isAvailable ? guidance : 'ready',
    reading,
    check,
    limits,
    isAvailable,
  };
}
