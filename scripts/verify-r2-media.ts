// @ts-nocheck
import {
  S3Client,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';

async function main() {
  const nodeFs: any = await import(('node:' + 'fs') as any);
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

  console.log(`\n=== Verifying R2 Buckets ===\n`);

  console.log(`1. Scanning ${SOURCE_BUCKET} (EU)...`);
  let sourceCount = 0;
  let sourceToken: string | undefined = undefined;
  const sourceSamples: string[] = [];

  do {
    const res: any = await sourceS3.send(
      new ListObjectsV2Command({
        Bucket: SOURCE_BUCKET,
        ContinuationToken: sourceToken,
      })
    );
    const contents: any[] = res?.Contents || [];
    sourceCount += contents.length;
    for (const item of contents) {
      if (sourceSamples.length < 5 && item?.Key) {
        sourceSamples.push(item.Key);
      }
    }
    sourceToken = res?.NextContinuationToken;
  } while (sourceToken);

  console.log(`Total objects in ${SOURCE_BUCKET}: ${sourceCount}`);
  console.log('Sample keys retained:');
  sourceSamples.forEach((k) => console.log(`  - ${k}`));

  console.log(`\n2. Scanning ${TARGET_SNIFFCULT_BUCKET} (Global)...`);
  let targetCount = 0;
  let targetToken: string | undefined = undefined;
  const targetSamples: string[] = [];

  do {
    const res: any = await targetS3.send(
      new ListObjectsV2Command({
        Bucket: TARGET_SNIFFCULT_BUCKET,
        ContinuationToken: targetToken,
      })
    );
    const contents: any[] = res?.Contents || [];
    targetCount += contents.length;
    for (const item of contents) {
      if (targetSamples.length < 5 && item?.Key) {
        targetSamples.push(item.Key);
      }
    }
    targetToken = res?.NextContinuationToken;
  } while (targetToken);

  console.log(`Total objects in ${TARGET_SNIFFCULT_BUCKET}: ${targetCount}`);
  console.log('Sample keys transferred:');
  targetSamples.forEach((k) => console.log(`  - ${k}`));

  console.log(`\nVerification scan complete.`);
}

main().catch((err: any) => {
  console.error('Verification failed:', err);
  const globalProc: any = (globalThis as any).process;
  globalProc?.exit?.(1);
});