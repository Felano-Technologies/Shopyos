// services/liveness/challengeVerifier.js
// Compares 5-point landmarks (leftEye, rightEye, nose, leftMouth, rightMouth)
// between a baseline frame and a challenge frame to verify the claimed
// head-turn / smile actually happened. Deliberately does NOT support
// 'blink' — 5 sparse points give no eyelid-closure signal, and shipping a
// fake blink check would be worse than not having one. Only
// turn_left/turn_right/smile are implemented (per explicit decision to ship
// without blink rather than block on tfjs-node for real eye-landmarks).
//
// All measurements are normalized by inter-ocular distance (eye-to-eye
// distance in the SAME frame) so they're scale-invariant across faces at
// different distances from the camera, rather than relying on raw pixels.

const [LEFT_EYE, RIGHT_EYE, NOSE, LEFT_MOUTH, RIGHT_MOUTH] = [0, 1, 2, 3, 4];

function dist([x1, y1], [x2, y2]) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function eyeDistance(landmarks) {
  return dist(landmarks[LEFT_EYE], landmarks[RIGHT_EYE]);
}

// Yaw signal: nose position relative to the eye-midpoint, projected onto the
// eye-to-eye axis, normalized by eye distance. A frontal face has the nose
// roughly centered between the eyes; turning the head shifts the nose
// toward one side in image space.
function yawSignal(landmarks) {
  const [lx, ly] = landmarks[LEFT_EYE];
  const [rx, ry] = landmarks[RIGHT_EYE];
  const [nx, ny] = landmarks[NOSE];
  const eyeDist = dist([lx, ly], [rx, ry]);
  if (eyeDist === 0) return 0;

  const midX = (lx + rx) / 2;
  const midY = (ly + ry) / 2;
  const eyeVecX = rx - lx;
  const eyeVecY = ry - ly;
  const noseVecX = nx - midX;
  const noseVecY = ny - midY;

  const projection = (noseVecX * eyeVecX + noseVecY * eyeVecY) / eyeDist;
  return projection / eyeDist;
}

function mouthWidth(landmarks) {
  return dist(landmarks[LEFT_MOUTH], landmarks[RIGHT_MOUTH]);
}

const YAW_DELTA_THRESHOLD = 0.08;
const SMILE_RATIO_THRESHOLD = 1.12;

// verify(challengeId, baselineLandmarks, challengeLandmarks) -> { passed, signal, delta }
function verify(challengeId, baselineLandmarks, challengeLandmarks) {
  if (!baselineLandmarks || !challengeLandmarks) {
    return { passed: false, signal: null, delta: null };
  }

  switch (challengeId) {
    case 'turn_left':
    case 'turn_right': {
      const baselineYaw = yawSignal(baselineLandmarks);
      const challengeYaw = yawSignal(challengeLandmarks);
      const delta = challengeYaw - baselineYaw;
      const expectedSign = challengeId === 'turn_left' ? -1 : 1;
      const passed = delta * expectedSign > YAW_DELTA_THRESHOLD;
      return { passed, signal: challengeYaw, delta };
    }

    case 'smile': {
      const baselineEyeDist = eyeDistance(baselineLandmarks);
      const challengeEyeDist = eyeDistance(challengeLandmarks);
      if (baselineEyeDist === 0 || challengeEyeDist === 0) {
        return { passed: false, signal: null, delta: null };
      }
      const baselineRatio = mouthWidth(baselineLandmarks) / baselineEyeDist;
      const challengeRatio = mouthWidth(challengeLandmarks) / challengeEyeDist;
      const delta = challengeRatio / baselineRatio;
      const passed = delta > SMILE_RATIO_THRESHOLD;
      return { passed, signal: challengeRatio, delta };
    }

    default:
      return { passed: false, signal: null, delta: null };
  }
}

module.exports = { verify, SUPPORTED_CHALLENGES: ['turn_left', 'turn_right', 'smile'] };
