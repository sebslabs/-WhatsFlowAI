import { logger } from './logger.js';

export class Chunker {
  /**
   * Splits a long text body into semantically coherent chunks (500-1000 tokens).
   * Uses paragraph and sentence divisions to avoid cutting mid-word or mid-sentence.
   *
   * @param text - The full cleaned text body (or Markdown format)
   * @param maxTokens - Maximum token count per chunk (default: 800)
   * @param minTokens - Minimum token count before merging (default: 300)
   * @param overlapTokens - Tokens to overlap between consecutive chunks (default: 100)
   */
  public static splitText(
    text: string,
    maxTokens = 800,
    minTokens = 300,
    overlapTokens = 100
  ): string[] {
    if (!text || text.trim().length === 0) return [];

    // Rough conversion heuristics (1 token ≈ 4 characters)
    const maxChars = maxTokens * 4;
    const minChars = minTokens * 4;
    const overlapChars = overlapTokens * 4;

    logger.info(`[Chunker] Initiating chunking`, {
      length: text.length,
      maxChars,
      minChars,
      overlapChars,
    });

    // 1. Break text into logical paragraphs
    const rawParagraphs = text.split(/\n+/);
    const paragraphs = rawParagraphs
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const chunks: string[] = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      // If adding this paragraph exceeds the boundary limit
      if (currentChunk.length + paragraph.length > maxChars) {
        // If current chunk has accrued substantial content, flush it
        if (currentChunk.length >= minChars) {
          chunks.push(currentChunk.trim());
          
          // Re-populate with overlap content from previous chunk end
          currentChunk = currentChunk.slice(-overlapChars) + '\n\n' + paragraph;
        } else {
          // If chunk is still small, append to avoid undersized vectors
          currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph;
        }
      } else {
        currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph;
      }
    }

    // Append any final trailing characters
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    // 2. Secondary processing: If a single paragraph was massive and exceeded maxChars,
    // split it recursively using sentences instead to guarantee limit enforcement.
    const finalizedChunks: string[] = [];
    for (const chunk of chunks) {
      if (chunk.length > maxChars) {
        const subChunks = this.splitBySentences(chunk, maxChars, overlapChars);
        finalizedChunks.push(...subChunks);
      } else {
        finalizedChunks.push(chunk);
      }
    }

    logger.info(`[Chunker] Completed splitting`, {
      originalParagraphs: paragraphs.length,
      generatedChunks: finalizedChunks.length,
    });

    return finalizedChunks;
  }

  /**
   * Helper to segment a massive paragraph by sentence boundaries
   */
  private static splitBySentences(text: string, maxChars: number, overlapChars: number): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
    const subChunks: string[] = [];
    let currentSub = '';

    for (const sentence of sentences) {
      const cleanSentence = sentence.trim();
      if (!cleanSentence) continue;

      if (currentSub.length + cleanSentence.length > maxChars) {
        if (currentSub.length > 0) {
          subChunks.push(currentSub.trim());
          currentSub = currentSub.slice(-overlapChars) + ' ' + cleanSentence;
        } else {
          // Sentence itself exceeds max boundary, slice by hard limit characters
          subChunks.push(cleanSentence.substring(0, maxChars));
          currentSub = cleanSentence.substring(maxChars);
        }
      } else {
        currentSub = currentSub ? currentSub + ' ' + cleanSentence : cleanSentence;
      }
    }

    if (currentSub.trim().length > 0) {
      subChunks.push(currentSub.trim());
    }

    return subChunks;
  }
}
