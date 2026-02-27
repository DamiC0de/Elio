import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';

export async function wsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/ws', { websocket: true }, (socket: WebSocket, _request) => {
    app.log.info('WebSocket client connected');

    socket.on('message', (message: Buffer) => {
      const data = message.toString();
      app.log.debug({ msg: 'WS message received', data });

      // Echo for now — will be replaced by orchestrator in EL-009
      socket.send(JSON.stringify({
        type: 'echo',
        data,
        timestamp: new Date().toISOString(),
      }));
    });

    socket.on('close', () => {
      app.log.info('WebSocket client disconnected');
    });

    socket.on('error', (error: Error) => {
      app.log.error({ msg: 'WebSocket error', error: error.message });
    });

    // Send welcome message
    socket.send(JSON.stringify({
      type: 'connected',
      message: 'Bienvenue sur Elio API Gateway',
      version: '0.1.0',
    }));
  });
}
