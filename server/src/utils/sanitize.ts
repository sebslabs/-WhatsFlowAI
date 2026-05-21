/** Strips HTML tags and unsafe characters from user input on the server. */
export function stripTags(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/\0/g, '')
    .trim()
}

export function sanitizeMessage(raw: string): string {
  return stripTags(raw).slice(0, 4096)
}
