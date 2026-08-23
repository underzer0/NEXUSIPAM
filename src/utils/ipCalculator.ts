import { SubnetCalculation, IPVersion } from '../types/ipam';

// ==========================================
// IPv4 Helpers
// ==========================================

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
 * Calculates netmask from IPv4 prefix length (0-32).
 */
export function prefixToNetmask(prefix: number): number {
  if (prefix === 0) return 0;
  return ((0xffffffff << (32 - prefix)) >>> 0);
}

// ==========================================
// IPv6 Helpers & 128-bit Math
// ==========================================

/**
 * Validates standard or compressed IPv6 string (e.g. "2001:db8::1", "::1", "fe80::").
 */
export function isValidIPv6(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  if (trimmed.length === 0) return false;

  // IPv6 must not have more than one "::"
  const doubleColonParts = trimmed.split('::');
  if (doubleColonParts.length > 2) return false;

  if (doubleColonParts.length === 2) {
    const [left, right] = doubleColonParts;
    const leftHextets = left ? left.split(':') : [];
    const rightHextets = right ? right.split(':') : [];

    if (leftHextets.length + rightHextets.length > 7) return false;

    const allHextets = [...leftHextets, ...rightHextets];
    return allHextets.every(h => /^[0-9a-fA-F]{1,4}$/.test(h));
  } else {
    // Exactly 8 hextets
    const hextets = trimmed.split(':');
    if (hextets.length !== 8) return false;
    return hextets.every(h => /^[0-9a-fA-F]{1,4}$/.test(h));
  }
}

/**
 * Expands an IPv6 address to its full 8-hextet, 32-hex-digit representation.
 * e.g. "2001:db8::1" -> "2001:0db8:0000:0000:0000:0000:0000:0001"
 */
export function expandIPv6(ip: string): string {
  if (!isValidIPv6(ip)) throw new Error(`Invalid IPv6 address: ${ip}`);
  const trimmed = ip.trim().toLowerCase();

  const doubleColonParts = trimmed.split('::');
  let hextets: string[] = [];

  if (doubleColonParts.length === 2) {
    const left = doubleColonParts[0] ? doubleColonParts[0].split(':') : [];
    const right = doubleColonParts[1] ? doubleColonParts[1].split(':') : [];
    const missing = 8 - (left.length + right.length);
    const middle = new Array(missing).fill('0000');
    hextets = [...left, ...middle, ...right];
  } else {
    hextets = trimmed.split(':');
  }

  return hextets.map(h => h.padStart(4, '0')).join(':');
}

/**
 * Compresses an IPv6 address according to RFC 5952 canonical formatting.
 */
export function compressIPv6(ip: string): string {
  const expanded = expandIPv6(ip);
  const hextets = expanded.split(':').map(h => parseInt(h, 16).toString(16));

  // Find longest contiguous run of zeros (minimum 2 hextets)
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;

  for (let i = 0; i < hextets.length; i++) {
    if (hextets[i] === '0') {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curStart = -1;
      curLen = 0;
    }
  }

  if (bestLen < 2) {
    return hextets.join(':');
  }

  const left = hextets.slice(0, bestStart).join(':');
  const right = hextets.slice(bestStart + bestLen).join(':');

  if (bestStart === 0 && bestLen === 8) {
    return '::';
  }
  if (bestStart === 0) {
    return `::${right}`;
  }
  if (bestStart + bestLen === 8) {
    return `${left}::`;
  }
  return `${left}::${right}`;
}

/**
 * Converts IPv6 address string to a 128-bit BigInt.
 */
export function ipv6ToBigInt(ip: string): bigint {
  const expanded = expandIPv6(ip);
  const hex = expanded.replace(/:/g, '');
  return BigInt(`0x${hex}`);
}

/**
 * Converts 128-bit BigInt to an IPv6 string.
 */
export function bigIntToIPv6(num: bigint, compressed = true): string {
  let hex = num.toString(16).padStart(32, '0');
  if (hex.length > 32) hex = hex.slice(-32);

  const hextets: string[] = [];
  for (let i = 0; i < 32; i += 4) {
    hextets.push(hex.slice(i, i + 4));
  }
  const expanded = hextets.join(':');
  return compressed ? compressIPv6(expanded) : expanded;
}

/**
 * Generates IPv6 netmask as 128-bit BigInt for a prefix (0-128).
 */
export function prefixToIPv6NetmaskBigInt(prefix: number): bigint {
  if (prefix <= 0) return 0n;
  if (prefix >= 128) return (1n << 128n) - 1n;
  const totalBits = 128n;
  const hostBits = BigInt(128 - prefix);
  const allOnes = (1n << totalBits) - 1n;
  const hostMask = (1n << hostBits) - 1n;
  return allOnes ^ hostMask;
}

// ==========================================
// Dual-Stack Validation & Inspection
// ==========================================

/**
 * Validates any IPv4 or IPv6 address.
 */
export function isValidIP(ip: string): boolean {
  return isValidIPv4(ip) || isValidIPv6(ip);
}

/**
 * Detects IP version from string.
 */
export function getIPVersion(ipOrCidr: string): IPVersion | 'Unknown' {
  if (!ipOrCidr || typeof ipOrCidr !== 'string') return 'Unknown';
  const raw = ipOrCidr.split('/')[0].trim();
  if (isValidIPv4(raw)) return 'IPv4';
  if (isValidIPv6(raw)) return 'IPv6';
  return 'Unknown';
}

/**
 * Validates CIDR notation for IPv4 (0-32) or IPv6 (0-128).
 */
export function isValidCIDR(cidr: string): boolean {
  if (!cidr || typeof cidr !== 'string') return false;
  const parts = cidr.trim().split('/');
  if (parts.length !== 2) return false;
  const [ip, prefixStr] = parts;
  if (!/^\d+$/.test(prefixStr)) return false;
  const prefix = parseInt(prefixStr, 10);

  if (isValidIPv4(ip)) {
    return prefix >= 0 && prefix <= 32;
  }
  if (isValidIPv6(ip)) {
    return prefix >= 0 && prefix <= 128;
  }
  return false;
}

/**
 * Determines whether an IP or CIDR falls into Private / Non-Public space.
 * IPv4: RFC 1918 (10/8, 172.16/12, 192.168/16), CGNAT (100.64/10), Loopback (127/8).
 * IPv6: ULA Unique Local (fc00::/7 e.g. fd00::/8), Link-Local (fe80::/10), Loopback (::1/128).
 */
export function isPrivateRFC1918(ipOrCidr: string): boolean {
  try {
    const rawIp = ipOrCidr.split('/')[0].trim();
    const version = getIPVersion(rawIp);

    if (version === 'IPv4') {
      const ipInt = ipToInt(rawIp);

      // 10.0.0.0/8
      if (ipInt >= ipToInt('10.0.0.0') && ipInt <= ipToInt('10.255.255.255')) return true;
      // 172.16.0.0/12
      if (ipInt >= ipToInt('172.16.0.0') && ipInt <= ipToInt('172.31.255.255')) return true;
      // 192.168.0.0/16
      if (ipInt >= ipToInt('192.168.0.0') && ipInt <= ipToInt('192.168.255.255')) return true;
      // 100.64.0.0/10 (CGNAT)
      if (ipInt >= ipToInt('100.64.0.0') && ipInt <= ipToInt('100.127.255.255')) return true;
      // 127.0.0.0/8 (Loopback)
      if (ipInt >= ipToInt('127.0.0.0') && ipInt <= ipToInt('127.255.255.255')) return true;

      return false;
    } else if (version === 'IPv6') {
      const ipBig = ipv6ToBigInt(rawIp);

      // ULA: fc00::/7 (fc00:: to fdff:... )
      const ulaMask = prefixToIPv6NetmaskBigInt(7);
      const ulaNet = ipv6ToBigInt('fc00::');
      if ((ipBig & ulaMask) === ulaNet) return true;

      // Link-Local: fe80::/10
      const linkLocalMask = prefixToIPv6NetmaskBigInt(10);
      const linkLocalNet = ipv6ToBigInt('fe80::');
      if ((ipBig & linkLocalMask) === linkLocalNet) return true;

      // Loopback ::1
      if (ipBig === 1n || ipBig === 0n) return true;

      return false; // Global Unicast 2000::/3, etc.
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * Checks if a specific IP mathematically falls inside a CIDR subnet block (IPv4 or IPv6).
 */
export function isIPInCIDR(ip: string, cidr: string): boolean {
  if (!isValidCIDR(cidr)) return false;
  const ipVer = getIPVersion(ip);
  const [networkIp, prefixStr] = cidr.trim().split('/');
  const netVer = getIPVersion(networkIp);

  if (ipVer !== netVer || ipVer === 'Unknown') return false;

  const prefix = parseInt(prefixStr, 10);

  try {
    if (ipVer === 'IPv4') {
      const mask = prefixToNetmask(prefix);
      const ipVal = ipToInt(ip);
      const netVal = ipToInt(networkIp);
      return (ipVal & mask) === (netVal & mask);
    } else {
      // IPv6
      const mask = prefixToIPv6NetmaskBigInt(prefix);
      const ipVal = ipv6ToBigInt(ip);
      const netVal = ipv6ToBigInt(networkIp);
      return (ipVal & mask) === (netVal & mask);
    }
  } catch {
    return false;
  }
}

export const isIPInSubnet = isIPInCIDR;

/**
 * Formats large BigInt numbers into human-readable strings (e.g. 18.44 Quintillion / 2^64).
 */
export function formatHostCount(num: bigint): string {
  if (num <= 1000000n) {
    return Number(num).toLocaleString();
  }
  if (num < 1000000000n) {
    return `${(Number(num) / 1000000).toFixed(2)} Million`;
  }
  if (num < 1000000000000n) {
    return `${(Number(num) / 1000000000).toFixed(2)} Billion`;
  }
  if (num < 1000000000000000n) {
    return `${(Number(num) / 1000000000000).toFixed(2)} Trillion`;
  }
  if (num < 1000000000000000000n) {
    return `${(Number(num / 1000000000000n) / 1000).toFixed(2)} Quadrillion`;
  }
  // 18.44 Quintillion for 2^64
  const quintillion = num / 1000000000000000000n;
  const remainder = Number((num % 1000000000000000000n) / 10000000000000000n);
  return `${quintillion}.${remainder.toString().padStart(2, '0')} Quintillion (2^${Math.round(Math.log2(Number(num.toString().slice(0, 15)))) + (num.toString().length - 15) * 3})`;
}

/**
 * Categorizes IPv6 prefix scope descriptions.
 */
function getIPv6PrefixType(prefix: number): string {
  if (prefix === 32) return '/32 (RIR/LIR Allocation)';
  if (prefix === 48) return '/48 (Enterprise / Site Prefix)';
  if (prefix === 56) return '/56 (ISP Subscriber Sub-delegation)';
  if (prefix === 60) return '/60 (Customer Edge Routing)';
  if (prefix === 64) return '/64 (Standard SLAAC / Host LAN Subnet)';
  if (prefix === 112) return '/112 (Data Center Container Cluster)';
  if (prefix === 126) return '/126 (Router Point-to-Point Link)';
  if (prefix === 127) return '/127 (Inter-Router Link RFC 6164)';
  if (prefix === 128) return '/128 (Single Host / Loopback Route)';
  if (prefix < 48) return `/${prefix} (Regional/Transit Aggregation)`;
  if (prefix < 64) return `/${prefix} (Enterprise Multi-Subnet Block)`;
  return `/${prefix} (Point-to-Point / Micro-segment)`;
}

/**
 * Parses CIDR (IPv4 or IPv6) and returns detailed network calculations.
 */
export function parseCIDR(cidr: string): SubnetCalculation {
  if (!isValidCIDR(cidr)) {
    throw new Error(`Invalid CIDR format: ${cidr}`);
  }

  const [ipPart, prefixPart] = cidr.trim().split('/');
  const prefix = parseInt(prefixPart, 10);
  const version = getIPVersion(ipPart);

  if (version === 'IPv4') {
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
      usableHosts = 2;
      firstUsableInt = networkInt;
      lastUsableInt = broadcastInt;
    } else if (prefix === 32) {
      usableHosts = 1;
      firstUsableInt = networkInt;
      lastUsableInt = networkInt;
    } else {
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
      ipVersion: 'IPv4',
      netmask: intToIp(maskInt),
      wildcard: intToIp(wildcardInt),
      networkAddress: intToIp(networkInt),
      broadcastAddress: intToIp(broadcastInt),
      firstUsableHost: intToIp(firstUsableInt),
      lastUsableHost: intToIp(lastUsableInt),
      totalHosts,
      usableHosts,
      totalHostsFormatted: totalHosts.toLocaleString(),
      usableHostsFormatted: usableHosts.toLocaleString(),
      isPrivate: isPrivateRFC1918(ipPart),
      binaryNetmask,
      prefixType: prefix === 24 ? '/24 (Class C Standard)' : prefix === 16 ? '/16 (Class B)' : prefix === 8 ? '/8 (Class A)' : `/${prefix} Subnet`,
    };
  } else {
    // IPv6 calculation
    const ipBig = ipv6ToBigInt(ipPart);
    const maskBig = prefixToIPv6NetmaskBigInt(prefix);
    const allOnes = (1n << 128n) - 1n;
    const wildcardBig = allOnes ^ maskBig;

    const networkBig = ipBig & maskBig;
    const broadcastBig = networkBig | wildcardBig; // last address in prefix range

    const hostBits = BigInt(128 - prefix);
    const totalHostsBig = 1n << hostBits;
    
    // For IPv6, usable hosts in standard /64 is 2^64, or totalHostsBig
    const usableHostsBig = prefix === 128 ? 1n : (prefix === 127 ? 2n : (totalHostsBig > 2n ? totalHostsBig - 1n : totalHostsBig));

    const firstUsableBig = prefix === 128 ? networkBig : networkBig + 1n;
    const lastUsableBig = broadcastBig;

    const safeNumberTotal = totalHostsBig > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(totalHostsBig);
    const safeNumberUsable = usableHostsBig > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(usableHostsBig);

    const netmaskHex = bigIntToIPv6(maskBig, false);
    const wildcardHex = bigIntToIPv6(wildcardBig, false);

    // Format binary prefix
    const binaryBits = '1'.repeat(prefix) + '0'.repeat(128 - prefix);
    const binaryGrouped = binaryBits.match(/.{1,16}/g)?.join(' ') || binaryBits;

    const expanded = expandIPv6(ipPart);
    const compressed = compressIPv6(ipPart);
    const normalizedNetwork = compressIPv6(bigIntToIPv6(networkBig));

    return {
      cidr: `${normalizedNetwork}/${prefix}`,
      ip: compressed,
      prefix,
      ipVersion: 'IPv6',
      netmask: compressIPv6(netmaskHex),
      wildcard: compressIPv6(wildcardHex),
      networkAddress: normalizedNetwork,
      broadcastAddress: compressIPv6(bigIntToIPv6(broadcastBig)),
      firstUsableHost: compressIPv6(bigIntToIPv6(firstUsableBig)),
      lastUsableHost: compressIPv6(bigIntToIPv6(lastUsableBig)),
      totalHosts: safeNumberTotal,
      usableHosts: safeNumberUsable,
      totalHostsFormatted: formatHostCount(totalHostsBig),
      usableHostsFormatted: formatHostCount(usableHostsBig),
      isPrivate: isPrivateRFC1918(ipPart),
      binaryNetmask: binaryGrouped,
      expandedAddress: expanded,
      compressedAddress: compressed,
      prefixType: getIPv6PrefixType(prefix),
    };
  }
}

/**
 * Finds the next available IP address within a subnet CIDR that isn't already assigned or reserved.
 */
export function getNextAvailableIP(cidr: string, existingIPs: string[]): string | null {
  try {
    const calc = parseCIDR(cidr);
    const existingSet = new Set(
      existingIPs.map(ip => {
        const ver = getIPVersion(ip);
        if (ver === 'IPv6') {
          return compressIPv6(ip);
        }
        return ip.trim();
      })
    );

    if (calc.ipVersion === 'IPv4') {
      const firstInt = ipToInt(calc.firstUsableHost);
      const lastInt = ipToInt(calc.lastUsableHost);

      for (let current = firstInt; current <= lastInt; current++) {
        const currentIp = intToIp(current);
        if (!existingSet.has(currentIp)) {
          return currentIp;
        }
      }
      return null;
    } else {
      // IPv6: scan up to 1,000 candidate host offsets from network address
      const networkBig = ipv6ToBigInt(calc.networkAddress);
      for (let offset = 1n; offset <= 1000n; offset++) {
        const candidateBig = networkBig + offset;
        const candidateIp = compressIPv6(bigIntToIPv6(candidateBig));
        if (!existingSet.has(candidateIp)) {
          return candidateIp;
        }
      }
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Generates an array of usable host IP strings for a subnet.
 * Capped at maxCount (default 256) to prevent browser lockup.
 */
export function generateIPRange(cidr: string, maxCount: number = 256): string[] {
  try {
    const calc = parseCIDR(cidr);
    if (calc.ipVersion === 'IPv4') {
      const firstInt = ipToInt(calc.firstUsableHost);
      const lastInt = ipToInt(calc.lastUsableHost);
      const count = Math.min(lastInt - firstInt + 1, maxCount);

      const ips: string[] = [];
      for (let i = 0; i < count; i++) {
        ips.push(intToIp(firstInt + i));
      }
      return ips;
    } else {
      // IPv6: generate sequential host addresses starting from ::1
      const networkBig = ipv6ToBigInt(calc.networkAddress);
      const count = Math.min(maxCount, 256);
      const ips: string[] = [];
      for (let i = 1; i <= count; i++) {
        const hostBig = networkBig + BigInt(i);
        ips.push(compressIPv6(bigIntToIPv6(hostBig)));
      }
      return ips;
    }
  } catch {
    return [];
  }
}

/**
 * Formats capacity numbers into compact engineering or scientific 10^ notation.
 * Handles IPv4 (K for 1000, M for Million, 10^x notation) and IPv6 (10^19 notation).
 */
export function formatCapacityCompact(count: number | bigint, isIPv6: boolean = false): string {
  if (isIPv6) {
    if (typeof count === 'bigint') {
      const e18 = 1000000000000000000n;
      if (count >= e18) {
        const primary = Number(count / e18) / 10;
        return `${primary.toFixed(2)} × 10¹⁹`;
      }
    }
    return `1.84 × 10¹⁹`;
  }

  const num = typeof count === 'bigint' ? Number(count) : count;

  if (num < 1000) {
    return num.toLocaleString();
  }
  if (num < 1000000) {
    const k = num / 1000;
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
  }
  if (num < 1000000000) {
    const m = num / 1000000;
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
  }
  const b = num / 1000000000;
  return `${b.toFixed(2)} × 10⁹`;
}

/**
 * Detailed breakdown for capacity display with scientific 10^ and K notation.
 */
export function formatCapacityDetailed(count: number | bigint, isIPv6: boolean = false) {
  const compact = formatCapacityCompact(count, isIPv6);
  let full = '';
  let notation = '';

  if (isIPv6) {
    full = typeof count === 'bigint' ? count.toString() : '18,446,744,073,709,551,616 per /64 prefix';
    notation = '10¹⁹ Notation (128-bit space)';
  } else {
    const num = typeof count === 'bigint' ? Number(count) : count;
    full = `${num.toLocaleString()} total usable IPv4 hosts`;
    if (num >= 1000000000) {
      notation = '10⁹ Engineering Notation';
    } else if (num >= 1000000) {
      notation = '10⁶ (Million) Notation';
    } else if (num >= 1000) {
      notation = 'K (Thousand) Notation';
    } else {
      notation = 'Standard Decimal Count';
    }
  }

  return {
    compact,
    full,
    notation,
  };
}

/**
 * Determines whether two CIDR subnets overlap in address space.
 */
export function areSubnetsOverlapping(cidrA: string, cidrB: string): boolean {
  if (!isValidCIDR(cidrA) || !isValidCIDR(cidrB)) return false;
  const verA = getIPVersion(cidrA);
  const verB = getIPVersion(cidrB);
  if (verA !== verB || verA === 'Unknown') return false;

  const calcA = parseCIDR(cidrA);
  const calcB = parseCIDR(cidrB);

  if (verA === 'IPv4') {
    const netA = ipToInt(calcA.networkAddress);
    const bcastA = ipToInt(calcA.broadcastAddress);
    const netB = ipToInt(calcB.networkAddress);
    const bcastB = ipToInt(calcB.broadcastAddress);

    return Math.max(netA, netB) <= Math.min(bcastA, bcastB);
  } else {
    const netA = ipv6ToBigInt(calcA.networkAddress);
    const bcastA = ipv6ToBigInt(calcA.broadcastAddress);
    const netB = ipv6ToBigInt(calcB.networkAddress);
    const bcastB = ipv6ToBigInt(calcB.broadcastAddress);

    return (netA <= bcastB) && (netB <= bcastA);
  }
}

export const isSubnetOverlapping = areSubnetsOverlapping;
export const findNextAvailableIP = getNextAvailableIP;

/**
 * Splits a subnet into smaller child subnets of target prefix length.
 */
export function splitSubnet(cidr: string, targetPrefix: number): SubnetCalculation[] {
  if (!isValidCIDR(cidr)) throw new Error(`Invalid CIDR: ${cidr}`);
  const parent = parseCIDR(cidr);
  if (targetPrefix <= parent.prefix) {
    throw new Error(`Target prefix /${targetPrefix} must be longer than parent prefix /${parent.prefix}`);
  }

  const ver = parent.ipVersion;
  if (ver === 'IPv4') {
    if (targetPrefix > 32) throw new Error('Target prefix cannot exceed 32 for IPv4');
    const stepHosts = Math.pow(2, 32 - targetPrefix);
    const parentNetInt = ipToInt(parent.networkAddress);
    const numSubnets = Math.pow(2, targetPrefix - parent.prefix);

    const results: SubnetCalculation[] = [];
    for (let i = 0; i < numSubnets; i++) {
      const childNetInt = parentNetInt + (i * stepHosts);
      results.push(parseCIDR(`${intToIp(childNetInt)}/${targetPrefix}`));
    }
    return results;
  } else {
    if (targetPrefix > 128) throw new Error('Target prefix cannot exceed 128 for IPv6');
    const parentNetBig = ipv6ToBigInt(parent.networkAddress);
    const hostBits = BigInt(128 - targetPrefix);
    const stepHostsBig = 1n << hostBits;
    const numSubnets = Math.min(1024, Number(1n << BigInt(targetPrefix - parent.prefix)));

    const results: SubnetCalculation[] = [];
    for (let i = 0; i < numSubnets; i++) {
      const childNetBig = parentNetBig + (BigInt(i) * stepHostsBig);
      const childNetIp = compressIPv6(bigIntToIPv6(childNetBig));
      results.push(parseCIDR(`${childNetIp}/${targetPrefix}`));
    }
    return results;
  }
}

/**
 * Generates RFC Reverse DNS PTR records (in-addr.arpa for IPv4, ip6.arpa for IPv6).
 */
export function generateReverseDNS(ip: string): string {
  const ver = getIPVersion(ip);
  if (ver === 'IPv4') {
    if (!isValidIPv4(ip)) throw new Error(`Invalid IPv4 address: ${ip}`);
    const octets = ip.trim().split('.');
    return `${octets.reverse().join('.')}.in-addr.arpa`;
  } else if (ver === 'IPv6') {
    if (!isValidIPv6(ip)) throw new Error(`Invalid IPv6 address: ${ip}`);
    const expanded = expandIPv6(ip).replace(/:/g, '');
    const nibbles = expanded.split('').reverse().join('.');
    return `${nibbles}.ip6.arpa`;
  }
  throw new Error(`Invalid IP address: ${ip}`);
}

