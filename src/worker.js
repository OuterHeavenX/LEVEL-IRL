const PBKDF2_ITERATIONS = 100000;
const SESSION_DAYS = 30;
const VERIFY_TOKEN_MINUTES = 1440;
const RESET_TOKEN_MINUTES = 60;

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

function b64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
function b64url(bytes) { return b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
function hex(bytes) { return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''); }
function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
function cookies(request) {
  const out = {};
  for (const part of (request.headers.get('Cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
function sessionCookie(token) {
  const maxAge = SESSION_DAYS * 86400;
  return [`fitquest_session=${token}`, 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax', `Max-Age=${maxAge}`].join('; ');
}
function clearCookie() { return ['fitquest_session=', 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=0'].join('; '); }
function htmlEscape(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function hashPassword(password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, key, 256);
  return ['pbkdf2-sha256', PBKDF2_ITERATIONS, b64(salt), b64(new Uint8Array(bits))].join('$');
}
async function verifyPassword(password, stored) {
  try {
    const [alg, iterText, saltText, hashText] = String(stored).split('$');
    if (alg !== 'pbkdf2-sha256') return false;
    const salt = fromB64(saltText);
    const expected = fromB64(hashText);
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: Number(iterText) }, key, expected.length * 8);
    return equalBytes(new Uint8Array(bits), expected);
  } catch { return false; }
}
async function tokenHash(token) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))));
}
async function createSession(env, userId) {
  const raw = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await env.DB.prepare(`INSERT INTO sessions (token,user_id,expires_at,created_at) VALUES (?,?,?,CURRENT_TIMESTAMP)`)
    .bind(await tokenHash(raw), userId, expiresAt).run();
  return raw;
}
async function currentUser(request, env) {
  const raw = cookies(request).fitquest_session;
  if (!raw) return null;
  return env.DB.prepare(`SELECT users.id, users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires_at>CURRENT_TIMESTAMP LIMIT 1`)
    .bind(await tokenHash(raw)).first();
}
async function createAuthToken(env, userId, type, minutes) {
  const raw = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const hash = await tokenHash(raw);
  const expiresAt = new Date(Date.now() + minutes * 60000).toISOString();
  await env.DB.prepare(`DELETE FROM auth_tokens WHERE user_id=? AND type=?`).bind(userId, type).run();
  await env.DB.prepare(`INSERT INTO auth_tokens (id,user_id,type,token_hash,expires_at,created_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)`)
    .bind(crypto.randomUUID(), userId, type, hash, expiresAt).run();
  return raw;
}
async function getValidAuthToken(env, rawToken, type) {
  if (!rawToken) return null;
  return env.DB.prepare(`SELECT auth_tokens.id,auth_tokens.user_id,users.email FROM auth_tokens JOIN users ON users.id=auth_tokens.user_id WHERE auth_tokens.token_hash=? AND auth_tokens.type=? AND auth_tokens.used_at IS NULL AND auth_tokens.expires_at>CURRENT_TIMESTAMP LIMIT 1`)
    .bind(await tokenHash(rawToken), type).first();
}
async function markAuthTokenUsed(env, id) {
  await env.DB.prepare(`UPDATE auth_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?`).bind(id).run();
}
async function sendEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) return { sent: false, reason: 'Email delivery is not configured.' };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: env.FROM_EMAIL, to: [to], subject, html })
  });
  if (!response.ok) {
    console.error('Resend error:', response.status, await response.text());
    return { sent: false, reason: 'Email provider rejected the request.' };
  }
  return { sent: true };
}
function authEmailHtml({ heading, body, buttonText, url }) {
  const safeUrl = htmlEscape(url);
  return `<div style="font-family:system-ui;background:#080d19;color:#f7f8ff;padding:32px"><div style="max-width:520px;margin:auto;background:#0f1629;border:1px solid #26314d;border-radius:22px;padding:28px"><div style="font-size:34px">⚔️</div><h1>${htmlEscape(heading)}</h1><p style="color:#b7c0d4;line-height:1.6">${htmlEscape(body)}</p><p><a href="${safeUrl}" style="display:inline-block;background:#736cff;color:white;text-decoration:none;font-weight:800;padding:13px 18px;border-radius:12px">${htmlEscape(buttonText)}</a></p><p style="color:#7f8ba6;font-size:12px">${safeUrl}</p></div></div>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health' && request.method === 'GET') {
      try { const row = await env.DB.prepare('SELECT 1 AS ok').first(); return json({ ok: true, database: row?.ok === 1 }); }
      catch (error) { return json({ ok: false, error: error.message }, 500); }
    }

    if (url.pathname === '/api/auth/signup' && request.method === 'POST') {
      try {
        const body = await request.json();
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        if (!email.includes('@')) return json({ ok: false, error: 'Enter a valid email address.' }, 400);
        if (password.length < 10) return json({ ok: false, error: 'Password must be at least 10 characters.' }, 400);
        if (await env.DB.prepare(`SELECT id FROM users WHERE email=?`).bind(email).first()) return json({ ok: false, error: 'An account with that email already exists.' }, 409);
        const id = crypto.randomUUID();
        await env.DB.prepare(`INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,CURRENT_TIMESTAMP)`).bind(id, email, await hashPassword(password)).run();
        await env.DB.prepare(`INSERT OR IGNORE INTO user_accounts (user_id,created_at,updated_at) VALUES (?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).bind(id).run();
        const raw = await createSession(env, id);
        return json({ ok: true, user: { id, email } }, 201, { 'Set-Cookie': sessionCookie(raw) });
      } catch (error) { console.error('Signup error:', error); return json({ ok: false, error: error.message || String(error) }, 500); }
    }

    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      try {
        const body = await request.json();
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        const user = await env.DB.prepare(`SELECT id,email,password_hash FROM users WHERE email=? LIMIT 1`).bind(email).first();
        if (!user || !await verifyPassword(password, user.password_hash)) return json({ ok: false, error: 'Incorrect email or password.' }, 401);
        await env.DB.prepare(`DELETE FROM sessions WHERE expires_at<=CURRENT_TIMESTAMP`).run();
        const raw = await createSession(env, user.id);
        return json({ ok: true, user: { id: user.id, email: user.email } }, 200, { 'Set-Cookie': sessionCookie(raw) });
      } catch (error) { console.error('Login error:', error); return json({ ok: false, error: error.message || String(error) }, 500); }
    }

    if (url.pathname === '/api/auth/me' && request.method === 'GET') {
      try {
        const user = await currentUser(request, env);
        if (!user) return json({ ok: false, authenticated: false }, 401);
        return json({ ok: true, authenticated: true, user });
      } catch (error) { return json({ ok: false, authenticated: false, error: error.message || String(error) }, 500); }
    }

    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      try {
        const raw = cookies(request).fitquest_session;
        if (raw) await env.DB.prepare(`DELETE FROM sessions WHERE token=?`).bind(await tokenHash(raw)).run();
        return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });
      } catch (error) { return json({ ok: false, error: error.message || String(error) }, 500); }
    }

    if (url.pathname === '/api/account' && request.method === 'GET') {
      try {
        const user = await currentUser(request, env);
        if (!user) return json({ ok: false, error: 'Not authenticated.' }, 401);
        const account = await env.DB.prepare(`SELECT users.id,users.email,users.created_at,user_accounts.display_name,user_accounts.email_verified_at,user_accounts.updated_at FROM users LEFT JOIN user_accounts ON user_accounts.user_id=users.id WHERE users.id=? LIMIT 1`).bind(user.id).first();
        return json({ ok: true, account });
      } catch (error) { return json({ ok: false, error: error.message || String(error) }, 500); }
    }

    if (url.pathname === '/api/account' && request.method === 'PUT') {
      try {
        const user = await currentUser(request, env);
        if (!user) return json({ ok: false, error: 'Not authenticated.' }, 401);
        const body = await request.json();
        const displayName = String(body.display_name || '').trim();
        if (displayName.length > 60) return json({ ok: false, error: 'Display name must be 60 characters or fewer.' }, 400);
        await env.DB.prepare(`INSERT INTO user_accounts (user_id,display_name,created_at,updated_at) VALUES (?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,updated_at=CURRENT_TIMESTAMP`).bind(user.id, displayName || null).run();
        return json({ ok: true, display_name: displayName || null });
      } catch (error) { return json({ ok: false, error: error.message || String(error) }, 500); }
    }

    if (url.pathname === '/api/account/password' && request.method === 'POST') {
      try {
        const user = await currentUser(request, env);
        if (!user) return json({ ok: false, error: 'Not authenticated.' }, 401);
        const body = await request.json();
        const currentPassword = String(body.current_password || '');
        const newPassword = String(body.new_password || '');
        if (newPassword.length < 10) return json({ ok: false, error: 'New password must be at least 10 characters.' }, 400);
        const row = await env.DB.prepare(`SELECT password_hash FROM users WHERE id=? LIMIT 1`).bind(user.id).first();
        if (!row || !await verifyPassword(currentPassword, row.password_hash)) return json({ ok: false, error: 'Current password is incorrect.' }, 401);
        await env.DB.prepare(`UPDATE users SET password_hash=? WHERE id=?`).bind(await hashPassword(newPassword), user.id).run();
        await env.DB.prepare(`DELETE FROM sessions WHERE user_id=?`).bind(user.id).run();
        const raw = await createSession(env, user.id);
        return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(raw) });
      } catch (error) { return json({ ok: false, error: error.message || String(error) }, 500); }
    }

    if (url.pathname === '/api/account' && request.method === 'DELETE') {
      try {
        const user = await currentUser(request, env);
        if (!user) return json({ ok: false, error: 'Not authenticated.' }, 401);
        await env.DB.prepare(`DELETE FROM auth_tokens WHERE user_id=?`).bind(user.id).run();
        await env.DB.prepare(`DELETE FROM sessions WHERE user_id=?`).bind(user.id).run();
        await env.DB.prepare(`DELETE FROM user_saves WHERE user_id=?`).bind(user.id).run();
        await env.DB.prepare(`DELETE FROM user_accounts WHERE user_id=?`).bind(user.id).run();
        await env.DB.prepare(`DELETE FROM users WHERE id=?`).bind(user.id).run();
        return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });
      } catch (error) { return json({ ok: false, error: error.message || String(error) }, 500); }
    }

    if (url.pathname === '/api/auth/verification/request' && request.method === 'POST') {
      try {
        const user = await currentUser(request, env);
        if (!user) return json({ ok: false, error: 'Not authenticated.' }, 401);
        const account = await env.DB.prepare(`SELECT email_verified_at FROM user_accounts WHERE user_id=? LIMIT 1`).bind(user.id).first();
        if (account?.email_verified_at) return json({ ok: true, already_verified: true });
        const token = await createAuthToken(env, user.id, 'verify_email', VERIFY_TOKEN_MINUTES);
        const verifyUrl = `${url.origin}/?verify=${encodeURIComponent(token)}`;
        const delivery = await sendEmail(env, { to: user.email, subject: 'Verify your LEVEL IRL email', html: authEmailHtml({ heading: 'Verify your LEVEL IRL email', body: 'Confirm this email address for your LEVEL IRL account. This link expires in 24 hours.', buttonText: 'Verify Email', url: verifyUrl }) });
        return json({ ok: true, delivered: delivery.sent, delivery_error: delivery.sent ? null : delivery.reason });
      } catch (error) { return json({ ok: false, error: error.message || String(error) }, 500); }
    }

    if (url.pathname === '/api/auth/verification/confirm' && request.method === 'POST') {
      try {
        const body = await request.json();
        const row = await getValidAuthToken(env, String(body.token || ''), 'verify_email');
        if (!row) return json({ ok: false, error: 'That verification link is invalid or expired.' }, 400);
        await env.DB.prepare(`INSERT INTO user_accounts (user_id,email_verified_at,created_at,updated_at) VALUES (?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET email_verified_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP`).bind(row.user_id).run();
        await markAuthTokenUsed(env, row.id);
        return json({ ok: true });
      } catch (error) { return json({ ok: false, error: error.message || String(error) }, 500); }
    }

    if (url.pathname === '/api/auth/password/forgot' && request.method === 'POST') {
      try {
        const body = await request.json();
        const email = String(body.email || '').trim().toLowerCase();
        const user = await env.DB.prepare(`SELECT id,email FROM users WHERE email=? LIMIT 1`).bind(email).first();
        let delivered = null, deliveryError = null;
        if (user) {
          const token = await createAuthToken(env, user.id, 'reset_password', RESET_TOKEN_MINUTES);
          const resetUrl = `${url.origin}/?reset=${encodeURIComponent(token)}`;
          const delivery = await sendEmail(env, { to: user.email, subject: 'Reset your LEVEL IRL password', html: authEmailHtml({ heading: 'Reset your LEVEL IRL password', body: 'Use this secure link to choose a new password. This link expires in 60 minutes.', buttonText: 'Reset Password', url: resetUrl }) });
          delivered = delivery.sent;
          deliveryError = delivery.sent ? null : delivery.reason;
        }
        return json({ ok: true, message: 'If that email belongs to a LEVEL IRL account, a reset link will be sent.', delivered, delivery_error: deliveryError });
      } catch (error) {
        console.error('Forgot password error:', error);
        return json({ ok: true, message: 'If that email belongs to a LEVEL IRL account, a reset link will be sent.' });
      }
    }

    if (url.pathname === '/api/auth/password/reset' && request.method === 'POST') {
      try {
        const body = await request.json();
        const newPassword = String(body.new_password || '');
        if (newPassword.length < 10) return json({ ok: false, error: 'New password must be at least 10 characters.' }, 400);
        const row = await getValidAuthToken(env, String(body.token || ''), 'reset_password');
        if (!row) return json({ ok: false, error: 'That reset link is invalid or expired.' }, 400);
        await env.DB.prepare(`UPDATE users SET password_hash=? WHERE id=?`).bind(await hashPassword(newPassword), row.user_id).run();
        await markAuthTokenUsed(env, row.id);
        await env.DB.prepare(`DELETE FROM sessions WHERE user_id=?`).bind(row.user_id).run();
        return json({ ok: true });
      } catch (error) { return json({ ok: false, error: error.message || String(error) }, 500); }
    }

    if (url.pathname === '/api/save' && request.method === 'GET') {
      try {
        const user = await currentUser(request, env);
        if (!user) return json({ ok: false, error: 'Not authenticated.' }, 401);
        const row = await env.DB.prepare(`SELECT save_data,updated_at FROM user_saves WHERE user_id=? LIMIT 1`).bind(user.id).first();
        if (!row) return json({ ok: true, save: null, updated_at: null });
        let save;
        try { save = JSON.parse(row.save_data); } catch { return json({ ok: false, error: 'Stored save data is invalid.' }, 500); }
        return json({ ok: true, save, updated_at: row.updated_at });
      } catch (error) { return json({ ok: false, error: error.message || String(error) }, 500); }
    }

    if (url.pathname === '/api/save/meta' && request.method === 'GET') {
      try {
        const user = await currentUser(request, env);
        if (!user) return json({ ok: false, error: 'Not authenticated.' }, 401);
        const row = await env.DB.prepare(`SELECT updated_at FROM user_saves WHERE user_id=? LIMIT 1`).bind(user.id).first();
        return json({ ok: true, updated_at: row?.updated_at || null });
      } catch (error) { return json({ ok: false, error: error.message || String(error) }, 500); }
    }

    if (url.pathname === '/api/save' && request.method === 'PUT') {
      try {
        const user = await currentUser(request, env);
        if (!user) return json({ ok: false, error: 'Not authenticated.' }, 401);
        const body = await request.json();
        if (!body?.save || typeof body.save !== 'object') return json({ ok: false, error: 'Save data must be an object.' }, 400);
        await env.DB.prepare(`INSERT INTO user_saves (user_id,save_data,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET save_data=excluded.save_data,updated_at=CURRENT_TIMESTAMP`).bind(user.id, JSON.stringify(body.save)).run();
        const row = await env.DB.prepare(`SELECT updated_at FROM user_saves WHERE user_id=? LIMIT 1`).bind(user.id).first();
        return json({ ok: true, updated_at: row?.updated_at || null });
      } catch (error) { console.error('Save write error:', error); return json({ ok: false, error: error.message || String(error) }, 500); }
    }

    return env.ASSETS.fetch(request);
  }
};
