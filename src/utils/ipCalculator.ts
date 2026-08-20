import { SubnetCalculation } from '../types/ipam';

/**
 * Converts standard IPv4 string (e.g. "192.168.1.1") to unsigned 32-bit integer.
 */
export function ipToInt(ip: string): number {
  const octets = ip.trim().split('.');
  if (octets.length !== 4) throw new Error(`Invalid IPv4 format: ${ip}`);
  let result = 0;
  for (let i = 0; i < 4; i++) {
    const octet = parseInt(octets[i], 10);
    if (isNaN(octet) || octet < 0 || octet > 255) {
      throw new Error(`Invalid octet ${octets[i]} in IP: ${ip}`);
    }
    result = (result << 8) | octet;
  }
  return result >>> 0; // Ensure unsigned 32-bit
}

/**
 * Converts unsigned 32-bit integer to standard IPv4 string.
 */
export function intToIp(int: number): string {
  const uInt = int >>> 0;
  return [
    (uInt >>> 24) & 255,
    (uInt >>> 16) & 255,
    (uInt >>> 8) & 255,
    uInt & 255,
  ].join('.');
}

/**
 * Validates IPv4 string.
 */
export function isValidIPv4(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255 && (part === '0' || !part.startsWith('0'));
  });
}

/**
 * Validates CIDR notation (e.g. "10.0.0.0/24").
 */
export function isValidCIDR(cidr: string): boolean {
  if (!cidr || typeof cidr !== 'string') return false;
  const parts = cidr.trim().split('/');
  if (parts.length !== 2) return false;
  const [ip, prefixStr] = parts;
  if (!isValidIPv4(ip)) return false;
  if (!/^\d+$/.test(prefixStr)) return false;
  const prefix = parseInt(prefixStr, 10);
  return prefix >= 0 && prefix <= 32;
}

/**
 * Calculates netmask from prefix length (0-32).
 */
export function prefixToNetmask(prefix: number): number {
  if (prefix === 0) return 0;
  return ((0xffffffff << (32 - prefix)) >>> 0);
}

/**
 * Determines whether an IP or CIDR falls into RFC 1918 Private address space.
 * RFC 1918:
 * - 10.0.0.0 - 10.255.255.255 (10.0.0.0/8)
 * - 172.16.0.0 - 172.31.255.255 (172.16.0.0/12)
 * - 192.168.0.0 - 192.168.255.255 (192.168.0.0/16)
 * Also includes CGNAT (100.64.0.0/10) and Loopback (127.0.0.0/8) as non-public.
 */
export function isPrivateRFC1918(ipOrCidr: string): boolean {
  try {
    const rawIp = ipOrCidr.split('/')[0].trim();
    if (!isValidIPv4(rawIp)) return true;
    const ipInt = ipToInt(rawIp);

    // 10.0.0.0/8 (10.0.0.0 to 10.255.255.255)
    const tenStart = ipToInt('10.0.0.0');
    const tenEnd = ipToInt('10.255.255.255');
    if (ipInt >= tenStart && ipInt <= tenEnd) return true;

    // 172.16.0.0/12 (172.16.0.0 to 172.31.255.255)
    const sevStart = ipToInt('172.16.0.0');
    const sevEnd = ipToInt('172.31.255.255');
    if (ipInt >= sevStart && ipInt <= sevEnd) return true;

    // 192.168.0.0/16 (192.168.0.0 to 192.168.255.255)
    const cStart = ipToInt('192.168.0.0');
    const cEnd = ipToInt('192.168.255.255');
    if (ipInt >= cStart && ipInt <= cEnd) return true;

    // 100.64.0.0/10 (Carrier-Grade NAT)
    const cgnatStart = ipToInt('100.64.0.0');
    const cgnatEnd = ipToInt('100.127.255.255');
    if (ipInt >= cgnatStart && ipInt <= cgnatEnd) return true;

    // 127.0.0.0/8 (Loopback)
    const loopStart = ipToInt('127.0.0.0');
    const loopEnd = ipToInt('127.255.255.255');
    if (ipInt >= loopStart && ipInt <= loopEnd) return true;

    return false;
  } catch {
    return true;
  }
}

/**
 * Checks if a specific IP mathematically falls inside a CIDR subnet block.
 */
export function isIPInCIDR(ip: string, cidr: string): boolean {
  if (!isValidIPv4(ip) || !isValidCIDR(cidr)) return false;
  try {
    const [networkIp, prefixStr] = cidr.trim().split('/');
    const prefix = parseInt(prefixStr, 10);
    const mask = prefixToNetmask(prefix);

    const ipVal = ipToInt(ip);
    const netVal = ipToInt(networkIp);

    // Both IP and Network IP must have the same masked network address
    return (ipVal & mask) === (netVal & mask);
  } catch {
    return false;
  }
}

export const isIPInSubnet = isIPInCIDR;

/**
 * Parses CIDR and returns detailed network calculations.
 */
export function parseCIDR(cidr: string): SubnetCalculation {
  if (!isValidCIDR(cidr)) {
    throw new Error(`Invalid CIDR format: ${cidr}`);
  }

  const [ipPart, prefixPart] = cidr.trim().split('/');
  const prefix = parseInt(prefixPart, 10);
  const ipIntVal = ipToInt(ipPart);
  const maskInt = prefixToNetmask(prefix);
  const wildcardInt = (~maskInt) >>> 0;

  const networkInt = (ipIntVal & maskInt) >>> 0;
  const broadcastInt = (networkInt | wildcardInt) >>> 0;

  const totalHosts = prefix === 32 ? 1 : Math.pow(2, 32 - prefix);
  let usableHosts = 0;
  let firstUsableInt = networkInt;
  let lastUsableInt = broadcastInt;

  if (prefix === 31) {
    // RFC 3021 point-to-point links (both IPs usable)
    usableHosts = 2;
    firstUsableInt = networkInt;
    lastUsableInt = broadcastInt;
  } else if (prefix === 32) {
    // Single host route
    usableHosts = 1;
    firstUsableInt = networkInt;
    lastUsableInt = networkInt;
  } else {
    // Standard subnet with reserved network and broadcast
    usableHosts = Math.max(0, totalHosts - 2);
    firstUsableInt = networkInt + 1;
    lastUsableInt = broadcastInt - 1;
  }

  const binaryNetmask = [
    (maskInt >>> 24 & 255).toString(2).padStart(8, '0'),
    (maskInt >>> 16 & 255).toString(2).padStart(8, '0'),
    (maskInt >>> 8 & 255).toString(2).padStart(8, '0'),
    (maskInt & 255).toString(2).padStart(8, '0'),
  ].join('.');

  return {
    cidr: `${intToIp(networkInt)}/${prefix}`,
    ip: ipPart,
    prefix,
    netmask: intToIp(maskInt),
    wildcard: intToIp(wildcardInt),
    networkAddress: intToIp(networkInt),
    broadcastAddress: intToIp(broadcastInt),
    firstUsableHost: intToIp(firstUsableInt),
    lastUsableHost: intToIp(lastUsableInt),
    totalHosts,
    usableHosts,
    isPrivate: isPrivateRFC1918(ipPart),
    binaryNetmask,
  };
}

/**
 * Finds the next available IP address within a subnet CIDR that isn't already assigned or reserved.
 */
export function getNextAvailableIP(cidr: string, existingIPs: string[]): string | null {
  try {
    const calc = parseCIDR(cidr);
    const existingSet = new Set(existingIPs.map(ip => ip.trim()));

    const firstInt = ipToInt(calc.firstUsableHost);
    const lastInt = ipToInt(calc.lastUsableHost);

    for (let current = firstInt; current <= lastInt; current++) {
      const currentIp = intToIp(current);
      if (!existingSet.has(currentIp)) {
        return currentIp;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generates an array of usable host IP strings for a subnet.
 * Capped at maxCount (default 512) to avoid memory explosion for massive prefixes like /8.
 */
export function generateIPRange(cidr: string, maxCount: number = 256): string[] {
  try {
    const calc = parseCIDR(cidr);
    const firstInt = ipToInt(calc.firstUsableHost);
    const lastInt = ipToInt(calc.lastUsableHost);
    const count = Math.min(lastInt - firstInt + 1, maxCount);

    const ips: string[] = [];
    for (let i = 0; i < count; i++) {
      ips.push(intToIp(firstInt + i));
    }
    return ips;
  } catch {
    return [];
  }
}
