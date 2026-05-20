/**
 * Extract Meta Cloud API phone_number_id from a WhatsApp webhook JSON payload.
 */
export function extractPhoneNumberIdFromMetaPayload(payload: Record<string, unknown>): string | null {
  try {
    const entry = payload.entry
    const arr = Array.isArray(entry) ? entry : []
    const e0 = arr[0] as Record<string, unknown> | undefined
    const changes = e0?.changes
    const chArr = Array.isArray(changes) ? changes : []
    const ch0 = chArr[0] as Record<string, unknown> | undefined
    const value = ch0?.value as Record<string, unknown> | undefined
    const metadata = value?.metadata as Record<string, unknown> | undefined
    const id = metadata?.phone_number_id
    return typeof id === 'string' && id.length > 0 ? id : null
  } catch {
    return null
  }
}
