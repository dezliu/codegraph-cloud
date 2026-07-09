/**
 * Optional S3/MinIO persistence for SQLite index files.
 *
 * Enabled when S3_BUCKET is set. Supports AWS S3 and MinIO via S3_ENDPOINT.
 */

import * as fs from 'fs';
import * as path from 'path';

function isS3Enabled(): boolean {
  return Boolean(process.env.S3_BUCKET);
}

function indexObjectKey(projectId: string): string {
  return `indexes/${projectId}/codegraph.db`;
}

async function getS3Client() {
  const { S3Client, PutObjectCommand, GetObjectCommand } = await import('@aws-sdk/client-s3');

  const client = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: process.env.S3_ACCESS_KEY
      ? {
          accessKeyId: process.env.S3_ACCESS_KEY,
          secretAccessKey: process.env.S3_SECRET_KEY || '',
        }
      : undefined,
  });

  return { client, PutObjectCommand, GetObjectCommand };
}

export function indexDbPath(projectRoot: string): string {
  return path.join(projectRoot, '.codegraph', 'codegraph.db');
}

export async function uploadIndexDb(projectId: string, projectRoot: string): Promise<void> {
  if (!isS3Enabled()) return;

  const dbPath = indexDbPath(projectRoot);
  if (!fs.existsSync(dbPath)) return;

  const bucket = process.env.S3_BUCKET!;
  const { client, PutObjectCommand } = await getS3Client();
  const body = fs.readFileSync(dbPath);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: indexObjectKey(projectId),
      Body: body,
      ContentType: 'application/octet-stream',
    }),
  );

  console.log(`[Storage] Uploaded index for ${projectId} to s3://${bucket}/${indexObjectKey(projectId)}`);
}

export async function downloadIndexDb(projectId: string, projectRoot: string): Promise<boolean> {
  if (!isS3Enabled()) return false;

  const dbPath = indexDbPath(projectRoot);
  if (fs.existsSync(dbPath)) return false;

  const bucket = process.env.S3_BUCKET!;
  const { client, GetObjectCommand } = await getS3Client();

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: indexObjectKey(projectId),
      }),
    );

    if (!response.Body) return false;

    const bytes = await response.Body.transformToByteArray();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, Buffer.from(bytes));
    console.log(`[Storage] Downloaded index for ${projectId} from S3`);
    return true;
  } catch (err: unknown) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) {
      return false;
    }
    console.error(`[Storage] Failed to download index for ${projectId}:`, err);
    return false;
  }
}

export async function ensureLocalIndexDb(projectId: string, projectRoot: string): Promise<void> {
  const dbPath = indexDbPath(projectRoot);
  if (fs.existsSync(dbPath)) return;
  await downloadIndexDb(projectId, projectRoot);
}
