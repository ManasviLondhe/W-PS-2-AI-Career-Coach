import { URL } from 'url';

const BLOCKED_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '169.254.169.254', // AWS/GCP metadata
  'metadata.google.internal',
];

const PRIVATE_IP_REGEX = /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.|0\.|169\.254\.)/;

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

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    throw new Error('Access to private or loopback hostnames is prohibited.');
  }

  if (PRIVATE_IP_REGEX.test(hostname)) {
    throw new Error('Access to private IP addresses is prohibited.');
  }

  return parsed;
}
