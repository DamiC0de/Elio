/**
 * WebSocket route — wired to Orchestrator + Redis
 */
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { Orchestrator } from '../services/orchestrator.js';
import { getRedis } from '../lib/redis.js';

let orchestrator: Orchestrator | null = null;

export async function wsRoutes(app: FastifyInstance): Promise<void> {
  // Initialize orchestrator with Redis
  const redis = getRedis();
  try {
    await redis.connect();
    orchestrator = new Orchestrator(app.log, redis as never);
    app.log.info('Orchestrator initialized with Redis');
  } catch {
    app.log.warn('Redis not available — orchestrator running in mock mode');
    orchestrator = new Orchestrator(app.log, null);
  }

  app.get('/ws', { websocket: true }, async (socket: WebSocket, request) => {
    // Extract userId from auth token (query param or header)
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      socket.send(JSON.stringify({ type: 'error', message: 'Authentication required' }));
      socket.close(4001, 'Unauthorized');
      return;
    }

    // Verify JWT and extract userId via Supabase Auth
    let userId: string;
    try {
      const { getSupabase } = await import('../lib/supabase.js');
      const supabase = getSupabase();
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        app.log.warn({ msg: 'Invalid token', error: error?.message });
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
        socket.close(4001, 'Invalid token');
        return;
      }
      userId = user.id;
    } catch (err) {
      app.log.error({ msg: 'Token verification failed', error: String(err) });
      socket.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
      socket.close(4001, 'Authentication failed');
      return;
    }

    app.log.info({ msg: 'WebSocket client connected', userId });

    // Delegate to orchestrator
    orchestrator!.handleConnection(socket, userId);

    // Send welcome
    socket.send(JSON.stringify({
      type: 'connected',
      message: 'Bienvenue sur Diva',
      version: '0.1.0',
      userId,
    }));
  });
}
