const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  // Fix requis pour Cloudflare R2 avec AWS SDK v3 récent :
  // le SDK calcule des checksums que R2 ne supporte pas par défaut
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

const BUCKET = process.env.R2_BUCKET || 'ourspacemedia';

async function upload(key, buffer, contentType) {
  await client.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: contentType,
  }));
  return `/api/media/${key}`;
}

async function remove(key) {
  try {
    await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (e) { /* ignore if already gone */ }
}

async function getObject(key) {
  return client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
}

module.exports = { upload, remove, getObject };
