import * as cheerio from 'cheerio';
import { logger } from './logger.js';
import type { StructuredScrapeData } from '../types/scrape.types.js';

export class ContentCleaner {
  // Regex filters for structured elements
  private static EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  private static PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
  private static SOCIAL_PLATFORMS = [
    'facebook.com',
    'twitter.com',
    'x.com',
    'instagram.com',
    'linkedin.com',
    'youtube.com',
    'whatsapp.com',
  ];

  /**
   * Cleans raw HTML using Cheerio, extracts structured fields, and outputs clean Markdown text.
   */
  public static cleanAndExtract(html: string, url: string): StructuredScrapeData {
    logger.info(`[ContentCleaner] Cleaning HTML DOM context for URL`, { url });

    const $ = cheerio.load(html);

    // 1. Remove non-content structural noise
    const noiseSelectors = [
      'script',
      'style',
      'noscript',
      'iframe',
      'svg',
      'nav',
      'header',
      'footer',
      'aside',
      '#cookie-banner',
      '.cookie-banner',
      '#cookie-popup',
      '.cookie-consent',
      '.ads',
      'ins.adsbygoogle',
      '.newsletter-signup',
      '.popup-wrapper',
      'form', // Skip search or login forms
    ];

    noiseSelectors.forEach((sel) => $(sel).remove());

    // 2. Metadata extraction
    const title = $('title').text().trim() || $('meta[property="og:title"]').attr('content')?.trim() || 'Untitled Page';
    const metaDescription = $('meta[name="description"]').attr('content')?.trim() || 
                             $('meta[property="og:description"]').attr('content')?.trim() || 
                             '';

    // 3. Headings extraction
    const headings = {
      h1: [] as string[],
      h2: [] as string[],
      h3: [] as string[],
      h4: [] as string[],
      h5: [] as string[],
      h6: [] as string[],
    };

    $('h1').each((_, el) => { const txt = $(el).text().trim(); if (txt) headings.h1.push(txt); });
    $('h2').each((_, el) => { const txt = $(el).text().trim(); if (txt) headings.h2.push(txt); });
    $('h3').each((_, el) => { const txt = $(el).text().trim(); if (txt) headings.h3.push(txt); });
    $('h4').each((_, el) => { const txt = $(el).text().trim(); if (txt) headings.h4.push(txt); });
    $('h5').each((_, el) => { const txt = $(el).text().trim(); if (txt) headings.h5.push(txt); });
    $('h6').each((_, el) => { const txt = $(el).text().trim(); if (txt) headings.h6.push(txt); });

    // 4. Anchor link parsing
    const socialLinks: string[] = [];
    const internalLinks: string[] = [];
    const baseUrl = new URL(url);

    $('a').each((_, el) => {
      const href = $(el).attr('href')?.trim();
      if (!href) return;

      try {
        const absoluteUrl = new URL(href, url).toString();
        const parsedUrl = new URL(absoluteUrl);

        // Social links match checker
        const isSocial = this.SOCIAL_PLATFORMS.some((platform) => parsedUrl.hostname.includes(platform));
        if (isSocial) {
          if (!socialLinks.includes(absoluteUrl)) {
            socialLinks.push(absoluteUrl);
          }
        } 
        // Internal page links checker
        else if (parsedUrl.hostname === baseUrl.hostname) {
          if (!internalLinks.includes(absoluteUrl) && absoluteUrl !== url) {
            internalLinks.push(absoluteUrl);
          }
        }
      } catch {
        // Skip malformed href values (javascript:void, etc.)
      }
    });

    // 5. Plain paragraphs and text body
    const paragraphs: string[] = [];
    $('p').each((_, el) => {
      const txt = $(el).text().replace(/\s+/g, ' ').trim();
      if (txt && txt.length > 15) { // Skip short noise paragraphs
        paragraphs.push(txt);
      }
    });

    // 6. Contact Information (Emails + Phone numbers matching via regex)
    const rawText = $.text();
    const emails = Array.from(new Set(rawText.match(this.EMAIL_REGEX) || []));
    const phones = Array.from(new Set(rawText.match(this.PHONE_REGEX) || []))
      .map(p => p.trim())
      .filter(p => p.length >= 7); // Exclude small stray integers

    // 7. Formulate Clean Markdown Outline representation
    const markdownLines: string[] = [];

    markdownLines.push(`# ${title}\n`);
    if (metaDescription) {
      markdownLines.push(`> ${metaDescription}\n`);
    }

    // Traverse body elements recursively to build structured markdown text
    const self = this;
    $('body *').each((_, el) => {
      const tag = el.tagName.toLowerCase();
      const $el = $(el);

      // Only evaluate immediate structural children of body or articles
      if (!['p', 'h1', 'h2', 'h3', 'ul', 'ol'].includes(tag)) return;

      const text = $el.text().replace(/\s+/g, ' ').trim();
      if (!text) return;

      if (tag.startsWith('h')) {
        const level = tag.substring(1);
        markdownLines.push(`\n${'#'.repeat(parseInt(level, 10))} ${text}\n`);
      } else if (tag === 'p') {
        if (text.length > 20) {
          markdownLines.push(`${text}\n`);
        }
      } else if (tag === 'ul' || tag === 'ol') {
        $el.find('li').each((i, li) => {
          const liText = $(li).text().trim();
          if (liText) {
            markdownLines.push(tag === 'ul' ? `- ${liText}` : `${i + 1}. ${liText}`);
          }
        });
        markdownLines.push('');
      }
    });

    // Combine lines and strip any massive whitespace gaps
    const cleanMarkdown = markdownLines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // 8. Basic Heuristic FAQs Parser
    const faqs: Array<{ question: string; answer: string }> = [];
    headings.h3.forEach((q, idx) => {
      // If a heading ends with a question mark, match with next paragraph
      if (q.endsWith('?') || q.toLowerCase().includes('what') || q.toLowerCase().includes('how')) {
        const ans = paragraphs[idx] || '';
        if (ans) {
          faqs.push({ question: q, answer: ans });
        }
      }
    });

    return {
      url,
      title,
      metaDescription,
      headings,
      paragraphs,
      faqs,
      emails,
      phones,
      socialLinks,
      internalLinks,
      cleanMarkdown,
    };
  }
}
