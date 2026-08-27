/**
 * The session cookie name, isolated in a dependency-free module so the Edge
 * middleware can import it without pulling in Node-only crypto (which lives in
 * session.ts and is not available on the Edge runtime).
 */
export const SESSION_COOKIE = 'ns_session';
