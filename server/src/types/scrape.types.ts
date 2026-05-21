/**
 * WhatsFlow AI — Website Scraper System Types
 */

export interface StructuredScrapeData {
  url: string;
  title: string;
  metaDescription: string;
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
    h4: string[];
    h5: string[];
    h6: string[];
  };
  paragraphs: string[];
  faqs: Array<{ question: string; answer: string }>;
  emails: string[];
  phones: string[];
  socialLinks: string[];
  internalLinks: string[];
  businessDescription?: string;
  cleanMarkdown: string;
}

export type ScrapeJobStatus =
  | 'queued'
  | 'scraping'
  | 'processing'
  | 'embedding'
  | 'completed'
  | 'failed';

export interface ScrapeJobData {
  jobId: string;
  tenantId: string;
  url: string;
  label?: string;
}

export interface AIFaqResponse {
  faqs: Array<{ question: string; answer: string }>;
  businessSummary: string;
  servicesSummary: string;
}
