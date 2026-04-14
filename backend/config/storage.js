// config/storage.js
// Sevalla Object Storage (S3-compatible) configuration and helpers

const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const sharp = require('sharp');
const path = require('path');
const crypto = require('crypto');

const endpoint = process.env.STORAGE_ENDPOINT;
const region = process.env.STORAGE_REGION;
const bucket = process.env.STORAGE_BUCKET;
const accessKeyId = process.env.STORAGE_ACCESS_KEY;
const secretAccessKey = process.env.STORAGE_SECRET_KEY;
const publicBaseUrl = (process.env.STORAGE_PUBLIC_URL || '').replace(/\/$/, '');

if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
  throw new Error('Missing STORAGE_* environment variables for object storage');
}

const s3 = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey },
});

const sanitizeFilename = (name = 'file') => name.replace(/[^a-zA-Z0-9._-]/g, '_');

const buildObjectKey = (folder = 'uploads', filename = 'file') => {
  const ext = path.extname(filename) || '';
  const base = path.basename(filename, ext);
  const safeBase = sanitizeFilename(base).slice(0, 60);
  const random = crypto.randomBytes(6).toString('hex');
  const now = Date.now();
  const normalizedFolder = folder.replace(/^\/+|\/+$/g, '');
  return `${normalizedFolder}/${safeBase}-${now}-${random}${ext}`;
};

const toPublicUrl = (key) => `${publicBaseUrl}/${key}`;

const parseInputToBuffer = (input) => {
  if (Buffer.isBuffer(input)) {
    return { buffer: input, mimeType: 'application/octet-stream', extension: '' };
  }

  if (typeof input !== 'string') {
    throw new Error('Unsupported input format for uploadImage');
  }

  if (input.startsWith('data:')) {
    const matches = input.match(/^data:(.*?);base64,(.*)$/);
    if (!matches) throw new Error('Invalid data URI format');
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    const extension = mimeType.split('/')[1] ? `.${mimeType.split('/')[1]}` : '';
    return { buffer, mimeType, extension };
  }

  const fs = require('fs');
  const fileBuffer = fs.readFileSync(input);
  const extension = path.extname(input);
  return { buffer: fileBuffer, mimeType: 'application/octet-stream', extension };
};

const maybeTransform = async (buffer, options = {}) => {
  if (!options || (!options.width && !options.height && !options.format)) {
    return { body: buffer, contentType: undefined, finalExt: '' };
  }

  const image = sharp(buffer);
  if (options.width || options.height) {
    image.resize({ width: options.width, height: options.height, fit: options.fit || 'cover' });
  }

  let contentType;
  let finalExt = '';
  if (options.format) {
    const fmt = options.format.toLowerCase();
    if (fmt === 'jpeg' || fmt === 'jpg') {
      image.jpeg({ quality: options.quality || 85 });
      contentType = 'image/jpeg';
      finalExt = '.jpg';
    } else if (fmt === 'png') {
      image.png({ quality: options.quality || 90 });
      contentType = 'image/png';
      finalExt = '.png';
    } else if (fmt === 'webp') {
      image.webp({ quality: options.quality || 85 });
      contentType = 'image/webp';
      finalExt = '.webp';
    }
  }

  return { body: await image.toBuffer(), contentType, finalExt };
};

const uploadImage = async (imageInput, folder = 'shopyos', options = {}) => {
  const { buffer, mimeType, extension } = parseInputToBuffer(imageInput);
  const transformed = await maybeTransform(buffer, options);
  const ext = transformed.finalExt || extension || '';
  const key = buildObjectKey(folder, `upload${ext}`);

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: transformed.body,
    ContentType: transformed.contentType || mimeType,
  }));

  return {
    url: key,
    public_url: toPublicUrl(key),
    public_id: key,
    format: (ext || extension).replace('.', '') || undefined,
    bytes: transformed.body.length,
  };
};

const uploadMultipleImages = async (imageInputs, folder = 'shopyos') => {
  const uploads = imageInputs.map((input) => uploadImage(input, folder));
  return Promise.all(uploads);
};

const deleteImage = async (keyOrUrl) => {
  const key = extractObjectKey(keyOrUrl);
  if (!key) return { result: 'not_found' };

  await s3.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  }));

  return { result: 'ok', key };
};

const deleteMultipleImages = async (keysOrUrls = []) => {
  return Promise.all(keysOrUrls.map((item) => deleteImage(item)));
};

const getOptimizedUrl = (keyOrUrl) => {
  const key = extractObjectKey(keyOrUrl);
  return key ? toPublicUrl(key) : null;
};

const getThumbnailUrl = (keyOrUrl) => {
  const key = extractObjectKey(keyOrUrl);
  return key ? toPublicUrl(key) : null;
};

const getPresignedUploadUrl = async ({ keyPrefix = 'uploads', filename = 'file.bin', contentType = 'application/octet-stream', expiresIn = 900 } = {}) => {
  const key = buildObjectKey(keyPrefix, filename);
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3, command, { expiresIn });
  return { key, url, publicUrl: toPublicUrl(key), expiresIn };
};

const extractObjectKey = (keyOrUrl) => {
  if (!keyOrUrl) return null;
  if (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')) {
    return keyOrUrl.replace(`${publicBaseUrl}/`, '');
  }
  return keyOrUrl;
};

const testConnection = async () => {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log('✅ Object storage connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Object storage connection failed:', error.message);
    return false;
  }
};

module.exports = {
  s3,
  uploadImage,
  uploadMultipleImages,
  deleteImage,
  deleteMultipleImages,
  getOptimizedUrl,
  getThumbnailUrl,
  getPresignedUploadUrl,
  extractObjectKey,
  toPublicUrl,
  testConnection,
};
