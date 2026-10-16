/**
 * Utility for parsing and extracting clean job posting content from raw HTML.
 * Strips scripts, styles, navigation, headers, footers, and ads while preserving
 * job text structure, titles, headings, and metadata.
 */

export function extractJobFromHtml(html, sourceUrl = '') {
  if (!html || typeof html !== 'string') {
    return {
      title: '',
      employer: '',
      location: '',
      employmentType: '',
      description: '',
      rawText: '',
    };
  }

  // 1. Extract metadata from OpenGraph and standard tags
  const ogTitleMatch =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

  let title = '';
  if (ogTitleMatch) {
    title = decodeHtmlEntities(ogTitleMatch[1]);
  } else if (h1Match) {
    title = stripTags(h1Match[1]);
  } else if (titleTagMatch) {
    title = decodeHtmlEntities(titleTagMatch[1]);
  }

  // Clean title (remove common site suffixes like " - Job ID: 1234", " | Careers", " - Greenhouse", " at Company")
  title = title
    .replace(/\s*-\s*Job ID:\s*\d+.*$/i, '')
    .replace(/\s*([|–—\-]|at)\s+.*(?:careers|jobs|lever|greenhouse|workday|amazon).*$/i, '')
    .trim();

  // 2. Extract employer / organization
  const ogSiteNameMatch =
    html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);
  let employer = '';
  if (ogSiteNameMatch) {
    employer = decodeHtmlEntities(ogSiteNameMatch[1]).trim();
  } else if (sourceUrl) {
    try {
      const u = new URL(sourceUrl);
      const host = u.hostname.toLowerCase().replace(/^www\./, '');
      if (host.includes('amazon.')) employer = 'Amazon';
      else if (host.includes('google.')) employer = 'Google';
      else if (host.includes('stripe.')) employer = 'Stripe';
      else if (host.includes('figma.')) employer = 'Figma';
      else if (host.includes('microsoft.')) employer = 'Microsoft';
      else if (host.includes('meta.') || host.includes('facebook.')) employer = 'Meta';
      else if (host.includes('apple.')) employer = 'Apple';
      else if (host.includes('netflix.')) employer = 'Netflix';
      else {
        const parts = host.split('.');
        if (parts.length >= 2) {
          employer = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        }
      }
    } catch {
      // ignore URL parse error
    }
  }

  // 3. Extract location & employment type heuristics
  let location = '';
  const locMatch = html.match(
    /(?:location|workplace|work location|office|based in)[\s\S]{0,35}?(?:[:\-–]\s*|\s+)(?:<strong>)?([A-Za-z0-9\s,\/\-]+(?:remote|hybrid|on-site|onsite|[A-Z]{2}|ca|ny|wa|tx|uk|india|london|san francisco|seattle|bengaluru|bangalore|new york))/i
  );
  if (locMatch) {
    location = stripTags(locMatch[1]).slice(0, 80).trim();
  } else if (/remote/i.test(html.slice(0, 3000))) {
    location = 'Remote';
  }

  let employmentType = '';
  if (/intern(?:ship)?\b/i.test(title) || /intern(?:ship)?\b/i.test(html.slice(0, 4000))) {
    employmentType = 'Internship';
  } else if (/full[\s-]time/i.test(html.slice(0, 5000))) {
    employmentType = 'Full-time';
  } else if (/part[\s-]time/i.test(html.slice(0, 5000))) {
    employmentType = 'Part-time';
  } else if (/contract/i.test(html.slice(0, 5000))) {
    employmentType = 'Contract';
  }

  // 4. Strip non-content blocks (scripts, styles, nav, footer, header, svg, noscript, iframes)
  let cleanHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

  // 5. Structure block elements into distinct newlines
  cleanHtml = cleanHtml
    .replace(/<h[1-6][^>]*>/gi, '\n\n')
    .replace(/<\/(p|div|section|article|li|tr|h[1-6]|dd|dt|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ');

  // 6. Strip all remaining tags without deleting newlines
  let text = stripTags(cleanHtml);
  text = decodeHtmlEntities(text);

  // Normalize excessive spacing while PRESERVING line structure
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !isNoiseLine(line));

  const cleanText = lines.join('\n');

  return {
    title: title || 'Software Engineer',
    employer: employer || 'Organization',
    location,
    employmentType,
    description: cleanText.slice(0, 25000), // bounded storage
    rawText: cleanText,
  };
}

/**
 * Strips HTML tags and collapses horizontal spaces while PRESERVING newlines!
 */
export function stripTags(input) {
  if (!input) return '';
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t\r]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&times;/g, 'x')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2F;/g, '/')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

function isNoiseLine(line) {
  const lower = line.toLowerCase();
  return (
    lower.startsWith('cookie policy') ||
    lower.startsWith('accept all cookies') ||
    lower.startsWith('privacy policy') ||
    lower.startsWith('all rights reserved') ||
    lower.startsWith('terms of service') ||
    lower.startsWith('skip to main content') ||
    lower.startsWith('download our app') ||
    lower.startsWith('join us on') ||
    lower === 'sign in' ||
    lower === 'log in' ||
    lower === 'apply now' ||
    /^•\s*•/.test(line) ||
    line === '•'
  );
}
