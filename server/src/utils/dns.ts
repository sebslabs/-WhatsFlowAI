import dns from 'dns';
import { logger } from './logger.js';

/**
 * Resolves a hostname to its IP address and checks if it belongs to a private IP range.
 * Returns true if the IP is private/loopback (SSRF threat), false if it is a public address.
 */
export async function dnsResolvePrivateCheck(hostname: string): Promise<boolean> {
  return new Promise((resolve) => {
    dns.promises.resolve(hostname)
      .then((ips) => {
        if (!ips || ips.length === 0) {
          resolve(true); // Resolve to true (block) if no IP could be resolved
          return;
        }

        const isUnsafe = ips.some((ip) => isPrivateIp(ip));
        resolve(isUnsafe);
      })
      .catch((err) => {
        logger.warn(`[dns] Hostname resolution failed for checking`, { hostname, error: err.message });
        resolve(true); // Default to block/unsafe on DNS resolution failures
      });
  });
}

/**
 * Helper to check if an IP address belongs to private or local subnets
 */
function isPrivateIp(ip: string): boolean {
  // IPv4 Private Subnets
  // 127.0.0.0/8 (Loopback)
  // 10.0.0.0/8 (Private Network)
  // 172.16.0.0/12 (Private Network)
  // 192.168.0.0/16 (Private Network)
  // 169.254.0.0/16 (Link-local)
  const ipv4Parts = ip.split('.');
  if (ipv4Parts.length === 4) {
    const octet1 = parseInt(ipv4Parts[0], 10);
    const octet2 = parseInt(ipv4Parts[1], 10);

    if (octet1 === 127) return true;
    if (octet1 === 10) return true;
    if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return true;
    if (octet1 === 192 && octet2 === 168) return true;
    if (octet1 === 169 && octet2 === 254) return true;
    if (octet1 === 0) return true; // wildcard loopback
  }

  // IPv6 Private & Local subnets
  const cleanIpv6 = ip.toLowerCase().trim();
  if (
    cleanIpv6 === '::1' ||
    cleanIpv6 === '::' ||
    cleanIpv6.startsWith('fe80:') ||
    cleanIpv6.startsWith('fc00:') ||
    cleanIpv6.startsWith('fd00:')
  ) {
    return true;
  }

  return false;
}
