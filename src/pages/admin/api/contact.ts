// File: src/pages/admin/api/contact.ts

export const prerender = false;

import type { APIRoute } from 'astro';

// @ts-ignore
import { env } from 'cloudflare:workers';

export const POST: APIRoute = async (context) => {
  const { request } = context;

  try {
    const contentType = request.headers.get('content-type') || '';
    let name = '';
    let email = '';
    let message = '';
    let turnstileToken = '';
    let honeypot = '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      name = String(body.name || '').trim();
      email = String(body.email || '').trim();
      message = String(body.message || '').trim();
      turnstileToken = String(body.turnstileToken || body['cf-turnstile-response'] || '').trim();
      honeypot = String(body.website || '').trim();
    } else {
      const formData = await request.formData();
      name = String(formData.get('name') || '').trim();
      email = String(formData.get('email') || '').trim();
      message = String(formData.get('message') || '').trim();
      turnstileToken = String(formData.get('cf-turnstile-response') || formData.get('turnstileToken') || '').trim();
      honeypot = String(formData.get('website') || '').trim();
    }

    if (honeypot) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: 'Name, email, and message are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Please enter a valid email address.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let cfEnv: any = {};
    try {
      cfEnv = env || {};
    } catch {}
    const nodeEnv = (globalThis as any).process?.env || {};
    const viteEnv = (import.meta as any).env || {};
    const resolvedEnv = { ...nodeEnv, ...viteEnv, ...cfEnv };

    const turnstileSecret = resolvedEnv.TURNSTILE_SECRET_KEY;
    if (turnstileSecret) {
      if (!turnstileToken) {
        return new Response(
          JSON.stringify({ error: 'Security verification token is missing.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const clientIp = request.headers.get('CF-Connecting-IP') || '';
      const verifyFormData = new FormData();
      verifyFormData.append('secret', turnstileSecret);
      verifyFormData.append('response', turnstileToken);
      if (clientIp) verifyFormData.append('remoteip', clientIp);

      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: verifyFormData,
      });

      const verifyData = (await verifyRes.json()) as { success: boolean; 'error-codes'?: string[] };
      if (!verifyData.success) {
        return new Response(
          JSON.stringify({ error: 'Turnstile verification failed. Please try again.' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const db = resolvedEnv.DB;
    if (!db) {
      return new Response(
        JSON.stringify({ error: 'Database binding (DB) is unavailable.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const id = crypto.randomUUID();
    await db
      .prepare(
        'INSERT INTO messages (id, name, email, message, is_read, created_at) VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)'
      )
      .bind(id, name, email, message)
      .run();

    return new Response(
      JSON.stringify({ success: true, message: 'Message sent successfully.', id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error processing message.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};