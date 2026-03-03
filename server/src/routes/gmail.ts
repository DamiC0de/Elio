/**
 * Gmail OAuth routes - Server-side OAuth flow for Expo Go compatibility
 */
import type { FastifyInstance } from 'fastify';

const GOOGLE_CLIENT_ID = process.env['GOOGLE_CLIENT_ID_WEB'] || '794649959450-fc4ujikilh1eavfnbh3ov4aq3uphvq91.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env['GOOGLE_CLIENT_SECRET'] || '';
const REDIRECT_URI = process.env['GOOGLE_REDIRECT_URI'] || 'https://prevolitional-unrecollected-al.ngrok-free.dev/api/v1/gmail/callback';
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

export async function gmailRoutes(app: FastifyInstance) {
  // Start OAuth flow - redirects to Google
  app.get('/api/v1/gmail/auth', async (request, reply) => {
    const { userId } = request.query as { userId?: string };
    
    if (!userId) {
      return reply.status(400).send({ error: 'userId required' });
    }

    if (!GOOGLE_CLIENT_SECRET) {
      return reply.status(500).send({ error: 'GOOGLE_CLIENT_SECRET not configured' });
    }

    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent select_account');
    authUrl.searchParams.set('state', state);

    return reply.redirect(authUrl.toString());
  });

  // OAuth callback - Google redirects here
  app.get('/api/v1/gmail/callback', async (request, reply) => {
    const { code, state, error } = request.query as { code?: string; state?: string; error?: string };

    if (error) {
      return reply.type('text/html').send(`
        <html><body>
          <h1>Erreur</h1>
          <p>${error}</p>
          <p>Tu peux fermer cette page.</p>
        </body></html>
      `);
    }

    if (!code || !state) {
      return reply.status(400).send({ error: 'Missing code or state' });
    }

    let userId: string;
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      userId = stateData.userId;
    } catch {
      return reply.status(400).send({ error: 'Invalid state' });
    }

    try {
      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        const err = await tokenResponse.text();
        app.log.error({ err }, 'Token exchange failed');
        return reply.type('text/html').send(`
          <html><body>
            <h1>Erreur</h1>
            <p>Impossible d'obtenir les tokens: ${err}</p>
          </body></html>
        `);
      }

      const tokens = await tokenResponse.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      };

      // Get user email
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userInfoRes.json() as { email: string };

      // Store tokens in Supabase
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env['SUPABASE_URL']!,
        process.env['SUPABASE_SERVICE_ROLE_KEY']!
      );

      await supabase.from('gmail_tokens').upsert({
        user_id: userId,
        email: userInfo.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      app.log.info({ userId, email: userInfo.email }, 'Gmail tokens stored');

      // Success page with deep link back to app
      return reply.type('text/html').send(`
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, sans-serif; padding: 40px 20px; text-align: center; background: #1a1a2e; color: white; }
            h1 { color: #4ade80; }
            p { color: #ccc; }
            a { color: #60a5fa; }
          </style>
        </head>
        <body>
          <h1>✅ Gmail connecté !</h1>
          <p>Connecté en tant que <strong>${userInfo.email}</strong></p>
          <p>Tu peux fermer cette page et retourner dans Diva.</p>
          <p><a href="diva://gmail-connected?email=${encodeURIComponent(userInfo.email)}">Retour à l'app</a></p>
        </body>
        </html>
      `);
    } catch (err) {
      app.log.error({ err }, 'Gmail OAuth error');
      return reply.type('text/html').send(`
        <html><body>
          <h1>Erreur</h1>
          <p>${String(err)}</p>
        </body></html>
      `);
    }
  });

  // Check if user has Gmail connected
  app.get('/api/v1/gmail/status', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env['SUPABASE_URL']!,
      process.env['SUPABASE_SERVICE_ROLE_KEY']!
    );

    const { data } = await supabase
      .from('gmail_tokens')
      .select('email, expires_at')
      .eq('user_id', userId)
      .single();

    return reply.send({
      connected: !!data,
      email: data?.email || null,
    });
  });

  // Disconnect Gmail
  app.delete('/api/v1/gmail/disconnect', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env['SUPABASE_URL']!,
      process.env['SUPABASE_SERVICE_ROLE_KEY']!
    );

    await supabase.from('gmail_tokens').delete().eq('user_id', userId);

    return reply.send({ success: true });
  });
}
