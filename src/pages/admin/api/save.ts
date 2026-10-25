// File: src/pages/admin/api/save.ts

export const prerender = false;

import type { APIRoute } from 'astro';

interface SavePayload {
  collection?: string;
  slug?: string;
  content?: string;
  raw?: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    let collection = 'posts';
    let slug = '';
    let fileContent = '';

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = (await request.json()) as SavePayload;
      collection = (body.collection || 'posts').trim();
      slug = (body.slug || '').trim().replace(/\.md$/, '');
      fileContent = body.raw || body.content || '';
    } else if (
      contentType.includes('multipart/form-data') ||
      contentType.includes('application/x-www-form-urlencoded')
    ) {
      const formData = await request.formData();
      collection = String(formData.get('collection') || 'posts').trim();
      slug = String(formData.get('slug') || '').trim().replace(/\.md$/, '');
      fileContent = String(formData.get('raw') || formData.get('content') || '');
    }

    const safeCollection = collection.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, '');

    if (!safeCollection) {
      return new Response(
        JSON.stringify({ error: 'A valid collection directory name is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!safeSlug) {
      return new Response(
        JSON.stringify({ error: 'A valid slug is required to save the entry.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!fileContent.trim()) {
      return new Response(
        JSON.stringify({ error: 'Markdown content cannot be empty.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const filename = `${safeSlug}.md`;
    const relativeFilePath = `src/content/${safeCollection}/${filename}`;

    let cfEnv: any = {};
    try {
      // @ts-ignore
      const cfWorkers = await import('cloudflare:workers');
      cfEnv = cfWorkers?.env || {};
    } catch {}

    const nodeEnv = (globalThis as any).process?.env || {};
    const viteEnv = (import.meta as any).env || {};
    const env = { ...nodeEnv, ...viteEnv, ...cfEnv };

    const githubToken = env.GITHUB_TOKEN;
    const githubOwner = env.GITHUB_REPO_OWNER || 'darlalovly';
    const githubRepo = env.GITHUB_REPO || env.GITHUB_REPO_NAME || 'darla-site';
    const fullRepo =
      githubOwner && githubRepo && !githubRepo.includes('/')
        ? `${githubOwner}/${githubRepo}`
        : githubRepo;
    const githubBranch = env.GITHUB_BRANCH || env.GITHUB_REPO_BRANCH || 'main';

    if (githubToken && fullRepo) {
      const apiUrl = `https://api.github.com/repos/${fullRepo}/contents/${relativeFilePath}`;

      let existingSha: string | undefined;
      const getRes = await fetch(`${apiUrl}?ref=${githubBranch}`, {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'darlalovly-studio',
        },
      });

      if (getRes.ok) {
        const fileData = (await getRes.json()) as { sha?: string };
        existingSha = fileData.sha;
      }

      const utf8Bytes = new TextEncoder().encode(fileContent);
      let binary = '';
      for (let i = 0; i < utf8Bytes.length; i++) {
        binary += String.fromCharCode(utf8Bytes[i]);
      }
      const encodedContent = btoa(binary);

      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'darlalovly-studio',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Studio: update ${safeCollection}/${filename}`,
          content: encodedContent,
          branch: githubBranch,
          ...(existingSha ? { sha: existingSha } : {}),
        }),
      });

      if (!putRes.ok) {
        const putError = await putRes.text();
        return new Response(
          JSON.stringify({ error: `GitHub API error: ${putError}` }),
          { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'github-api',
          message: `Committed ${filename} to ${fullRepo}@${githubBranch}`,
          path: relativeFilePath,
          slug: safeSlug,
          collection: safeCollection,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode: 'edge-ready',
        message: `Entry ${filename} processed successfully for ${relativeFilePath}.`,
        filename,
        slug: safeSlug,
        collection: safeCollection,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to process markdown entry.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};