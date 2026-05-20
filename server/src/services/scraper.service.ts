import axios from 'axios';
import { logger } from '../utils/logger.js';
import { dnsResolvePrivateCheck } from '../utils/dns.js'; // Let's write this helper to prevent SSRF
import { ContentCleaner } from '../utils/content-cleaner.js';
import type { StructuredScrapeData } from '../types/scrape.types.js';

export class ScraperService {
  /**
   * Scrapes website content by trying a fast HTTP call first (Axios+Cheerio).
   * Automatically falls back to Playwright if Javascript rendering is required.
   */
  public static async scrapeUrl(url: string): Promise<StructuredScrapeData> {
    logger.info(`[ScraperService] Initiating scrape operation for URL`, { url });

    // 1. SSRF & Security Protections
    this.validateUrlSecurity(url);
    await this.verifyDnsAccessSecurity(url);

    // 2. Robots.txt check
    const allowedByRobots = await this.checkRobotsTxt(url);
    if (!allowedByRobots) {
      logger.warn(`[ScraperService] URL crawl blocked by robots.txt directives`, { url });
      throw new Error('This page is blocked from crawling by robots.txt policies.');
    }

    // 3. Fast Path: Axios + Cheerio (Static Site Parser)
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'WhatsFlowBot/1.0 (+https://whatsflow.ai/bot)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
      });

      const html = response.data;
      if (typeof html !== 'string' || html.length === 0) {
        throw new Error('Axios returned empty page content');
      }

      // Check if page appears empty or has a JavaScript placeholder
      if (this.isJsPlaceholder(html)) {
        logger.info(`[ScraperService] Dynamic SPA layout detected. Initialising Playwright fallback...`, { url });
        return await this.scrapeDynamicWithPlaywright(url);
      }

      // Safe clean static data extraction
      return ContentCleaner.cleanAndExtract(html, url);
    } catch (err: any) {
      logger.warn(`[ScraperService] Static parsing failed, attempting Playwright browser context`, {
        url,
        error: err.message,
      });

      // 4. Slow Path: Playwright Headless Browser (JS-Rendered Site Parser)
      return await this.scrapeDynamicWithPlaywright(url);
    }
  }

  /**
   * Validates structure, scheme, and structure parameters
   */
  private static validateUrlSecurity(urlStr: string): void {
    try {
      const parsed = new URL(urlStr);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Invalid URL protocol. Only HTTP and HTTPS are permitted.');
      }
      
      const hostname = parsed.hostname.toLowerCase();
      // Block standard loopback and private class headers directly
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal')
      ) {
        throw new Error('Access denied: Private or loopback domains are prohibited.');
      }
    } catch (err: any) {
      throw new Error(`SSRF Validation failed: ${err.message}`);
    }
  }

  /**
   * Resolves hostname and verifies that IP is not in private CIDR blocks to prevent SSRF
   */
  private static async verifyDnsAccessSecurity(urlStr: string): Promise<void> {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname;

    try {
      const isPrivate = await dnsResolvePrivateCheck(hostname);
      if (isPrivate) {
        throw new Error('Target hostname resolves to a private IP range.');
      }
    } catch (err: any) {
      throw new Error(`DNS Security verification failed: ${err.message}`);
    }
  }

  /**
   * Checks if site's robots.txt allows crawl
   */
  private static async checkRobotsTxt(urlStr: string): Promise<boolean> {
    try {
      const parsed = new URL(urlStr);
      const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;

      const response = await axios.get(robotsUrl, { timeout: 4000 }).catch(() => null);
      if (!response || typeof response.data !== 'string') {
        return true; // Assume allowed if robots.txt is absent
      }

      const lines = response.data.split('\n');
      let userAgentActive = false;
      const path = parsed.pathname;

      for (const line of lines) {
        const cleanLine = line.trim().toLowerCase();
        if (cleanLine.startsWith('user-agent:')) {
          const ua = cleanLine.substring(11).trim();
          userAgentActive = ua === '*' || ua === 'whatsflowbot';
        } else if (userAgentActive && cleanLine.startsWith('disallow:')) {
          const disallowPath = cleanLine.substring(9).trim();
          if (disallowPath && path.startsWith(disallowPath)) {
            return false; // Crawling is forbidden on this path
          }
        }
      }
    } catch {
      // Fail open: if check errors out, default to allowed to keep pipelines moving
    }
    return true;
  }

  /**
   * Identifies empty SPA frames
   */
  private static isJsPlaceholder(html: string): boolean {
    const minLength = 3000;
    if (html.length < minLength) {
      const indicators = [
        '<div id="root"></div>',
        '<div id="app"></div>',
        'javascript has been disabled',
        'enable javascript to run this app',
      ];
      return indicators.some((ind) => html.toLowerCase().includes(ind));
    }
    return false;
  }

  /**
   * Dynamic scraper using Playwright to handle React, Angular, Vue, and SPA platforms
   */
  private static async scrapeDynamicWithPlaywright(url: string): Promise<StructuredScrapeData> {
    let browser: any = null;
    try {
      // Dynamic import to prevent startup crashes if Playwright browser dependencies are missing
      const { chromium } = await import('playwright');
      
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      });

      const context = await browser.newContext({
        userAgent: 'WhatsFlowBot/1.0 (+https://whatsflow.ai/bot)',
        viewport: { width: 1280, height: 800 },
      });

      const page = await context.newPage();
      
      // Block image or media downloads to save bandwidth
      await page.route('**/*', (route: any, request: any) => {
        const resourceType = request.resourceType();
        if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });

      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 25000,
      });

      // Extract fully rendered HTML structure
      const html = await page.content();
      await browser.close();

      return ContentCleaner.cleanAndExtract(html, url);
    } catch (err: any) {
      if (browser) {
        try { await browser.close(); } catch {}
      }
      logger.error(`[ScraperService] Playwright extraction crashed completely`, { error: err.message });
      throw new Error(`Failed to scrape dynamic website assets: ${err.message}`);
    }
  }
}
