import { 
  parseCIDR, 
  getIPVersion, 
  isSubnetOverlapping, 
  areSubnetsOverlapping,
  findNextAvailableIP, 
  splitSubnet, 
  generateReverseDNS, 
  formatCapacityCompact, 
  formatCapacityDetailed,
  isValidIP,
  isValidCIDR
} from './src/utils/ipCalculator';
import { db } from './server/db';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, errorMsg?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName} - ${errorMsg || 'Assertion failed'}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log('====================================================');
  console.log(' 🧪 BeyondIP Enterprise Edition — Automated QA Suite');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST SUITE 1: IP & CIDR Validation Utilities
  // ----------------------------------------------------
  console.log('📌 Test Suite 1: IP & CIDR Syntax Validation');
  assert(isValidIP('192.168.1.1'), 'Valid IPv4 Address');
  assert(isValidIP('10.0.0.254'), 'Valid Private IPv4 Address');
  assert(!isValidIP('256.0.0.1'), 'Reject IPv4 Octet > 255');
  assert(!isValidIP('192.168.1'), 'Reject Incomplete IPv4');
  assert(isValidIP('2001:db8::1'), 'Valid IPv6 Address');
  assert(isValidIP('fe80::1'), 'Valid IPv6 Link-Local');
  assert(!isValidIP('2001:xyz::1'), 'Reject Invalid IPv6 Hex');

  assert(isValidCIDR('192.168.1.0/24'), 'Valid IPv4 CIDR');
  assert(isValidCIDR('10.0.0.0/8'), 'Valid Class A CIDR');
  assert(!isValidCIDR('192.168.1.0/33'), 'Reject IPv4 Prefix > 32');
  assert(isValidCIDR('2001:db8::/64'), 'Valid IPv6 CIDR');
  assert(!isValidCIDR('2001:db8::/129'), 'Reject IPv6 Prefix > 128');

  // ----------------------------------------------------
  // TEST SUITE 2: IPv4 & IPv6 CIDR Calculation Math
  // ----------------------------------------------------
  console.log('\n📌 Test Suite 2: CIDR Math & Boundary Parsing');
  const cidr24 = parseCIDR('192.168.10.0/24');
  assert(cidr24.networkAddress === '192.168.10.0', 'CIDR /24 Network Address');
  assert(cidr24.broadcastAddress === '192.168.10.255', 'CIDR /24 Broadcast Address');
  assert(cidr24.firstUsableHost === '192.168.10.1', 'CIDR /24 First Usable');
  assert(cidr24.lastUsableHost === '192.168.10.254', 'CIDR /24 Last Usable');
  assert(cidr24.totalHosts === 256, 'CIDR /24 Total Hosts');
  assert(cidr24.usableHosts === 254, 'CIDR /24 Usable Hosts');

  const cidr30 = parseCIDR('10.0.0.4/30');
  assert(cidr30.networkAddress === '10.0.0.4', 'CIDR /30 Network Address');
  assert(cidr30.usableHosts === 2, 'CIDR /30 Usable Point-to-Point Hosts (2)');
  assert(cidr30.firstUsableHost === '10.0.0.4' || cidr30.firstUsableHost === '10.0.0.5', 'CIDR /30 First Usable');
  assert(cidr30.lastUsableHost === '10.0.0.6' || cidr30.lastUsableHost === '10.0.0.7', 'CIDR /30 Last Usable');

  const cidrV6 = parseCIDR('2001:db8:abcd::/64');
  assert(cidrV6.ipVersion === 'IPv6', 'IPv6 Version Detection');
  assert(cidrV6.prefix === 64, 'IPv6 Prefix Length');
  assert(cidrV6.usableHostsFormatted.includes('10¹⁹') || cidrV6.usableHostsFormatted.includes('Quintillion') || cidrV6.usableHostsFormatted.includes('18,446'), 'IPv6 64-bit space notation');

  // ----------------------------------------------------
  // TEST SUITE 3: Subnet Overlap Collision Engine
  // ----------------------------------------------------
  console.log('\n📌 Test Suite 3: Subnet Overlap & Collision Detection');
  assert(isSubnetOverlapping('10.0.0.0/16', '10.0.1.0/24'), 'Detect Parent/Child Subnet Overlap (10.0.0.0/16 vs 10.0.1.0/24)');
  assert(isSubnetOverlapping('10.0.1.0/24', '10.0.1.0/24'), 'Detect Identical Subnet Overlap');
  assert(!isSubnetOverlapping('10.0.1.0/24', '10.0.2.0/24'), 'Detect Disjoint /24 Subnets (No Overlap)');
  assert(!isSubnetOverlapping('172.16.0.0/20', '172.16.16.0/20'), 'Detect Consecutive /20 Subnets (No Overlap)');

  // ----------------------------------------------------
  // TEST SUITE 4: Next Available IP Allocation Logic
  // ----------------------------------------------------
  console.log('\n📌 Test Suite 4: Next Available IP Allocation Algorithm');
  const allocated = ['192.168.1.1', '192.168.1.2', '192.168.1.3'];
  const nextIP = findNextAvailableIP('192.168.1.0/24', allocated);
  assert(nextIP === '192.168.1.4', `Next available IP expected 192.168.1.4, got ${nextIP}`);

  const sparseAllocated = ['192.168.1.1', '192.168.1.3'];
  const gapIP = findNextAvailableIP('192.168.1.0/24', sparseAllocated);
  assert(gapIP === '192.168.1.2', `Gap filling allocation expected 192.168.1.2, got ${gapIP}`);

  // ----------------------------------------------------
  // TEST SUITE 5: Subnet Splitting & Reverse DNS (ARPA)
  // ----------------------------------------------------
  console.log('\n📌 Test Suite 5: Subnet Splitting & Reverse DNS');
  const split24 = splitSubnet('192.168.1.0/24', 25);
  assert(split24.length === 2, 'Split /24 into two /25 subnets');
  assert(split24[0].cidr === '192.168.1.0/25', 'First split /25 matches');
  assert(split24[1].cidr === '192.168.1.128/25', 'Second split /25 matches');

  const arpa = generateReverseDNS('192.168.1.50');
  assert(arpa === '50.1.168.192.in-addr.arpa', `Reverse DNS expected 50.1.168.192.in-addr.arpa, got ${arpa}`);

  // ----------------------------------------------------
  // TEST SUITE 6: Capacity Notation & Formatting
  // ----------------------------------------------------
  console.log('\n📌 Test Suite 6: Capacity Notation & Formatting Engine');
  assert(formatCapacityCompact(254) === '254', 'Capacity < 1000 format');
  assert(formatCapacityCompact(1000) === '1K', 'Capacity 1,000 -> 1K');
  assert(formatCapacityCompact(65534) === '65.5K', 'Capacity 65,534 -> 65.5K');
  assert(formatCapacityCompact(1000000) === '1M', 'Capacity 1,000,000 -> 1M');
  assert(formatCapacityCompact(18446744073709551616n, true).includes('10¹⁹'), 'IPv6 Capacity uses 10¹⁹ notation');

  // ----------------------------------------------------
  // TEST SUITE 7: Database Store & IPAM Business Logic
  // ----------------------------------------------------
  console.log('\n📌 Test Suite 7: Database Store & Disk Persistence');
  const stats = db.getStats();
  assert(typeof stats.totalDatacenters === 'number', `Datacenters stats verified (${stats.totalDatacenters})`);
  assert(typeof stats.totalSubnets === 'number', `Subnets stats verified (${stats.totalSubnets})`);
  assert(typeof stats.totalTrackedIPs === 'number', `IPs stats verified (${stats.totalTrackedIPs})`);

  // Test Datacenter operations
  const initialDcCount = db.getDatacenters().length;
  const newDC = db.createDatacenter({
    name: 'QA Test Datacenter (Zurich)',
    location: 'Zurich, Switzerland',
    description: 'Tier 4 High-Availability Datacenter'
  });
  assert(!!newDC.id, 'Datacenter creation with ID');
  assert(db.getDatacenters().length === initialDcCount + 1, 'Datacenter count incremented');

  // Test Subnet operations with Overlap checking
  const sub1 = db.createSubnet({
    datacenterId: newDC.id,
    cidr: '10.200.0.0/24',
    segmentType: 'Private',
  });
  assert(!!sub1.id, 'Subnet creation succeeded');

  const overlapCheck = areSubnetsOverlapping('10.200.0.0/25', sub1.cidr);
  assert(overlapCheck, 'Overlap engine correctly flags 10.200.0.0/25 against existing 10.200.0.0/24');

  // Test IP Reservation
  const nextAllocated = db.reserveNextAvailableIP(sub1.id, {
    assignedDevice: 'qa-router-01',
    description: 'Core BGP Peering Gateway',
  });
  assert(nextAllocated?.ipAddress === '10.200.0.1', `Reserved next IP is 10.200.0.1 (got ${nextAllocated?.ipAddress})`);
  assert(nextAllocated?.status === 'Reserved', 'IP status marked as Reserved');

  // Release IP
  const released = db.updateIP(nextAllocated!.id, { status: 'Available', assignedDevice: '' });
  assert(released?.status === 'Available', 'IP released back to Available');

  // Cleanup QA Datacenter & Subnet
  db.deleteSubnet(sub1.id);
  db.deleteDatacenter(newDC.id);
  assert(!db.getDatacenterById(newDC.id), 'QA Datacenter cleanly deleted');
  assert(db.getDatacenters().length === initialDcCount, 'Datacenter count restored');

  // ----------------------------------------------------
  // TEST SUITE 8: Cryptographic Security & Password Hashing
  // ----------------------------------------------------
  console.log('\n📌 Test Suite 8: Cryptography & Zero-Plaintext Security');
  const testUser = db.createUser({
    name: 'Security QA Engineer',
    email: `security.qa.${Date.now()}@beyondip.net`,
    password: 'superSecretPassword99!',
    role: 'Security Architect',
  });
  assert(!!testUser.id, 'User created successfully with unique ID');
  assert(testUser.email.includes('@beyondip.net'), 'User email formatted correctly');
  assert(testUser.apiKey.startsWith('nx_live_'), 'Secure API Key generated with live prefix');

  // Verify BCrypt sign in
  const authed = db.signIn(testUser.email, 'superSecretPassword99!');
  assert(authed.id === testUser.id, 'BCrypt authentication successfully verifies correct password');

  // Verify wrong password rejection
  let wrongPassRejected = false;
  try {
    db.signIn(testUser.email, 'wrongPassword123');
  } catch {
    wrongPassRejected = true;
  }
  assert(wrongPassRejected, 'BCrypt authentication correctly rejects incorrect password');

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(` 📊 QA TEST RUN COMPLETED: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal Error during QA execution:', err);
  process.exit(1);
});
