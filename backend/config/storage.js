// config/storage.js
// Sevalla Object Storage (S3-compatible) configuration and helpers

const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const sharp = require('sharp');
const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { LRUCache } = require('lru-cache');
const { envInt } = require('./envConfig');

const endpoint = (process.env.STORAGE_ENDPOINT || '').trim();
const region = (process.env.STORAGE_REGION || '').trim();
const bucket = (process.env.STORAGE_BUCKET || '').trim();
const accessKeyId = (process.env.STORAGE_ACCESS_KEY || '').trim();
const secretAccessKey = (process.env.STORAGE_SECRET_KEY || '').trim();
const publicBaseUrl = (process.env.STORAGE_PUBLIC_URL || '').trim().replace(/\/$/, '');

if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
  throw new Error('Missing STORAGE_* environment variables for object storage');
}

const s3 = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey },
});

// ── Presigned URL cache ───────────────────────────────────────────────────────
// In-memory cache: key → { url, expiresAt }. 6-day cache TTL gives a 1-day
// buffer before the 7-day (604800s) presigned URL itself expires.
const PRESIGN_TTL_S = envInt('PRESIGN_URL_TTL_SECONDS', 7 * 24 * 60 * 60);  // default 604800s
const CACHE_TTL_MS  = envInt('PRESIGN_CACHE_TTL_MS', 6 * 24 * 60 * 60 * 1000); // default 518400000ms

// Bounded LRU cache prevents unbounded memory growth
const _urlCache = new LRUCache({
  max: envInt('PRESIGN_CACHE_MAX_SIZE', 10000),
  ttl: CACHE_TTL_MS,
  updateAgeOnGet: true,
});

function _getCached(key) {
  return _urlCache.get(key) || null;
}

function _setCached(key, url) {
  _urlCache.set(key, url);
}

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

const toPublicUrl = (key) => {
  if (!key) return null;
  if (key.startsWith('http://') || key.startsWith('https://')) return key;
  return `${publicBaseUrl}/${key.replace(/^\/+/, '')}`;
};

const parseInputToBuffer = (input) => {
  if (input && typeof input === 'object' && Buffer.isBuffer(input.buffer)) {
    const ext = path.extname(input.originalname || '') || '';
    return { 
      buffer: input.buffer, 
      mimeType: input.mimetype || 'application/octet-stream', 
      extension: ext 
    };
  }

  if (Buffer.isBuffer(input)) {
    return { buffer: input, mimeType: 'application/octet-stream', extension: '' };
  }

  if (typeof input !== 'string') {
    throw new TypeError('Unsupported input format for uploadImage');
  }

  if (input.startsWith('data:')) {
    const matches = /^data:(.*?);base64,(.*)$/.exec(input);
    if (!matches) throw new Error('Invalid data URI format');
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    const extension = mimeType.split('/')[1] ? `.${mimeType.split('/')[1]}` : '';
    return { buffer, mimeType, extension };
  }

  const allowedBase = path.resolve(process.env.UPLOAD_TEMP_DIR || '/tmp');
  const resolvedPath = path.resolve(input);
  if (!resolvedPath.startsWith(allowedBase + path.sep) && resolvedPath !== allowedBase) {
    throw new TypeError('File path outside allowed directory');
  }
  const fileBuffer = fs.readFileSync(resolvedPath);
  const extension = path.extname(resolvedPath);
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
      image.jpeg({ quality: options.quality || envInt('IMAGE_QUALITY_JPEG', 85) });
      contentType = 'image/jpeg';
      finalExt = '.jpg';
    } else if (fmt === 'png') {
      image.png({ quality: options.quality || envInt('IMAGE_QUALITY_PNG', 90) });
      contentType = 'image/png';
      finalExt = '.png';
    } else if (fmt === 'webp') {
      image.webp({ quality: options.quality || envInt('IMAGE_QUALITY_WEBP', 85) });
      contentType = 'image/webp';
      finalExt = '.webp';
    }
  }

  return { body: await image.toBuffer(), contentType, finalExt };
};

// Generate a presigned GET URL valid for PRESIGN_TTL_S seconds.
const getPresignedReadUrl = async (key, ttl = PRESIGN_TTL_S) => {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3, command, { expiresIn: ttl });
};

// Resolve a stored key (or full URL) to a presigned URL, with in-memory caching.
// External URLs (Unsplash, CDNs, etc.) that don't belong to this storage bucket
// pass through as-is — presigning them would produce a broken localhost MinIO URL.
const resolveImageUrl = async (keyOrUrl) => {
  if (!keyOrUrl) return null;

  // Return external URLs directly — only sign keys that belong to our bucket
  if (
    (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')) &&
    !keyOrUrl.startsWith(publicBaseUrl)
  ) {
    return keyOrUrl;
  }

  const key = extractObjectKey(keyOrUrl);
  if (!key) return null;

  const cached = _getCached(key);
  if (cached) return cached;

  const url = await getPresignedReadUrl(key);
  _setCached(key, url);
  return url;
};

/**
 * Batch resolve multiple image URLs in one call.
 * Each URL is checked against the LRU cache first; uncached keys are fetched
 * together, avoiding N consecutive S3 round-trips in list endpoints.
 */
const resolveImageUrls = async (keyOrUrls) => {
  if (!Array.isArray(keyOrUrls)) return [];
  if (keyOrUrls.length === 0) return [];

  const results = [];
  const uncached = [];
  const uncachedIdx = [];

  // Phase 1: Check cache for each URL
  for (let i = 0; i < keyOrUrls.length; i++) {
    const keyOrUrl = keyOrUrls[i];
    if (!keyOrUrl) {
      results.push(null);
      continue;
    }

    // External URLs pass through
    if (
      (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')) &&
      !keyOrUrl.startsWith(publicBaseUrl)
    ) {
      results.push(keyOrUrl);
      continue;
    }

    const key = extractObjectKey(keyOrUrl);
    if (!key) {
      results.push(null);
      continue;
    }

    const cached = _getCached(key);
    if (cached) {
      results.push(cached);
    } else {
      results.push(null); // placeholder
      uncached.push(key);
      uncachedIdx.push(i);
    }
  }

  // Phase 2: Batch fetch all uncached URLs
  if (uncached.length > 0) {
    const batchResults = await Promise.all(
      uncached.map(key => getPresignedReadUrl(key))
    );

    for (let j = 0; j < batchResults.length; j++) {
      const idx = uncachedIdx[j];
      const key = uncached[j];
      const url = batchResults[j];
      results[idx] = url;
      _setCached(key, url);
    }
  }

  return results;
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

  const presignedUrl = await resolveImageUrl(key);
  return {
    url: key,
    public_url: presignedUrl,
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

// Fields that hold storage keys — transformed recursively on any nested object
const IMAGE_FIELDS = new Set([
  'avatar_url', 'logo_url', 'banner_url', 'image_url', 'attachment_url',
  'license_image_url', 'national_id_url', 'insurance_doc_url',
  'vehicle_reg_url', 'roadworthy_url', 'business_cert_url',
  'business_license_url', 'proof_of_bank_url',
]);

const transformImageUrls = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(transformImageUrls);
  const out = {};
  for (const [key, val] of Object.entries(obj)) {
    if (IMAGE_FIELDS.has(key) && typeof val === 'string') {
      out[key] = toPublicUrl(val);
    } else if (val && typeof val === 'object' && !(val instanceof Date)) {
      out[key] = transformImageUrls(val);
    } else {
      out[key] = val;
    }
  }
  return out;
};

// Async version of transformImageUrls — replaces keys with 7-day presigned URLs.
// Repositories call this so controllers need no changes.
const transformImageUrlsAsync = async (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return Promise.all(obj.map(transformImageUrlsAsync));
  const out = {};
  for (const [key, val] of Object.entries(obj)) {
    if (IMAGE_FIELDS.has(key) && typeof val === 'string') {
      out[key] = await resolveImageUrl(val);
    } else if (val && typeof val === 'object' && !(val instanceof Date)) {
      out[key] = await transformImageUrlsAsync(val);
    } else {
      out[key] = val;
    }
  }
  return out;
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
  getPresignedReadUrl,
  resolveImageUrl,
  resolveImageUrls,
  extractObjectKey,
  toPublicUrl,
  transformImageUrls,
  transformImageUrlsAsync,
  testConnection,
};
