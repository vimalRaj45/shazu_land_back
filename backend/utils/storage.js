const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const bucket = process.env.S3_BUCKET_NAME || 'assets';

function getS3Client() {
  const endpoint = process.env.AWS_ENDPOINT_URL_S3 || process.env.S3_ENDPOINT;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || 'us-east-1';

  if (!endpoint && !accessKeyId) {
    // Client without explicit credentials (will use environment or throw gracefully if unconfigured)
    return new S3Client({
      forcePathStyle: true,
      region: region
    });
  }

  return new S3Client({
    forcePathStyle: true,
    region: region,
    endpoint: endpoint,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey
    }
  });
}

const s3 = getS3Client();

function isStorageConfigured() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;
  return Boolean(accessKeyId && secretAccessKey);
}

/**
 * Upload a raw buffer or string to Neon Object Storage
 */
async function uploadObject({ key, body, contentType = 'application/octet-stream' }) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType
  });
  await s3.send(command);
  return { key, bucket };
}

/**
 * Upload a Base64 image string (e.g. data:image/png;base64,...) to Neon Object Storage
 */
async function uploadBase64Image(base64Data, folder = 'uploads') {
  if (!base64Data || typeof base64Data !== 'string') return null;

  let mimeType = 'image/jpeg';
  let cleanBase64 = base64Data;

  const match = base64Data.match(/^data:([a-zA-Z0-9\-_.]+\/[a-zA-Z0-9\-_.+]+);base64,(.+)$/s);
  if (match) {
    mimeType = match[1];
    cleanBase64 = match[2];
  }

  let ext = 'jpg';
  if (mimeType.includes('pdf')) ext = 'pdf';
  else if (mimeType.includes('png')) ext = 'png';
  else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
  else if (mimeType.includes('webp')) ext = 'webp';
  else if (mimeType.includes('svg')) ext = 'svg';
  else if (mimeType.split('/')[1]) ext = mimeType.split('/')[1].replace(/[^a-z0-9]/gi, '') || 'jpg';

  const fileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  const key = `${folder}/${fileName}`;

  const buffer = Buffer.from(cleanBase64, 'base64');

  await uploadObject({
    key: key,
    body: buffer,
    contentType: mimeType
  });

  return { key, fileName, mimeType, bucket };
}

/**
 * Generate a presigned GET URL for viewing an object
 */
async function getPresignedViewUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key
  });
  return await getSignedUrl(s3, command, { expiresIn });
}

/**
 * Generate permanent public URL for an object
 */
function getPublicUrl(key) {
  const endpoint = (process.env.AWS_ENDPOINT_URL_S3 || process.env.S3_ENDPOINT || 'https://br-icy-fog-a5v4s3ch.storage.c-1.us-east-2.aws.neon.tech').replace(/\/+$/, '');
  return `${endpoint}/${bucket}/${key.replace(/^\/+/, '')}`;
}

/**
 * Automatically uploads a Base64 string to Neon Object Storage if S3 is configured,
 * returning the permanent public URL. If already a URL or unconfigured, returns unchanged.
 */
async function ensureStorageUrl(val, folder = 'uploads') {
  if (!val || typeof val !== 'string') return val;
  if (!val.startsWith('data:image/') && !val.startsWith('data:application/')) {
    return val;
  }
  if (!isStorageConfigured()) {
    return val;
  }
  try {
    const res = await uploadBase64Image(val, folder);
    if (res && res.key) {
      return getPublicUrl(res.key);
    }
  } catch (err) {
    console.warn(`[storage] Failed to upload to ${folder}, keeping fallback:`, err.message);
  }
  return val;
}

module.exports = {
  s3,
  bucket,
  isStorageConfigured,
  uploadObject,
  uploadBase64Image,
  getPublicUrl,
  getPresignedViewUrl,
  ensureStorageUrl
};
