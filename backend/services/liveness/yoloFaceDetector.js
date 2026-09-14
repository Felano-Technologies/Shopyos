// services/liveness/yoloFaceDetector.js
// Face + 5-point-landmark detection via yolov5s-face.onnx (ml-models/), run
// through onnxruntime-node — confirmed working with zero native compilation
// on both Windows (this dev machine) and expected on Railway's Linux build.
//
// Model I/O verified directly (not assumed) by loading the real file and
// inspecting session.outputNames/dims:
//   input:  'input'  [1, 3, 640, 640]  (RGB, CHW, /255, letterboxed)
//   output: 'output' [1, 25200, 16]    per anchor: [cx,cy,w,h, obj_conf,
//            lm1x,lm1y,lm2x,lm2y,lm3x,lm3y,lm4x,lm4y,lm5x,lm5y, cls_conf]
// This is the standard deepcam-cn/yolov5-face export shape (5 landmarks:
// left eye, right eye, nose, left mouth corner, right mouth corner).
//
// Preprocessing/decoding (letterbox, xywh2xyxy, greedy NMS, scale_coords) is
// ported directly from this model's own reference implementation
// (hairymax/Face-AntiSpoofing's src/face_detector/{YOLO,utils}.py) rather
// than guessed, since subtly-wrong decode math would silently produce
// plausible-looking but wrong boxes.

const path = require('path');
const ort = require('onnxruntime-node');
const sharp = require('sharp');
const { logger } = require('../../config/logger');

const MODEL_PATH = path.join(__dirname, '..', '..', 'ml-models', 'yolov5s-face.onnx');
const INPUT_SIZE = 640;
const CONF_THRESHOLD = 0.4;
const IOU_THRESHOLD = 0.45;

let sessionPromise = null;
function getSession() {
  if (!sessionPromise) sessionPromise = ort.InferenceSession.create(MODEL_PATH);
  return sessionPromise;
}

// Letterbox: resize preserving aspect ratio into INPUT_SIZE x INPUT_SIZE,
// padded with gray (114,114,114) — matches letterbox() in utils.py exactly
// (auto=false, scaleFill=false, scaleup=true).
async function letterbox(imageBuffer) {
  const meta = await sharp(imageBuffer).metadata();
  const { width: origW, height: origH } = meta;

  const gain = Math.min(INPUT_SIZE / origH, INPUT_SIZE / origW);
  const newUnpadW = Math.round(origW * gain);
  const newUnpadH = Math.round(origH * gain);
  const dw = (INPUT_SIZE - newUnpadW) / 2;
  const dh = (INPUT_SIZE - newUnpadH) / 2;
  const top = Math.round(dh - 0.1);
  const bottom = Math.round(dh + 0.1);
  const left = Math.round(dw - 0.1);
  const right = Math.round(dw + 0.1);

  const { data, info } = await sharp(imageBuffer)
    .resize(newUnpadW, newUnpadH)
    .extend({ top, bottom, left, right, background: { r: 114, g: 114, b: 114 } })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { data, width: info.width, height: info.height, gain, padX: left, padY: top, origW, origH };
}

// Interleaved HWC RGB Uint8 -> planar CHW Float32, /255 (matches YOLO.py's preprocessing).
function toChwTensor(hwcData, width, height) {
  const size = width * height;
  const chw = new Float32Array(3 * size);
  for (let i = 0; i < size; i++) {
    chw[i] = hwcData[i * 3] / 255;               // R plane
    chw[size + i] = hwcData[i * 3 + 1] / 255;     // G plane
    chw[2 * size + i] = hwcData[i * 3 + 2] / 255; // B plane
  }
  return chw;
}

function iou(a, b) {
  const x1 = Math.max(a[0], b[0]);
  const y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[2], b[2]);
  const y2 = Math.min(a[3], b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = (a[2] - a[0]) * (a[3] - a[1]);
  const areaB = (b[2] - b[0]) * (b[3] - b[1]);
  return inter / (areaA + areaB - inter);
}

// Greedy NMS — direct port of nms()/compute_iou() in utils.py.
function greedyNms(detections, iouThreshold) {
  const sorted = [...detections].sort((a, b) => b.conf - a.conf);
  const kept = [];
  while (sorted.length) {
    const best = sorted.shift();
    kept.push(best);
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (iou(best.box, sorted[i].box) > iouThreshold) sorted.splice(i, 1);
    }
  }
  return kept;
}

// Decode the raw [25200,16] output into detections in LETTERBOXED (640x640)
// pixel space — xywh2xyxy + confidence filtering, mirroring
// non_max_suppression()'s single-class path in utils.py.
function decode(outputData, numAnchors, numCols) {
  const detections = [];
  for (let i = 0; i < numAnchors; i++) {
    const base = i * numCols;
    const objConf = outputData[base + 4];
    const clsConf = outputData[base + numCols - 1];
    const conf = objConf * clsConf;
    if (conf <= CONF_THRESHOLD) continue;

    const cx = outputData[base];
    const cy = outputData[base + 1];
    const w = outputData[base + 2];
    const h = outputData[base + 3];
    const box = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];

    const landmarks = [];
    for (let l = 0; l < 5; l++) {
      landmarks.push([outputData[base + 5 + l * 2], outputData[base + 5 + l * 2 + 1]]);
    }

    detections.push({ box, conf, landmarks });
  }
  return greedyNms(detections, IOU_THRESHOLD);
}

// scale_coords(): un-letterbox a point/box back to the original image's
// pixel space — subtract pad, then divide by gain (order matters).
function unletterboxPoint([x, y], meta) {
  return [(x - meta.padX) / meta.gain, (y - meta.padY) / meta.gain];
}

function unletterboxBox(box, meta) {
  const [x1, y1] = unletterboxPoint([box[0], box[1]], meta);
  const [x2, y2] = unletterboxPoint([box[2], box[3]], meta);
  return [
    Math.max(0, x1), Math.max(0, y1),
    Math.min(meta.origW, x2), Math.min(meta.origH, y2),
  ];
}

// Returns the single highest-confidence face: { box: [x1,y1,x2,y2],
// landmarks: [[x,y] x5] (leftEye, rightEye, nose, leftMouth, rightMouth),
// confidence } in ORIGINAL image pixel coordinates, or null if no face found.
async function detectFace(imageBuffer) {
  try {
    const session = await getSession();
    const meta = await letterbox(imageBuffer);
    const chw = toChwTensor(meta.data, meta.width, meta.height);
    const tensor = new ort.Tensor('float32', chw, [1, 3, meta.height, meta.width]);

    const results = await session.run({ [session.inputNames[0]]: tensor });
    const output = results['output'];
    const [, numAnchors, numCols] = output.dims;
    const detections = decode(output.data, numAnchors, numCols);
    if (!detections.length) return null;

    const best = detections[0];
    return {
      box: unletterboxBox(best.box, meta),
      landmarks: best.landmarks.map((pt) => unletterboxPoint(pt, meta)),
      confidence: best.conf,
    };
  } catch (error) {
    logger.error('yoloFaceDetector.detectFace failed', { error: error.message });
    return null;
  }
}

module.exports = { detectFace };
