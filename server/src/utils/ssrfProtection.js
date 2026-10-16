import { URL } from 'url';

const BLOCKED_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '169.254.169.254', // AWS/GCP metadata
  'metadata.google.internal',
  'instance-data',
  '::1',
  '[::1]',
];

const PRIVATE_IP_REGEX = /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.|0\.|169\.254\.)/;
const IPV6_PRIVATE_REGEX = /^(fc00|fd00|fe80|::1)/i;

/**
 * Validates that a URL is a legitimate public HTTP or HTTPS endpoint.
 * Protects against SSRF attacks on loopback, private ranges, and cloud metadata services.
 */
export function validateSafeUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    throw new Error('Invalid URL provided.');
  }

  let parsed;
  try {
    parsed = new URL(urlString.trim());
  } catch (err) {
    throw new Error(`Malformed URL: ${err.message}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are permitted.');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    throw new Error('Access to private or loopback hostnames is prohibited.');
  }

  if (hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Access to private or loopback hostnames is prohibited.');
  }

  if (PRIVATE_IP_REGEX.test(hostname)) {
    throw new Error('Access to private IP addresses is prohibited.');
  }

  if (IPV6_PRIVATE_REGEX.test(hostname)) {
    throw new Error('Access to private IP addresses is prohibited.');
  }

  return parsed;
}

/**
 * Validates a redirect target URL against the original request origin.
 */
export function validateRedirectUrl(targetUrl, baseOrigin) {
  let resolved;
  try {
    resolved = new URL(targetUrl, baseOrigin);
  } catch (err) {
    throw new Error(`Invalid redirect URL: ${err.message}`);
  }
  return validateSafeUrl(resolved.href);
}
