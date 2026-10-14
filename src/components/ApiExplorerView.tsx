import React, { useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { Check, Copy, Send } from 'lucide-react';
import { card, chip, input, muted, primaryButton, secondaryButton } from './ui';

type Method = 'GET' | 'POST';

interface ApiEndpoint {
  method: Method;
  path: string;
  title: string;
  body?: object;
}

const METHOD_STYLE: Record<Method, string> = {
  GET: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  POST: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
};

export const ApiExplorerView: React.FC = () => {
  const { subnets, datacenters, vlans } = useIPAM();
  const subnetId = subnets[0]?.id || ':subnetId';
  const dcId = datacenters[0]?.id || ':datacenterId';

  // Read-only requests first, so the default selection never changes data.
  const endpoints: ApiEndpoint[] = [
    { method: 'GET', path: '/api/stats', title: 'Usage stats' },
    { method: 'GET', path: '/api/datacenters', title: 'List datacenters' },
    { method: 'GET', path: '/api/vlans', title: 'List VLANs' },
    { method: 'GET', path: '/api/subnets', title: 'List subnets' },
    { method: 'GET', path: '/api/ips?status=Active', title: 'List active IPs' },
    { method: 'GET', path: `/api/subnets/${subnetId}/next-available-ip`, title: 'Next free IP in a subnet' },
    { method: 'GET', path: '/api/vlans/options', title: 'VLAN form options' },
    { method: 'GET', path: '/api/subnets/options', title: 'Subnet form options' },
    {
      method: 'POST',
      path: `/api/subnets/${subnetId}/reserve-next-ip`,
      title: 'Reserve next free IP',
      body: { assignedDevice: 'node01.internal', description: 'Reserved via API' },
    },
    {
      method: 'POST',
      path: '/api/ips',
      title: 'Assign an IP',
      body: { ipAddress: '10.10.0.99', subnetId, status: 'Active', assignedDevice: 'gateway-99', description: 'Assigned via API' },
    },
    {
      method: 'POST',
      path: '/api/vlans',
      title: 'Create a VLAN',
      body: { datacenterId: dcId, vlanId: 210, name: 'Database', description: 'Database servers' },
    },
    {
      method: 'POST',
      path: '/api/subnets',
      title: 'Create a subnet',
      body: { datacenterId: dcId, cidr: '10.210.0.0/24', vlanId: vlans[0]?.vlanId ?? 210, segmentType: 'Private', description: 'App servers' },
    },
    {
      method: 'POST',
      path: `/api/subnets/${subnetId}/bulk-generate-ips`,
      title: 'Bulk add IPs',
      body: { count: 10, startingOffset: 5, status: 'Available' },
    },
  ];

  const [selected, setSelected] = useState(0);
  const endpoint = endpoints[selected];
  const [requestUrl, setRequestUrl] = useState(endpoint.path);
  const [requestBody, setRequestBody] = useState('');
  const [response, setResponse] = useState<{ status: number; body: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const select = (i: number) => {
    setSelected(i);
    setRequestUrl(endpoints[i].path);
    setRequestBody(endpoints[i].body ? JSON.stringify(endpoints[i].body, null, 2) : '');
    setResponse(null);
  };

  const send = async () => {
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch(requestUrl, {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: endpoint.method !== 'GET' && requestBody.trim() ? requestBody : undefined,
      });
      const text = await res.text();
      let body = text;
      try {
        body = JSON.stringify(JSON.parse(text), null, 2);
      } catch {}
      setResponse({ status: res.status, body });
    } catch (err: any) {
      setResponse({ status: 0, body: err.message || 'Request failed' });
    } finally {
      setLoading(false);
    }
  };

  // The session cookie is httpOnly, so scripts outside the browser need their own token.
  const curl = [
    `curl -X ${endpoint.method} "${window.location.origin}${requestUrl}"`,
    '  -H "Content-Type: application/json"',
    '  -H "Authorization: Bearer <session-token>"',
    ...(endpoint.method !== 'GET' && requestBody ? [`  -d '${requestBody.replace(/\s*\n\s*/g, ' ')}'`] : []),
  ].join(' \\\n');

  const copyCurl = () => {
    navigator.clipboard.writeText(curl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ok = response && response.status >= 200 && response.status < 300;

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[18rem_1fr]">
      <nav aria-label="Endpoints" className={`${card} p-2`}>
        <ul className="space-y-0.5">
          {endpoints.map((ep, i) => (
            <li key={`${ep.method} ${ep.path}`}>
              <button
                type="button"
                aria-current={i === selected}
                onClick={() => select(i)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition cursor-pointer ${
                  i === selected
                    ? 'bg-indigo-500/10 font-semibold text-indigo-700 dark:text-indigo-300'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <span className={`${chip} w-12 justify-center font-mono text-[10px] font-bold ${METHOD_STYLE[ep.method]}`}>{ep.method}</span>
                <span className="truncate">{ep.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 space-y-4">
        <div className={`${card} space-y-4 p-5`}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <span className={`${chip} justify-center self-start px-3 py-2 font-mono text-xs font-bold sm:self-auto ${METHOD_STYLE[endpoint.method]}`}>{endpoint.method}</span>
            <input
              type="text"
              aria-label="Request URL"
              value={requestUrl}
              onChange={(e) => setRequestUrl(e.target.value)}
              spellCheck={false}
              className={`${input} min-w-0 flex-1 font-mono`}
            />
            <button type="button" onClick={send} disabled={loading} className={`${primaryButton} disabled:opacity-50`}>
              <Send className="h-4 w-4" /> {loading ? 'Sending…' : 'Send'}
            </button>
          </div>
          {endpoint.method !== 'GET' && (
            <>
              <p className="text-sm text-amber-700 dark:text-amber-300">This request changes real data.</p>
              <textarea
                aria-label="Request body"
                rows={6}
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                spellCheck={false}
                className={`${input} w-full resize-y font-mono text-xs`}
              />
            </>
          )}
        </div>

        <div className={`${card} space-y-3 p-5`}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">Response</h2>
            {response && (
              <span className={`${chip} font-mono ${ok ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'}`}>
                {response.status || 'Network error'}
              </span>
            )}
          </div>
          <pre className="max-h-96 overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-xs text-emerald-300">
            {loading ? 'Sending…' : response ? response.body : <span className="text-slate-500">Press Send to see the response.</span>}
          </pre>
        </div>

        <div className={`${card} space-y-3 p-5`}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">cURL</h2>
            <button type="button" onClick={copyCurl} className={secondaryButton}>
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />} Copy
            </button>
          </div>
          <pre className="overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-xs text-slate-300">{curl}</pre>
          <p className={`text-xs ${muted}`}>Every request needs a signed-in session. Signing requests with API keys isn't supported yet.</p>
        </div>
      </div>
    </div>
  );
};
