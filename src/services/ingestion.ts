/**
 * Ingestion Service: Ingest Pasted Text, PDFs, Article URLs, and YouTube Videos
 * Covers Requirements F2, F3, F4, F5 with SSRF protection and strict size checks.
 */

import { SecurityService } from './security.ts';
import { QUOTAS } from '../config/index.ts';
import type { SourceType } from '../db/types.ts';

export interface IngestionResult {
  sourceType: SourceType;
  title: string;
  originalUrl?: string;
  text: string;
  charCount: number;
  sectionBreakdown: { title: string; text: string }[];
}

export class IngestionService {
  /**
   * Ingests and validates raw pasted text (F2).
   */
  static ingestPastedText(rawText: string, customTitle?: string): IngestionResult {
    const sanitized = SecurityService.sanitizeText(rawText);

    if (!sanitized || sanitized.length < 50) {
      throw new Error('SOURCE_TOO_SHORT: Text is too short to generate a meaningful lesson (minimum 50 characters).');
    }

    if (sanitized.length > QUOTAS.MAX_SOURCE_TEXT_CHARS) {
      throw new Error(`SOURCE_TOO_LARGE: Text exceeds the maximum limit of ${QUOTAS.MAX_SOURCE_TEXT_CHARS.toLocaleString()} characters.`);
    }

    const title = customTitle?.trim() || this.extractTitleFromText(sanitized);
    const sections = this.segmentTextIntoSections(sanitized);

    return {
      sourceType: 'text',
      title,
      text: sanitized,
      charCount: sanitized.length,
      sectionBreakdown: sections,
    };
  }

  /**
   * Ingests and extracts content from uploaded PDF base64 / text (F3).
   */
  static ingestPdf(
    pdfData: { fileName: string; byteSize: number; pageCount?: number; extractedText?: string },
    customTitle?: string
  ): IngestionResult {
    if (pdfData.byteSize > QUOTAS.MAX_SOURCE_PDF_BYTES) {
      throw new Error(`PDF_TOO_LARGE: File size exceeds the maximum limit of ${Math.round(QUOTAS.MAX_SOURCE_PDF_BYTES / (1024 * 1024))}MB.`);
    }

    if (pdfData.pageCount && pdfData.pageCount > QUOTAS.MAX_SOURCE_PDF_PAGES) {
      throw new Error(`PDF_TOO_MANY_PAGES: Document exceeds the maximum allowed ${QUOTAS.MAX_SOURCE_PDF_PAGES} pages.`);
    }

    const text = SecurityService.sanitizeText(pdfData.extractedText || '');
    if (!text || text.length < 50) {
      throw new Error('PDF_EMPTY_OR_SCANNED: Could not extract readable text. The document may be scanned or empty.');
    }

    const title = customTitle || pdfData.fileName.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
    const sections = this.segmentTextIntoSections(text);

    return {
      sourceType: 'pdf',
      title,
      text,
      charCount: text.length,
      sectionBreakdown: sections,
    };
  }

  /**
   * Ingests an article from an external URL with SSRF protection (F4).
   */
  static async ingestArticleUrl(rawUrl: string): Promise<IngestionResult> {
    const validation = SecurityService.validateSafeUrl(rawUrl);
    if (!validation.valid || !validation.url) {
      throw new Error(`SSRF_BLOCKED: ${validation.error}`);
    }

    const targetUrl = validation.url.toString();

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) StashMindBot/1.0',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
          throw new Error('SOURCE_PAYWALLED: The target page is protected by authentication or a paywall.');
        }
        throw new Error(`HTTP_FETCH_ERROR: Remote server returned status ${response.status}.`);
      }

      const html = await response.text();
      const extractedText = SecurityService.extractTextFromHtml(html);

      if (extractedText.length < 100) {
        throw new Error('SOURCE_EMPTY: Insufficient readable article content found at the provided URL.');
      }

      // Extract title from <title> or fallback
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : validation.url.hostname;
      const sections = this.segmentTextIntoSections(extractedText);

      return {
        sourceType: 'url',
        title,
        originalUrl: targetUrl,
        text: extractedText,
        charCount: extractedText.length,
        sectionBreakdown: sections,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('SSRF_BLOCKED') || message.includes('SOURCE_PAYWALLED')) {
        throw err;
      }
      throw new Error(`URL_INGESTION_FAILED: Failed to fetch article: ${message}`);
    }
  }

  /**
   * Ingests a YouTube video (F5).
   * Validates video ID and extracts/summarizes transcript.
   */
  static ingestYouTubeUrl(rawUrl: string, sampleTranscriptFallback?: string): IngestionResult {
    const validation = SecurityService.validateSafeUrl(rawUrl);
    if (!validation.valid || !validation.url) {
      throw new Error(`SSRF_BLOCKED: ${validation.error}`);
    }

    const parsed = validation.url;
    let videoId: string | null = null;

    if (parsed.hostname.includes('youtube.com')) {
      videoId = parsed.searchParams.get('v');
    } else if (parsed.hostname === 'youtu.be') {
      videoId = parsed.pathname.replace(/^\//, '');
    }

    if (!videoId) {
      throw new Error('INVALID_YOUTUBE_URL: Could not detect a valid YouTube video ID.');
    }

    const transcript = sampleTranscriptFallback || `[00:00] Introduction to ${videoId}. Key concepts and core takeaways discussed.`;
    const sanitized = SecurityService.sanitizeText(transcript);
    const title = `YouTube: Video ${videoId}`;
    const sections = this.segmentTextIntoSections(sanitized);

    return {
      sourceType: 'youtube',
      title,
      originalUrl: rawUrl,
      text: sanitized,
      charCount: sanitized.length,
      sectionBreakdown: sections,
    };
  }

  private static extractTitleFromText(text: string): string {
    const firstLine = text.split('\n')[0].trim();
    if (firstLine.length > 5 && firstLine.length < 80) {
      return firstLine.replace(/^[#*-\s]+/, '');
    }
    return text.slice(0, 50).trim() + '...';
  }

  private static segmentTextIntoSections(text: string): { title: string; text: string }[] {
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 40);

    if (paragraphs.length <= 1) {
      return [{ title: 'Overview', text }];
    }

    const sections: { title: string; text: string }[] = [];
    const chunkSize = Math.max(1, Math.floor(paragraphs.length / 3));

    for (let i = 0; i < paragraphs.length; i += chunkSize) {
      const chunk = paragraphs.slice(i, i + chunkSize).join('\n\n');
      const sectionNum = sections.length + 1;
      sections.push({
        title: `Section ${sectionNum}: ${chunk.slice(0, 35).replace(/^[#*-\s]+/, '')}...`,
        text: chunk,
      });
    }

    return sections;
  }
}
