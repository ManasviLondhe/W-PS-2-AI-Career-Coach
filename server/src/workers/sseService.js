/**
 * Server-Sent Events (SSE) Manager
 * Delivers real-time notifications to connected clients when commits are detected or assessments update.
 */
class SseService {
  constructor() {
    this.clients = new Set();
  }

  addClient(res) {
    this.clients.add(res);
    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  broadcast(eventType, data) {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch (err) {
        this.clients.delete(client);
      }
    }
  }

  getConnectedCount() {
    return this.clients.size;
  }
}

export const sseService = new SseService();
