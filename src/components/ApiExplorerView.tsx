import React, { useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { 
  Code2, 
  Play, 
  Copy, 
  Check, 
  Send, 
  Terminal, 
  Server, 
  Database, 
  Network, 
  Hash,
  Sparkles
} from 'lucide-react';

interface ApiEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  title: string;
  description: string;
  defaultParams?: Record<string, string>;
  defaultBody?: any;
}

export const ApiExplorerView: React.FC = () => {
  const { subnets, datacenters, isDark } = useIPAM();
  const sampleSubnetId = subnets[0]?.id || 'sub-east-app';

  const endpoints: ApiEndpoint[] = [
    {
      id: 'subnets-list',
      method: 'GET',
      path: '/api/subnets',
      title: 'List All Subnets',
      description: 'Retrieve all allocated IPv4 prefixes with VLAN and Datacenter bindings.',
    },
    {
      id: 'next-available-ip',
      method: 'GET',
      path: `/api/subnets/${sampleSubnetId}/next-available-ip`,
      title: 'Find Next Available IP in Subnet',
      description: 'Calculates the next unallocated host IP address in the specified subnet block.',
    },
    {
      id: 'reserve-next-ip',
      method: 'POST',
      path: `/api/subnets/${sampleSubnetId}/reserve-next-ip`,
      title: 'Reserve Next Available IP in Subnet',
      description: 'Atomically finds and marks the next available IP as Reserved for a specified device/purpose.',
      defaultBody: {
        assignedDevice: 'api-provisioned-node01.internal',
        description: 'Auto-provisioned via Terraform / IPAM API',
      },
    },
    {
      id: 'ips-list',
      method: 'GET',
      path: '/api/ips?status=Active',
      title: 'List Active IP Assignments',
      description: 'Query IP inventory filtered by status, subnet, or datacenter.',
    },
    {
      id: 'assign-ip',
      method: 'POST',
      path: '/api/ips',
      title: 'Assign Specific IP Address',
      description: 'Assigns an exact host IP with mathematical validation against the parent CIDR block.',
      defaultBody: {
        ipAddress: '10.10.10.99',
        subnetId: sampleSubnetId,
        status: 'Active',
        assignedDevice: 'ingress-gw-99.east',
        description: 'Directly assigned via IPAM REST API',
      },
    },
    {
      id: 'bulk-generate',
      method: 'POST',
      path: `/api/subnets/${sampleSubnetId}/bulk-generate-ips`,
      title: 'Bulk Generate IP Pool Entries',
      description: 'Pre-populates a range of IP address slots into the subnet pool.',
      defaultBody: {
        count: 10,
        startingOffset: 5,
        status: 'Available',
      },
    },
    {
      id: 'stats',
      method: 'GET',
      path: '/api/stats',
      title: 'Get IPAM Aggregated Metrics',
      description: 'Returns real-time utilization stats, allocation counts, and datacenter loads.',
    },
    {
      id: 'datacenters',
      method: 'GET',
      path: '/api/datacenters',
      title: 'List Datacenters',
      description: 'Fetch all geographic datacenter isolation zones.',
    },
    {
      id: 'vlans',
      method: 'GET',
      path: '/api/vlans',
      title: 'List VLANs',
      description: 'Fetch all VLANs (scoped per Datacenter).',
    },
  ];

  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint>(endpoints[0]);
  const [requestUrl, setRequestUrl] = useState<string>(endpoints[0].path);
  const [requestBody, setRequestBody] = useState<string>(
    endpoints[0].defaultBody ? JSON.stringify(endpoints[0].defaultBody, null, 2) : ''
  );
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseHeaders, setResponseHeaders] = useState<string>('');
  const [responseData, setResponseData] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedCurl, setCopiedCurl] = useState<boolean>(false);

  const handleSelectEndpoint = (ep: ApiEndpoint) => {
    setSelectedEndpoint(ep);
    setRequestUrl(ep.path);
    setRequestBody(ep.defaultBody ? JSON.stringify(ep.defaultBody, null, 2) : '');
    setResponseStatus(null);
    setResponseData('');
  };

  const handleExecute = async () => {
    setLoading(true);
    setResponseStatus(null);
    setResponseData('');

    try {
      const options: RequestInit = {
        method: selectedEndpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      };

      if (selectedEndpoint.method !== 'GET' && requestBody.trim()) {
        options.body = requestBody;
      }

      const startTime = performance.now();
      const res = await fetch(requestUrl, options);
      const elapsed = Math.round(performance.now() - startTime);

      setResponseStatus(res.status);
      const headersObj: Record<string, string> = {};
      res.headers.forEach((val, key) => { headersObj[key] = val; });
      setResponseHeaders(JSON.stringify(headersObj, null, 2));

      const json = await res.json();
      setResponseData(JSON.stringify(json, null, 2));
    } catch (err: any) {
      setResponseStatus(500);
      setResponseData(JSON.stringify({ error: err.message || 'Request failed' }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const curlCommand = `curl -X ${selectedEndpoint.method} "https://${window.location.host}${requestUrl}" \\
  -H "Content-Type: application/json"${selectedEndpoint.method !== 'GET' && requestBody ? ` \\
  -d '${requestBody.replace(/\n/g, '')}'` : ''}`;

  const copyCurl = () => {
    navigator.clipboard.writeText(curlCommand);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Code2 className="w-5 h-5 text-indigo-400" />
          Interactive REST API & Automation Explorer
        </h1>
        <p className="text-xs text-slate-400 mt-1 font-mono">
          Test live JSON endpoints for IP reservation automation, subnet queries, and DevOps integration.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 1 Col: Endpoints Menu */}
        <div className={`p-4 rounded-2xl border space-y-2 ${
          isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200'
        }`}>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 block mb-2 font-mono">
            Available Endpoints
          </span>

          <div className="space-y-1.5 max-h-[70vh] overflow-y-auto">
            {endpoints.map((ep) => {
              const isSelected = selectedEndpoint.id === ep.id;
              const isGet = ep.method === 'GET';
              const isPost = ep.method === 'POST';

              return (
                <button
                  key={ep.id}
                  onClick={() => handleSelectEndpoint(ep)}
                  className={`w-full text-left p-2.5 rounded-xl transition-all border ${
                    isSelected
                      ? isDark
                        ? 'bg-indigo-950/40 border-indigo-500/80 text-indigo-200 ring-1 ring-indigo-500/40'
                        : 'bg-indigo-50 border-indigo-300 text-indigo-900 ring-1 ring-indigo-300'
                      : isDark
                        ? 'border-transparent hover:bg-slate-700/30 text-slate-300'
                        : 'border-transparent hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] uppercase border ${
                      isGet 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    }`}>
                      {ep.method}
                    </span>
                    <span className="font-semibold text-xs truncate">{ep.title}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 block mt-1 truncate">
                    {ep.path}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right 2 Cols: Request Runner & Response Viewer */}
        <div className="lg:col-span-2 space-y-6">
          {/* Request Config Card */}
          <div className={`p-5 rounded-2xl border space-y-4 ${
            isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-4 border-slate-700/50">
              <div>
                <h3 className="font-bold text-sm text-white">{selectedEndpoint.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">{selectedEndpoint.description}</p>
              </div>

              <button
                onClick={copyCurl}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700/50 flex items-center gap-1.5 self-start sm:self-auto transition-colors"
              >
                {copiedCurl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy cURL</span>
              </button>
            </div>

            {/* URL Input Bar */}
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1.5 rounded-lg font-mono font-bold text-xs uppercase border ${
                selectedEndpoint.method === 'GET' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
              }`}>
                {selectedEndpoint.method}
              </span>
              <input
                type="text"
                value={requestUrl}
                onChange={(e) => setRequestUrl(e.target.value)}
                className={`flex-1 px-3.5 py-1.5 rounded-lg text-xs font-mono border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                  isDark ? 'bg-slate-900/80 border-slate-700/60 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800'
                }`}
              />
              <button
                onClick={handleExecute}
                disabled={loading}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 flex items-center gap-1.5 disabled:opacity-50 transition-all active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{loading ? 'Sending...' : 'Send Request'}</span>
              </button>
            </div>

            {/* Request Body (if POST/PUT) */}
            {selectedEndpoint.method !== 'GET' && (
              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                  Request Payload (JSON Body)
                </label>
                <textarea
                  rows={4}
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  className={`w-full p-3 rounded-xl text-xs font-mono border focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>
            )}
          </div>

          {/* Response Viewer */}
          <div className={`p-5 rounded-2xl border space-y-3 ${
            isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Response Payload</span>
              </div>

              {responseStatus !== null && (
                <span className={`px-2.5 py-0.5 rounded-full font-mono text-xs font-bold border ${
                  responseStatus >= 200 && responseStatus < 300
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}>
                  HTTP {responseStatus}
                </span>
              )}
            </div>

            <div className={`p-4 rounded-xl border max-h-96 overflow-y-auto font-mono text-xs ${
              isDark ? 'bg-slate-950 border-slate-800 text-emerald-400' : 'bg-slate-900 text-emerald-300 border-slate-800'
            }`}>
              {loading ? (
                <div className="py-8 text-center text-slate-400">Executing REST call...</div>
              ) : responseData ? (
                <pre>{responseData}</pre>
              ) : (
                <span className="text-slate-500 italic">Click "Send Request" to view live JSON response</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
