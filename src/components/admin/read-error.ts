/**
 * The one way admin fetch callers turn a failed Response into a message.
 *
 * No `server-only`: every caller is a client component. Error bodies are the
 * `{ error, message? }` shape the admin API routes emit, but a route can also
 * fail before it ever produces JSON (a 502 from the platform, an HTML error
 * page), so a parse failure has to degrade to the bare status rather than
 * throw inside a catch block.
 */
export async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message || data.error || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}
