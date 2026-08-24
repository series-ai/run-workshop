/**
 * POST bytes (or an empty body = abort) into a pending download ticket.
 *
 * Sent via the sibling loopback host (localhost <-> 127.0.0.1) when possible:
 * every pending download holds one of the browser's ~6 per-host connections,
 * so a same-host fulfill for a many-image save queues behind the very
 * downloads it is trying to complete and the whole site deadlocks until the
 * tickets time out. The sibling host gets its own connection pool, so the
 * fulfill always gets through and the downloads drain.
 *
 * The body is re-wrapped as an untyped Blob and sent with mode "no-cors" so
 * the cross-origin POST stays a "simple request" (no preflight); the response
 * is opaque, but callers never read it. On non-loopback hosts (LAN use) there
 * is no sibling, so it falls back to a plain same-origin POST.
 */
export function postDownloadFulfill(ticket: string, body: Blob | null): Promise<unknown> {
  const { hostname, port, protocol } = window.location;
  const sibling =
    hostname === 'localhost' ? '127.0.0.1' : hostname === '127.0.0.1' ? 'localhost' : null;
  const path = `/__download-fulfill/${ticket}`;
  const payload = new Blob([body ?? new Blob([])]);
  if (sibling && protocol === 'http:') {
    return fetch(`http://${sibling}:${port}${path}`, {
      method: 'POST',
      body: payload,
      mode: 'no-cors',
    }).catch(() => {});
  }
  return fetch(path, { method: 'POST', body: payload }).catch(() => {});
}
