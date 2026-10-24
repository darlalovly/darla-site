// @ts-nocheck
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt < retries) {
        console.warn(`[RETRY ${attempt}/${retries}] Temporary error: ${err.message}. Retrying in ${delay}ms...`);
        await wait(delay * attempt);
      }
    }
  }
  throw lastError;
}

async function main() {
  const nodeFs: any = await import(('node:' + 'fs') as any);
  const nodeFsp: any = await import(('node:' + 'fs/promises') as any);
  const nodePath: any = await import(('node:' + 'path') as any);

  const globalProc: any = (globalThis as any).process;
  const env: Record<string, string | undefined> = globalProc?.env || {};

  if (nodeFs.existsSync('.env')) {
    const envContent: string = nodeFs.readFileSync('.env', 'utf-8');
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!env[key]) {
          env[key] = val;
        }
      }
    }
  }

  const DRY_RUN = false;

  let rawAccountId = (env.R2_ACCOUNT_ID || 'de1abb3acceaa3e884d861d4eb660687').trim().replace(/['"]/g, '');
  if (rawAccountId.includes('acceeda')) {
    rawAccountId = rawAccountId.replace('acceeda', 'acceaa');
  }
  const ACCOUNT_ID = rawAccountId;

  const ACCESS_KEY_ID = (env.R2_ACCESS_KEY_ID || '').trim().replace(/['"]/g, '');
  const SECRET_ACCESS_KEY = (env.R2_SECRET_ACCESS_KEY || '').trim().replace(/['"]/g, '');

  if (!ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    console.error('Error: Ensure R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are set in .env.');
    globalProc?.exit?.(1);
    return;
  }

  const SOURCE_BUCKET = (env.SOURCE_BUCKET || 'darlalovly-media').trim();
  const TARGET_SNIFFCULT_BUCKET = (env.TARGET_SNIFFCULT_BUCKET || 'sniffcult-archive-media').trim();
  const LOCAL_POSTS_DIR = './public/images/posts';

  const MIME_TYPES: Record<string, string> = {
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.avif': 'image/avif',
    '.mp4': 'video/mp4',
  };

  const sourceS3 = new S3Client({
    region: 'auto',
    endpoint: `https://${ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    },
  });

  const targetS3 = new S3Client({
    region: 'auto',
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    },
  });

  function isRecipeAsset(key: string): boolean {
    const normalized = key.toLowerCase();
    return (
      normalized.includes('recipe') ||
      normalized.includes('recipes') ||
      normalized.includes('bananas-foster') ||
      normalized.includes('bbq-spice') ||
      normalized.includes('blueberry-croissant') ||
      normalized.includes('dr-pepper-cake') ||
      normalized.includes('buttermilk-biscuit') ||
      normalized.includes('italian-shrimp') ||
      normalized.includes('mango-mojito') ||
      normalized.includes('salted-caramel') ||
      normalized.includes('zucchini-bread')
    );
  }

  async function* getLocalFiles(dir: string): AsyncGenerator<string> {
    const entries: any[] = await nodeFsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = nodePath.join(dir, entry.name);
      if (entry.isDirectory()) {
        yield* getLocalFiles(fullPath);
      } else if (!entry.name.startsWith('.')) {
        yield fullPath;
      }
    }
  }

  console.log(`\n=== 1. Moving Sniffcult Media: ${SOURCE_BUCKET} (EU) -> ${TARGET_SNIFFCULT_BUCKET} ===\n`);

  let continuationToken: string | undefined = undefined;
  let copiedCount = 0;
  let preservedCount = 0;

  do {
    const listRes: any = await withRetry(() =>
      sourceS3.send(
        new ListObjectsV2Command({
          Bucket: SOURCE_BUCKET,
          ContinuationToken: continuationToken,
        })
      )
    );

    const contents: any[] = listRes?.Contents || [];

    for (const item of contents) {
      if (!item?.Key) continue;

      if (isRecipeAsset(item.Key)) {
        preservedCount++;
        console.log(`[KEEP RECIPE] ${item.Key}`);
        continue;
      }

      copiedCount++;

      if (DRY_RUN) {
        console.log(`[DRY RUN MOVE] ${item.Key} -> ${TARGET_SNIFFCULT_BUCKET}`);
      } else {
        await withRetry(async () => {
          const getRes: any = await sourceS3.send(
            new GetObjectCommand({
              Bucket: SOURCE_BUCKET,
              Key: item.Key,
            })
          );

          const bytes: Uint8Array | undefined = await getRes.Body?.transformToByteArray();

          if (bytes) {
            await targetS3.send(
              new PutObjectCommand({
                Bucket: TARGET_SNIFFCULT_BUCKET,
                Key: item.Key,
                Body: bytes,
                ContentType: getRes.ContentType || 'application/octet-stream',
              })
            );

            await sourceS3.send(
              new DeleteObjectCommand({
                Bucket: SOURCE_BUCKET,
                Key: item.Key,
              })
            );
          }
        });

        if (copiedCount % 25 === 0) {
          console.log(`[TRANSFERRED] ${copiedCount} files processed...`);
        }
      }
    }

    continuationToken = listRes?.NextContinuationToken;
  } while (continuationToken);

  console.log(`\nMedia move finished: ${copiedCount} files moved, ${preservedCount} recipes kept in ${SOURCE_BUCKET}.\n`);

  console.log(`\n=== 2. Uploading Local Post Images -> ${SOURCE_BUCKET} ===\n`);

  try {
    await nodeFsp.stat(LOCAL_POSTS_DIR);
  } catch {
    console.warn(`Local directory "${LOCAL_POSTS_DIR}" not found. Skipping local upload.`);
    return;
  }

  let uploadedCount = 0;
  let existingCount = 0;

  for await (const filePath of getLocalFiles(LOCAL_POSTS_DIR)) {
    const objectKey = nodePath.relative('./public', filePath).replace(/\\/g, '/');
    const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
      await sourceS3.send(new HeadObjectCommand({ Bucket: SOURCE_BUCKET, Key: objectKey }));
      console.log(`[ALREADY IN R2] ${objectKey}`);
      existingCount++;
    } catch {
      uploadedCount++;
      if (DRY_RUN) {
        console.log(`[DRY RUN UPLOAD] ${objectKey} -> ${SOURCE_BUCKET}`);
      } else {
        await withRetry(async () => {
          const fileData = await nodeFsp.readFile(filePath);
          await sourceS3.send(
            new PutObjectCommand({
              Bucket: SOURCE_BUCKET,
              Key: objectKey,
              Body: fileData,
              ContentType: contentType,
            })
          );
        });
        console.log(`[UPLOADED] ${objectKey}`);
      }
    }
  }

  console.log(`\nUpload complete: ${uploadedCount} uploaded, ${existingCount} already present.\n`);
  console.log('All media migration operations completed.');
}

main().catch((err: any) => {
  console.error('Migration failed:', err);
  const globalProc: any = (globalThis as any).process;
  globalProc?.exit?.(1);
});