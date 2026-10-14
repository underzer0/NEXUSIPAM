import React, { useState } from 'react';
import { Calculator, Code2 } from 'lucide-react';
import { SubnetCalculatorView } from './SubnetCalculatorView';
import { ApiExplorerView } from './ApiExplorerView';

const TOOLS = [
  { id: 'calculator', label: 'Subnet calculator', icon: Calculator },
  { id: 'api', label: 'API explorer', icon: Code2 },
] as const;

export const ToolsView: React.FC = () => {
  const [tool, setTool] = useState<(typeof TOOLS)[number]['id']>('calculator');

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Tools</h1>
        <div role="tablist" aria-label="Tools" className="flex rounded-xl bg-zinc-200/70 p-1 dark:bg-zinc-800">
          {TOOLS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tool === id}
              onClick={() => setTool(id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition cursor-pointer ${
                tool === id
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>
      {tool === 'calculator' ? <SubnetCalculatorView /> : <ApiExplorerView />}
    </div>
  );
};
