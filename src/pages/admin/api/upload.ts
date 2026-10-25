// File: src/pages/admin/api/upload.ts

import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    let cfEnv: any = {};
    try {
      // @ts-ignore
      const cfWorkers = await import('cloudflare:workers');
      cfEnv = cfWorkers?.env || {};
    } catch {}

    const nodeEnv = (globalThis as any).process?.env || {};
    const viteEnv = (import.meta as any).env || {};
    const env = { ...nodeEnv, ...viteEnv, ...cfEnv };

    const bucket = env.MEDIA_BUCKET || env.R2 || env.darlalovly_media;

    if (!bucket) {
      return new Response(
        JSON.stringify({ error: 'Cloudflare R2 bucket binding not configured.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const formData = await request.formData();
    const rawFiles = formData.getAll('file');
    const folder = (formData.get('folder') as string)?.replace(/^\/+|\/+$/g, '') || 'images/posts';

    const files = rawFiles.filter((item): item is File => item instanceof File && item.size > 0);

    if (files.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid files provided for upload.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const publicR2Base = (
      env.PUBLIC_R2_URL ||
      viteEnv.PUBLIC_R2_URL ||
      'https://pub-23c94031ab954f6cb120959a02ecef04.r2.dev/'
    ).replace(/\/+$/, '');

    const uploadedAssets = [];

    for (const file of files) {
      const sanitizedName = file.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9._-]/g, '');

      const key = `${folder}/${Date.now()}-${sanitizedName}`;
      const buffer = await file.arrayBuffer();

      await bucket.put(key, buffer, {
        httpMetadata: {
          contentType: file.type || 'application/octet-stream',
        },
      });

      uploadedAssets.push({
        key,
        url: `${publicR2Base}/${key}`,
        name: file.name,
        size: file.size,
        type: file.type,
      });
    }

    return new Response(
      JSON.stringify({ success: true, count: uploadedAssets.length, assets: uploadedAssets }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to upload media to R2.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};