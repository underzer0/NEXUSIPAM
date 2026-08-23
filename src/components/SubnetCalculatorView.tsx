import React, { useState, useEffect } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { 
  Calculator, 
  Lock, 
  Globe, 
  Binary, 
  Copy, 
  Check, 
  Sliders,
  Sparkles,
  Info,
  Layers,
  Network
} from 'lucide-react';
import { parseCIDR, isValidCIDR, isValidIPv4, isValidIPv6, isPrivateRFC1918, getIPVersion, expandIPv6, compressIPv6 } from '../utils/ipCalculator';
import { IPVersion } from '../types/ipam';

export const SubnetCalculatorView: React.FC = () => {
  const { isDark } = useIPAM();
  const [protocol, setProtocol] = useState<IPVersion>('IPv4');
  const [ipInput, setIpInput] = useState('10.10.10.0');
  const [prefixInput, setPrefixInput] = useState(24);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Auto-switch protocol when user types IPv6 or IPv4
  const handleIpChange = (val: string) => {
    setIpInput(val);
    const trimmed = val.trim();
    if (trimmed.includes(':') && protocol !== 'IPv6') {
      setProtocol('IPv6');
      if (prefixInput < 32) setPrefixInput(64);
    } else if (trimmed.includes('.') && protocol !== 'IPv4' && !trimmed.includes(':')) {
      setProtocol('IPv4');
      if (prefixInput > 32) setPrefixInput(24);
    }
  };

  const handleProtocolToggle = (target: IPVersion) => {
    setProtocol(target);
    if (target === 'IPv4') {
      setIpInput('10.10.10.0');
      setPrefixInput(24);
    } else {
      setIpInput('fd00:10:10::');
      setPrefixInput(64);
    }
  };

  const cidrString = `${ipInput.trim()}/${prefixInput}`;
  let calcResult = null;
  let calcError = null;

  try {
    const raw = ipInput.trim();
    if (protocol === 'IPv4') {
      if (isValidIPv4(raw)) {
        calcResult = parseCIDR(cidrString);
      } else {
        calcError = 'Please enter a valid IPv4 address (e.g. 10.10.10.0)';
      }
    } else {
      if (isValidIPv6(raw)) {
        calcResult = parseCIDR(cidrString);
      } else {
        calcError = 'Please enter a valid IPv6 address (e.g. 2001:db8::, fd00:10:10::, ::1)';
      }
    }
  } catch (err: any) {
    calcError = err.message || 'Invalid calculation';
  }

  const handleCopy = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const ipv4Presets = [
    { label: 'RFC1918 /24', prefix: 24, ip: '192.168.1.0' },
    { label: 'Cloud VPC /20', prefix: 20, ip: '10.10.0.0' },
    { label: 'Cluster /26', prefix: 26, ip: '172.16.50.0' },
    { label: 'P2P /30', prefix: 30, ip: '10.0.0.0' },
    { label: 'Host /32', prefix: 32, ip: '10.10.10.1' },
  ];

  const ipv6Presets = [
    { label: 'SLAAC /64 (Standard)', prefix: 64, ip: 'fd00:10:10::' },
    { label: 'Site /48 (Enterprise)', prefix: 48, ip: '2001:db8:acad::' },
    { label: 'ISP /56 (Delegation)', prefix: 56, ip: '2001:db8:cafe::' },
    { label: 'Router P2P /126', prefix: 126, ip: 'fd00:ffff::' },
    { label: 'RFC 6164 /127', prefix: 127, ip: 'fd00:dead::' },
    { label: 'Loopback /128', prefix: 128, ip: '::1' },
  ];

  const maxPrefix = protocol === 'IPv4' ? 32 : 128;

  return (
    <div className="p-3.5 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Calculator className="w-5 h-5 text-indigo-400" />
            Dual-Stack Subnet & Capacity Calculator
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 font-mono">
            High-precision network math for both IPv4 32-bit and IPv6 128-bit address architectures.
          </p>
        </div>

        {/* Protocol Selector Toggle */}
        <div className="inline-flex p-1 rounded-xl bg-slate-900/90 border border-slate-700/60 self-start sm:self-auto">
          <button
            onClick={() => handleProtocolToggle('IPv4')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
              protocol === 'IPv4'
                ? 'bg-indigo-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            IPv4
          </button>
          <button
            onClick={() => handleProtocolToggle('IPv6')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
              protocol === 'IPv6'
                ? 'bg-cyan-500 text-slate-950 shadow-sm font-extrabold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            IPv6 (128-bit)
          </button>
        </div>
      </div>

      {/* Input Panel */}
      <div className={`p-4 sm:p-5 rounded-2xl border ${
        isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200'
      }`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-end">
          {/* IP Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                {protocol} Network / Host Address
              </label>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                protocol === 'IPv6' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
              }`}>
                {protocol}
              </span>
            </div>
            <input
              type="text"
              value={ipInput}
              onChange={(e) => handleIpChange(e.target.value)}
              placeholder={protocol === 'IPv4' ? 'e.g. 10.10.10.0' : 'e.g. fd00:10:10:: or 2001:db8::'}
              className={`w-full px-3.5 py-2 rounded-xl text-xs font-mono font-bold border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                isDark ? 'bg-slate-900/80 border-slate-700/60 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            />
          </div>

          {/* Prefix Slider & Dropdown */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                CIDR Prefix Length (/{prefixInput})
              </label>
              <span className={`text-xs font-mono font-bold ${protocol === 'IPv6' ? 'text-cyan-400' : 'text-indigo-400'}`}>
                /{prefixInput}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max={maxPrefix}
                value={prefixInput}
                onChange={(e) => setPrefixInput(parseInt(e.target.value, 10))}
                className={`w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer ${
                  protocol === 'IPv6' ? 'accent-cyan-400' : 'accent-indigo-500'
                }`}
              />
              <select
                value={prefixInput}
                onChange={(e) => setPrefixInput(parseInt(e.target.value, 10))}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border ${
                  isDark ? 'bg-slate-900/80 border-slate-700/60 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                {protocol === 'IPv4' ? (
                  Array.from({ length: 33 }, (_, i) => 32 - i).map(p => (
                    <option key={p} value={p}>/{p}</option>
                  ))
                ) : (
                  [128, 127, 126, 120, 112, 96, 64, 60, 56, 52, 48, 44, 40, 36, 32, 28, 24, 16, 8, 0].map(p => (
                    <option key={p} value={p}>/{p}</option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
              {protocol} Architecture Presets
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(protocol === 'IPv4' ? ipv4Presets : ipv6Presets).map(preset => (
                <button
                  key={preset.label}
                  onClick={() => {
                    setIpInput(preset.ip);
                    setPrefixInput(preset.prefix);
                  }}
                  className={`px-2 py-1 rounded-lg text-[11px] font-mono font-medium transition-all active:scale-95 border ${
                    protocol === 'IPv6'
                      ? 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border-cyan-500/20'
                      : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border-indigo-500/20'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {calcError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
            {calcError}
          </div>
        )}
      </div>

      {/* Results Grid */}
      {calcResult && (
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 font-mono">
            {/* Normalized Network CIDR */}
            <div className={`p-3.5 sm:p-4 rounded-2xl border ${
              isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Normalized Network CIDR
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  calcResult.ipVersion === 'IPv6' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-indigo-500/10 text-indigo-400'
                }`}>
                  {calcResult.ipVersion}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm sm:text-base font-bold text-indigo-400 break-all">
                  {calcResult.cidr}
                </span>
                <button
                  onClick={() => handleCopy(calcResult.cidr, 'cidr')}
                  className="p-1 rounded text-slate-400 hover:text-slate-200 ml-1 shrink-0"
                >
                  {copiedKey === 'cidr' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {calcResult.prefixType || 'Base routing boundary'}
              </span>
            </div>

            {/* Usable Host Capacity */}
            <div className={`p-3.5 sm:p-4 rounded-2xl border ${
              isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200'
            }`}>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Host Capacity ({calcResult.ipVersion === 'IPv6' ? '128-bit' : '32-bit'})
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-base sm:text-lg font-bold text-emerald-400 truncate">
                  {calcResult.usableHostsFormatted || calcResult.usableHosts.toLocaleString()}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {calcResult.ipVersion === 'IPv6' 
                  ? `2^${128 - calcResult.prefix} Addressable Nodes` 
                  : `${calcResult.totalHosts.toLocaleString()} Total (Excl. Net/Bcast)`}
              </span>
            </div>

            {/* Subnet Mask / Hex Mask */}
            <div className={`p-3.5 sm:p-4 rounded-2xl border ${
              isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200'
            }`}>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                {calcResult.ipVersion === 'IPv6' ? 'Hex Subnet Mask' : 'Subnet Mask (Dotted)'}
              </span>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-purple-400 break-all">
                  {calcResult.netmask}
                </span>
                <button
                  onClick={() => handleCopy(calcResult.netmask, 'mask')}
                  className="p-1 rounded text-slate-400 hover:text-slate-200 ml-1 shrink-0"
                >
                  {copiedKey === 'mask' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block truncate">
                Wildcard: {calcResult.wildcard}
              </span>
            </div>

            {/* Segment Classification */}
            <div className={`p-3.5 sm:p-4 rounded-2xl border ${
              isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200'
            }`}>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Routing Classification
              </span>
              <div className="mt-2 flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1.5 border ${
                  calcResult.isPrivate 
                    ? 'bg-slate-700/40 text-slate-300 border-slate-600/30' 
                    : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                }`}>
                  {calcResult.isPrivate ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                  {calcResult.isPrivate ? (calcResult.ipVersion === 'IPv6' ? 'IPv6 ULA Private' : 'RFC 1918 Private') : 'Public Global Unicast'}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 mt-2 block">
                {calcResult.isPrivate 
                  ? (calcResult.ipVersion === 'IPv6' ? 'Unique Local Address (fc00::/7)' : 'Non-routable on public internet') 
                  : 'Globally Routable BGP Anycast/Internet'}
              </span>
            </div>
          </div>

          {/* Deep Breakdown Table */}
          <div className={`p-4 sm:p-5 rounded-2xl border ${
            isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200'
          }`}>
            <h3 className="text-sm font-bold text-white mb-3 sm:mb-4 flex items-center gap-2 font-mono">
              <Binary className="w-4 h-4 text-cyan-400" />
              Detailed {calcResult.ipVersion} Subnet Architecture Specification
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 text-xs font-mono">
              <div className={`p-3.5 sm:p-4 rounded-xl border space-y-2.5 ${
                isDark ? 'bg-slate-900/60 border-slate-700/50' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex justify-between border-b pb-2 border-slate-700/50 items-center">
                  <span className="text-slate-400">First Usable Host</span>
                  <span className="font-bold text-emerald-400 break-all text-right">{calcResult.firstUsableHost}</span>
                </div>
                <div className="flex justify-between border-b pb-2 border-slate-700/50 items-center">
                  <span className="text-slate-400">Last Host in Range</span>
                  <span className="font-bold text-emerald-400 break-all text-right">{calcResult.lastUsableHost}</span>
                </div>
                <div className="flex justify-between border-b pb-2 border-slate-700/50 items-center">
                  <span className="text-slate-400">
                    {calcResult.ipVersion === 'IPv6' ? 'End-of-Prefix Boundary' : 'Broadcast Address'}
                  </span>
                  <span className="font-bold text-amber-400 break-all text-right">{calcResult.broadcastAddress}</span>
                </div>
                {calcResult.expandedAddress && (
                  <div className="space-y-1 border-t pt-2 border-slate-700/50">
                    <span className="text-slate-400 block text-[10px] uppercase">Expanded RFC 4291 Format</span>
                    <span className="text-slate-300 font-mono text-[11px] break-all block">{calcResult.expandedAddress}</span>
                  </div>
                )}
              </div>

              <div className={`p-3.5 sm:p-4 rounded-xl border space-y-2.5 ${
                isDark ? 'bg-slate-900/60 border-slate-700/50' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="space-y-1">
                  <span className="text-slate-400 block text-[10px] uppercase">
                    {calcResult.ipVersion === 'IPv6' ? '128-bit Binary Prefix Allocation' : '32-bit Binary Netmask'}
                  </span>
                  <span className="text-cyan-400 font-bold tracking-wider text-[10px] sm:text-[11px] break-all block leading-relaxed">
                    {calcResult.binaryNetmask}
                  </span>
                </div>
                <div className="space-y-1 border-t pt-2 border-slate-700/50">
                  <span className="text-slate-400 block text-[10px] uppercase">CIDR Bitmask Distribution</span>
                  <span className="text-purple-400 font-bold">
                    {prefixInput} bits Network / {(calcResult.ipVersion === 'IPv6' ? 128 : 32) - prefixInput} bits Host
                  </span>
                </div>
                {calcResult.compressedAddress && (
                  <div className="space-y-1 border-t pt-2 border-slate-700/50">
                    <span className="text-slate-400 block text-[10px] uppercase">Canonical RFC 5952 Compressed</span>
                    <span className="text-cyan-300 font-mono text-[11px] break-all block font-bold">{calcResult.compressedAddress}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
