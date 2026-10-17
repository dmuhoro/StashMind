/**
 * Security Service: SSRF Protection, URL Validation, and Sanitization
 */

export class SecurityService {
  private static PRIVATE_IP_PATTERNS = [
    /^127\./, // Loopback
    /^0\./, // Current network
    /^10\./, // Private RFC 1918 Class A
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private RFC 1918 Class B
    /^192\.168\./, // Private RFC 1918 Class C
    /^169\.254\./, // Link-local / Cloud metadata (AWS, GCP, Azure)
    /^::1$/, // IPv6 loopback
    /^fe80:/i, // IPv6 link-local
    /^fc00:/i, // IPv6 unique local
    /^fd00:/i, // IPv6 unique local
  ];

  private static BLOCKED_HOSTNAMES = [
    'localhost',
    'metadata.google.internal',
    'metadata.internal',
    'instance-data',
    '169.254.169.254',
  ];

  /**
   * Validates whether a remote URL is safe to fetch server-side.
   * Throws an error if the URL targets loopback, link-local, cloud metadata, or private networks.
   */
  static validateSafeUrl(rawUrl: string): { valid: boolean; error?: string; url?: URL } {
    try {
      const parsed = new URL(rawUrl);

      // 1. Only allow HTTP and HTTPS
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { valid: false, error: 'Protocol must be http or https.' };
      }

      const hostname = parsed.hostname.toLowerCase();

      // 2. Block named localhost and metadata hostnames
      if (this.BLOCKED_HOSTNAMES.includes(hostname)) {
        return { valid: false, error: 'Access to loopback or cloud metadata is strictly prohibited.' };
      }

      // 3. Block private and link-local IP addresses
      for (const pattern of this.PRIVATE_IP_PATTERNS) {
        if (pattern.test(hostname)) {
          return { valid: false, error: 'Access to private or link-local IP addresses is strictly prohibited.' };
        }
      }

      // 4. Block port-based scans to internal non-standard web ports
      if (parsed.port && !['80', '443', '8080', '8443'].includes(parsed.port)) {
        return { valid: false, error: 'Port not permitted for external source ingestion.' };
      }

      return { valid: true, url: parsed };
    } catch {
      return { valid: false, error: 'Malformed or invalid URL.' };
    }
  }

  /**
   * Sanitizes untrusted user strings, stripping control characters.
   */
  static sanitizeText(input: string): string {
    if (!input) return '';
    return input
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
      .trim();
  }

  /**
   * Strips HTML markup to extract plain text for article ingestion.
   */
  static extractTextFromHtml(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
}
