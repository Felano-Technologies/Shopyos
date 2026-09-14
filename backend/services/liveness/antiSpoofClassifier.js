// services/liveness/antiSpoofClassifier.js
// Binary real/spoof classification via antispoof.onnx (MiniFASNet-class model
// from hairymax/Face-AntiSpoofing). Model I/O verified directly by real
// inference: input 'input' [1,3,128,128], output 'output' [1,2] raw logits
// (NOT softmaxed by the model itself).
//
// Preprocessing/postprocessing/class semantics are ported directly from the
// repo's own src/FaceAntiSpoofing.py (increased_crop, AntiSpoof.preprocessing,
// AntiSpoof.postprocessing) and video_predict.py's make_prediction(), not
// guessed — in particular the class-index meaning (label==0 -> real,
// label==1 -> fake) and the lack of any mean-subtraction/BGR swap are both
// easy to get backwards silently.

const path = require('path');
const sharp = require('sharp');
const { logger } = require('../../config/logger');

// See yoloFaceDetector.js's identical comment — onnxruntime-node's require
// can throw on a bad native build (e.g. a musl/Alpine image without glibc);
// this sits on the server's startup require-chain, so guard it here too so
// that failure degrades liveness analysis instead of crashing the backend.
let ort = null;
try {
  ort = require('onnxruntime-node');
} catch (error) {
  logger.error('onnxruntime-node failed to load — anti-spoof classification disabled, liveness will fall back to manual admin review', { error: error.message });
}

const MODEL_PATH = path.join(__dirname, '..', '..', 'ml-models', 'antispoof.onnx');
const CROP_SIZE = 128;
const BBOX_INCREASE = 1.5;

let sessionPromise = null;
function getSession() {
  if (!ort) return Promise.resolve(null);
  if (!sessionPromise) sessionPromise = ort.InferenceSession.create(MODEL_PATH);
  return sessionPromise;
}

// increased_crop(): crop a square region centered on the bbox with side =
// max(w,h)*bbox_inc, clipped to image bounds then zero-padded back to a full
// square if the crop extended past the image edges. Ported from
// FaceAntiSpoofing.py's increased_crop() exactly.
async function increasedCrop(imageBuffer, bbox, imgW, imgH) {
  const [x1, y1, x2, y2] = bbox;
  const w = x2 - x1;
  const h = y2 - y1;
  const cx = x1 + w / 2;
  const cy = y1 + h / 2;
  const side = Math.round(Math.max(w, h) * BBOX_INCREASE);

  let cropX1 = Math.round(cx - side / 2);
  let cropY1 = Math.round(cy - side / 2);
  let cropX2 = cropX1 + side;
  let cropY2 = cropY1 + side;

  const extractX1 = Math.max(0, cropX1);
  const extractY1 = Math.max(0, cropY1);
  const extractX2 = Math.min(imgW, cropX2);
  const extractY2 = Math.min(imgH, cropY2);
  const extractW = extractX2 - extractX1;
  const extractH = extractY2 - extractY1;

  if (extractW <= 0 || extractH <= 0) return null;

  const extracted = await sharp(imageBuffer)
    .extract({ left: extractX1, top: extractY1, width: extractW, height: extractH })
    .toBuffer();

  const padLeft = extractX1 - cropX1;
  const padTop = extractY1 - cropY1;
  const padRight = cropX2 - extractX2;
  const padBottom = cropY2 - extractY2;

  if (padLeft === 0 && padTop === 0 && padRight === 0 && padBottom === 0) {
    return extracted;
  }

  return sharp(extracted)
    .extend({
      top: Math.max(0, padTop),
      bottom: Math.max(0, padBottom),
      left: Math.max(0, padLeft),
      right: Math.max(0, padRight),
      background: { r: 0, g: 0, b: 0 },
    })
    .toBuffer();
}

// AntiSpoof.preprocessing(): resize (no aspect-preserve — direct 128x128
// resize, since the crop is already square), CHW float32, /255 (no mean
// subtraction), NO BGR<->RGB swap (fed as-is per the reference).
async function preprocess(cropBuffer) {
  const { data } = await sharp(cropBuffer)
    .resize(CROP_SIZE, CROP_SIZE)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const size = CROP_SIZE * CROP_SIZE;
  const chw = new Float32Array(3 * size);
  for (let i = 0; i < size; i++) {
    chw[i] = data[i * 3] / 255;
    chw[size + i] = data[i * 3 + 1] / 255;
    chw[2 * size + i] = data[i * 3 + 2] / 255;
  }
  return chw;
}

function softmax([a, b]) {
  const max = Math.max(a, b);
  const expA = Math.exp(a - max);
  const expB = Math.exp(b - max);
  const sum = expA + expB;
  return [expA / sum, expB / sum];
}

// Returns { isReal, realScore } for one face crop, or null on failure.
// Class semantics confirmed from video_predict.py's make_prediction():
// label = argmax(pred); label === 0 means "real".
async function classify(imageBuffer, bbox, imgW, imgH) {
  try {
    const cropBuffer = await increasedCrop(imageBuffer, bbox, imgW, imgH);
    if (!cropBuffer) return null;

    const session = await getSession();
    if (!session) return null;
    const chw = await preprocess(cropBuffer);
    const tensor = new ort.Tensor('float32', chw, [1, 3, CROP_SIZE, CROP_SIZE]);

    const results = await session.run({ [session.inputNames[0]]: tensor });
    const output = results['output'];
    const [realScore, fakeScore] = softmax([output.data[0], output.data[1]]);

    return { isReal: realScore > fakeScore, realScore };
  } catch (error) {
    logger.error('antiSpoofClassifier.classify failed', { error: error.message });
    return null;
  }
}

module.exports = { classify };
