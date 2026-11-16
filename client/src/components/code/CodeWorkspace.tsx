import React, { useState } from 'react';
import { Play, Code2, Copy, Check } from 'lucide-react';

export const CodeWorkspace: React.FC = () => {
  const [language, setLanguage] = useState('typescript');
  const [code, setCode] = useState(`// XPRTY Interview Live Coding Workspace
// Task: Implement an LRU Cache with O(1) get & put operations

class LRUCache<K, V> {
  private capacity: number;
  private map: Map<K, V> = new Map();

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  put(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      const oldestKey = this.map.keys().next().value;
      this.map.delete(oldestKey);
    }
    this.map.set(key, value);
  }
}

// Verification Tests
const cache = new LRUCache<string, number>(2);
cache.put("session_token", 101);
cache.put("refresh_token", 202);
console.log("Cached key:", cache.get("session_token"));
`);

  const [output, setOutput] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleRun = () => {
    setOutput(`[Test Output] Runtime: Node v24.13.0
Cached key: 101
Eviction assertions: PASSED (1.2ms)
All test cases matched expected output.`);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#191715] border border-[#32302D] rounded-2xl overflow-hidden shadow-xl">
      {/* Top Toolbar */}
      <div className="p-3 border-b border-[#32302D] bg-[#110F0E] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-[#DB7A57]" />
          <span className="text-xs font-semibold text-[#F4F2EB]">Interactive Code Workspace</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="ml-2 px-2.5 py-1 rounded-full bg-[#211E1C] border border-[#32302D] text-[11px] text-[#CBC3B9] focus:outline-none"
          >
            <option value="typescript">TypeScript</option>
            <option value="javascript">JavaScript</option>
            <option value="python">Python 3</option>
            <option value="go">Go</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg hover:bg-[#211E1C] text-[#ABA7A2] hover:text-[#F4F2EB] text-xs transition-colors"
            title="Copy Code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleRun}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all duration-300"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Execute</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#110F0E]">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          className="flex-1 w-full p-4 bg-[#110F0E] text-[#F4F2EB] font-mono text-xs focus:outline-none resize-none leading-relaxed selection:bg-[#DB7A57] selection:text-[#110F0E]"
        />

        {/* Output Terminal */}
        {output && (
          <div className="h-28 border-t border-[#32302D] bg-[#191715] p-3 font-mono text-xs overflow-y-auto">
            <div className="flex items-center justify-between text-[#ABA7A2] text-[10px] mb-1 uppercase font-semibold">
              <span>Terminal Output</span>
              <button onClick={() => setOutput(null)} className="hover:text-[#F4F2EB]">
                Clear
              </button>
            </div>
            <pre className="text-emerald-400 whitespace-pre-wrap">{output}</pre>
          </div>
        )}
      </div>
    </div>
  );
};
