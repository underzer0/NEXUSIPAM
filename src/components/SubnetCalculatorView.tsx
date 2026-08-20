import React, { useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { 
  Calculator, 
  Layers, 
  Network, 
  Lock, 
  Globe, 
  Binary, 
  Copy, 
  Check, 
  ArrowRight, 
  Sliders,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { parseCIDR, isValidCIDR, isValidIPv4, isPrivateRFC1918 } from '../utils/ipCalculator';

export const SubnetCalculatorView: React.FC = () => {
  const { isDark } = useIPAM();
  const [ipInput, setIpInput] = useState('10.10.10.0');
  const [prefixInput, setPrefixInput] = useState(24);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const cidrString = `${ipInput.trim()}/${prefixInput}`;
  let calcResult = null;
  let calcError = null;

  try {
    if (isValidIPv4(ipInput.trim())) {
      calcResult = parseCIDR(cidrString);
    } else {
      calcError = 'Please enter a valid IPv4 address (e.g. 10.10.10.0)';
    }
  } catch (err: any) {
    calcError = err.message || 'Invalid calculation';
  }

  const handleCopy = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Calculator className="w-5 h-5 text-indigo-400" />
          IPv4 Subnet & CIDR Capacity Calculator
        </h1>
        <p className="text-xs text-slate-400 mt-1 font-mono">
          Perform network math, wildcard calculations, binary mask breakdowns, and host capacity planning.
        </p>
      </div>

      {/* Input Panel */}
      <div className={`p-5 rounded-2xl border ${
        isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200'
      }`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          {/* IP Input */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
              IPv4 Network / Host Address
            </label>
            <input
              type="text"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              placeholder="e.g. 10.10.10.0"
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
              <span className="text-xs font-mono font-bold text-indigo-400">/{prefixInput}</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="32"
                value={prefixInput}
                onChange={(e) => setPrefixInput(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <select
                value={prefixInput}
                onChange={(e) => setPrefixInput(parseInt(e.target.value, 10))}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border ${
                  isDark ? 'bg-slate-900/80 border-slate-700/60 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                {Array.from({ length: 33 }, (_, i) => 32 - i).map(p => (
                  <option key={p} value={p}>/{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Common Enterprise Presets
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { label: 'RFC1918 Class C (/24)', prefix: 24, ip: '192.168.1.0' },
                { label: 'Cloud VPC Tier (/20)', prefix: 20, ip: '10.10.0.0' },
                { label: 'App Cluster (/26)', prefix: 26, ip: '172.16.50.0' },
                { label: 'Point-to-Point (/30)', prefix: 30, ip: '10.0.0.0' },
              ].map(preset => (
                <button
                  key={preset.label}
                  onClick={() => {
                    setIpInput(preset.ip);
                    setPrefixInput(preset.prefix);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all active:scale-95"
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
            {/* Network Address */}
            <div className={`p-4 rounded-2xl border ${
              isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200'
            }`}>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Normalized Network Address
              </span>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-lg font-bold text-indigo-400">
                  {calcResult.cidr}
                </span>
                <button
                  onClick={() => handleCopy(calcResult.cidr, 'cidr')}
                  className="p-1 rounded text-slate-400 hover:text-slate-200"
                >
                  {copiedKey === 'cidr' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Base boundary identifier</span>
            </div>

            {/* Usable Host Capacity */}
            <div className={`p-4 rounded-2xl border ${
              isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200'
            }`}>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Usable Host Capacity
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl font-bold text-emerald-400">
                  {calcResult.usableHosts.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400">
                  {calcResult.totalHosts.toLocaleString()} Total
                </span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Excluding network & broadcast</span>
            </div>

            {/* Subnet Mask */}
            <div className={`p-4 rounded-2xl border ${
              isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200'
            }`}>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Subnet Mask (Dotted)
              </span>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-base font-bold text-purple-400">
                  {calcResult.netmask}
                </span>
                <button
                  onClick={() => handleCopy(calcResult.netmask, 'mask')}
                  className="p-1 rounded text-slate-400 hover:text-slate-200"
                >
                  {copiedKey === 'mask' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Wildcard: {calcResult.wildcard}</span>
            </div>

            {/* Segment Classification */}
            <div className={`p-4 rounded-2xl border ${
              isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200'
            }`}>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                RFC Routing Classification
              </span>
              <div className="mt-2 flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1.5 border ${
                  calcResult.isPrivate 
                    ? 'bg-slate-700/40 text-slate-300 border-slate-600/30' 
                    : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                }`}>
                  {calcResult.isPrivate ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                  {calcResult.isPrivate ? 'RFC 1918 Private' : 'Publicly Routable'}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 mt-2 block">
                {calcResult.isPrivate ? 'Non-routable on public internet' : 'BGP Anycast / Public ASN'}
              </span>
            </div>
          </div>

          {/* Deep Breakdown Table */}
          <div className={`p-5 rounded-2xl border ${
            isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200'
          }`}>
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Binary className="w-4 h-4 text-cyan-400" />
              Detailed Network & Binary Specification
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className={`p-4 rounded-xl border space-y-2.5 ${
                isDark ? 'bg-slate-900/60 border-slate-700/50' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex justify-between border-b pb-2 border-slate-700/50">
                  <span className="text-slate-400">First Usable Host</span>
                  <span className="font-bold text-emerald-400">{calcResult.firstUsableHost}</span>
                </div>
                <div className="flex justify-between border-b pb-2 border-slate-700/50">
                  <span className="text-slate-400">Last Usable Host</span>
                  <span className="font-bold text-emerald-400">{calcResult.lastUsableHost}</span>
                </div>
                <div className="flex justify-between border-b pb-2 border-slate-700/50">
                  <span className="text-slate-400">Broadcast Address</span>
                  <span className="font-bold text-amber-400">{calcResult.broadcastAddress}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Wildcard Mask</span>
                  <span className="font-bold text-slate-200">{calcResult.wildcard}</span>
                </div>
              </div>

              <div className={`p-4 rounded-xl border space-y-2.5 ${
                isDark ? 'bg-slate-900/60 border-slate-700/50' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="space-y-1">
                  <span className="text-slate-400 block text-[10px] uppercase">Binary Netmask</span>
                  <span className="text-cyan-400 font-bold tracking-wider">{calcResult.binaryNetmask}</span>
                </div>
                <div className="space-y-1 border-t pt-2 border-slate-700/50">
                  <span className="text-slate-400 block text-[10px] uppercase">CIDR Bitmask</span>
                  <span className="text-purple-400 font-bold">{prefixInput} bits Network / {32 - prefixInput} bits Host</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
