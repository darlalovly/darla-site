// @ts-nocheck
import {
  S3Client,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';

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

  let rawAccountId = (env.R2_ACCOUNT_ID || 'de1abb3acceaa3e884d861d4eb660687').trim().replace(/['"]/g, '');
  if (rawAccountId.includes('acceeda')) {
    rawAccountId = rawAccountId.replace('acceeda', 'acceaa');
  }
  const ACCOUNT_ID = rawAccountId;

  const ACCESS_KEY_ID = (env.R2_ACCESS_KEY_ID || '').trim().replace(/['"]/g, '');
  const SECRET_ACCESS_KEY = (env.R2_SECRET_ACCESS_KEY || '').trim().replace(/['"]/g, '');
  const SOURCE_BUCKET = (env.SOURCE_BUCKET || 'darlalovly-media').trim();
  const PUBLIC_DEV_URL = (env.PUBLIC_MEDIA_URL || 'https://pub-23c94031ab954f6cb120959a02ecef04.r2.dev').trim().replace(/\/+$/, '');

  const sourceS3 = new S3Client({
    region: 'auto',
    endpoint: `https://${ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    },
  });

  console.log(`\n=== 1. Testing Live Public HTTP Delivery (${PUBLIC_DEV_URL}) ===\n`);

  const sampleKeys = [
    'Salted-Caramel-Walnut-article-Feature.webp',
    'recipe-bananas-foster-flan-cake-hero.webp',
    'recipe-italian-shrimp-hero.webp',
    'images/posts/2026-03-13-chinatown/2026-03-13-chinatown-01.webp',
    'images/posts/2026-03-13-first-day-in-philly/2026-03-13-first-day-in-philly-header.webp',
    'images/posts/2026-05-22-nyc/nyc-skyline.webp',
    'images/posts/2026-09-04-mt-rushmore/mt-rushmore-first-site.webp',
  ];

  for (const key of sampleKeys) {
    const testUrl = `${PUBLIC_DEV_URL}/${encodeURI(key)}`;
    try {
      const res = await fetch(testUrl, { method: 'HEAD' });
      if (res.ok) {
        console.log(`[HTTP ${res.status} OK] ${testUrl}`);
      } else {
        console.warn(`[HTTP ${res.status}] ${testUrl}`);
      }
    } catch (err: any) {
      console.error(`[FAILED] ${testUrl} -> ${err.message}`);
    }
  }

  console.log(`\n=== 2. Cross-Referencing Content Files Against R2 Inventory ===\n`);

  let continuationToken: string | undefined = undefined;
  const bucketKeys = new Set<string>();

  do {
    const res: any = await sourceS3.send(
      new ListObjectsV2Command({
        Bucket: SOURCE_BUCKET,
        ContinuationToken: continuationToken,
      })
    );
    for (const item of res?.Contents || []) {
      if (item?.Key) bucketKeys.add(item.Key);
    }
    continuationToken = res?.NextContinuationToken;
  } while (continuationToken);

  console.log(`Indexed ${bucketKeys.size} live assets in ${SOURCE_BUCKET}.`);

  const contentDir = './src/content';
  let scannedFiles = 0;
  let matchedRefs = 0;
  let missingRefs = 0;

  async function scanDirectory(dir: string) {
    if (!nodeFs.existsSync(dir)) return;
    const entries = await nodeFsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = nodePath.join(dir, entry.name);
      if (entry.isDirectory()) {
        await scanDirectory(fullPath);
      } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
        scannedFiles++;
        const content = await nodeFsp.readFile(fullPath, 'utf-8');
        const regex = /(?:src|image|heroImage|cover|img):\s*["']?([^"'\n\r]+)["']?|!\[.*?\]\(([^)]+)\)/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
          let ref = (match[1] || match[2] || '').trim();
          if (!ref || ref.startsWith('http://') || ref.startsWith('https://')) continue;
          ref = ref.replace(/^\/+/, '');
          const bareName = nodePath.basename(ref);

          if (bucketKeys.has(ref) || bucketKeys.has(`images/${ref}`) || bucketKeys.has(`images/posts/${ref}`)) {
            matchedRefs++;
            console.log(`[MATCH] ${entry.name} -> ${ref}`);
          } else if (Array.from(bucketKeys).some((k) => k.endsWith(bareName))) {
            matchedRefs++;
            console.log(`[MATCH BY FILENAME] ${entry.name} -> ${bareName}`);
          } else {
            missingRefs++;
            console.warn(`[MISSING IN R2] ${entry.name} references "${ref}"`);
          }
        }
      }
    }
  }

  await scanDirectory(contentDir);
  console.log(`\nScan summary: ${scannedFiles} content files checked, ${matchedRefs} references confirmed in R2, ${missingRefs} missing.\n`);
}

main().catch((err: any) => {
  console.error('Audit failed:', err);
  const globalProc: any = (globalThis as any).process;
  globalProc?.exit?.(1);
});