/**
 * Client SSE Event Listener
 */
export function subscribeToEvents(onEvent) {
  const API_BASE = import.meta.env.VITE_API_URL || '';
  const url = `${API_BASE}/api/events`;

  let eventSource = null;
  let retryTimeout = null;

  function connect() {
    try {
      eventSource = new EventSource(url);

      eventSource.addEventListener('connected', (e) => {
        // console.log('[SSE] Connected to real-time event stream');
      });

      eventSource.addEventListener('commit_detected', (e) => {
        try {
          const data = JSON.parse(e.data);
          onEvent({ type: 'commit_detected', data });
        } catch (err) {
          console.error('[SSE] Failed to parse commit_detected data', err);
        }
      });

      eventSource.addEventListener('assessment_updated', (e) => {
        try {
          const data = JSON.parse(e.data);
          onEvent({ type: 'assessment_updated', data });
        } catch (err) {
          console.error('[SSE] Failed to parse assessment_updated data', err);
        }
      });

      eventSource.onerror = () => {
        eventSource.close();
        // Retry connection after 5s
        retryTimeout = setTimeout(connect, 5000);
      };
    } catch (err) {
      retryTimeout = setTimeout(connect, 5000);
    }
  }

  connect();

  return () => {
    if (retryTimeout) clearTimeout(retryTimeout);
    if (eventSource) eventSource.close();
  };
}
