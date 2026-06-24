// utils/videoProcessor.js
// Re-encodes video uploads to H.264/AAC MP4 with faststart for instant mobile playback.

const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const { logger } = require('../config/logger');

let ffmpeg = null;
try {
  ffmpeg = require('fluent-ffmpeg');
  const { path: ffmpegBin } = require('@ffmpeg-installer/ffmpeg');
  ffmpeg.setFfmpegPath(ffmpegBin);
} catch {
  logger.warn('fluent-ffmpeg / @ffmpeg-installer not found — video transcoding disabled');
}

const VIDEO_MIMETYPES = new Set([
  'video/mp4', 'video/quicktime', 'video/x-msvideo',
  'video/webm', 'video/x-matroska', 'video/3gpp',
]);

const isVideoMimetype = (mimetype) => VIDEO_MIMETYPES.has(mimetype);

const inputExtForMimetype = (mimetype) => {
  if (mimetype === 'video/quicktime') return '.mov';
  if (mimetype === 'video/webm') return '.webm';
  if (mimetype === 'video/x-matroska') return '.mkv';
  if (mimetype === 'video/x-msvideo') return '.avi';
  if (mimetype === 'video/3gpp') return '.3gp';
  return '.mp4';
};

/**
 * Re-encodes a video buffer:
 *   - H.264 video, AAC audio
 *   - Capped at 720p (keeps aspect ratio)
 *   - -movflags +faststart: moov atom at the front so playback starts immediately
 *   - -pix_fmt yuv420p: required for iOS/Android compatibility
 *
 * Falls back to the original buffer if FFmpeg is unavailable or errors.
 */
const processVideoBuffer = async (inputBuffer, originalMimetype) => {
  if (!ffmpeg) {
    return { buffer: inputBuffer, mimetype: originalMimetype };
  }

  const id = crypto.randomBytes(8).toString('hex');
  const inputPath = path.join(os.tmpdir(), `vid_in_${id}${inputExtForMimetype(originalMimetype)}`);
  const outputPath = path.join(os.tmpdir(), `vid_out_${id}.mp4`);

  try {
    await fs.writeFile(inputPath, inputBuffer);

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-c:v libx264',
          '-preset fast',
          '-crf 26',
          '-vf scale=-2:720',
          '-c:a aac',
          '-b:a 128k',
          '-movflags +faststart',
          '-pix_fmt yuv420p',
          '-max_muxing_queue_size 1024',
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', (err) => reject(new Error(`FFmpeg: ${err.message}`)))
        .run();
    });

    const outputBuffer = await fs.readFile(outputPath);
    logger.info(`Video processed: ${Math.round(inputBuffer.length / 1024)}KB → ${Math.round(outputBuffer.length / 1024)}KB`);
    return { buffer: outputBuffer, mimetype: 'video/mp4' };
  } catch (err) {
    logger.error('Video processing failed, uploading original:', err.message);
    return { buffer: inputBuffer, mimetype: originalMimetype };
  } finally {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
};

module.exports = { isVideoMimetype, processVideoBuffer };
