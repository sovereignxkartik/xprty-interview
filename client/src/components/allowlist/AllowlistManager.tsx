import React, { useState } from 'react';
import { ResourcePermission } from '../../types';
import { Globe, Plus, Trash2, ToggleLeft, ToggleRight, ExternalLink, ShieldCheck } from 'lucide-react';

interface AllowlistManagerProps {
  resources: ResourcePermission[];
  onAddResource: (domain: string, title: string, includeSubdomains: boolean) => void;
  onToggleResource: (id: string, isActive: boolean) => void;
  onDeleteResource: (id: string) => void;
  isInterviewer: boolean;
}

export const AllowlistManager: React.FC<AllowlistManagerProps> = ({
  resources,
  onAddResource,
  onToggleResource,
  onDeleteResource,
  isInterviewer
}) => {
  const [domain, setDomain] = useState('');
  const [title, setTitle] = useState('');
  const [includeSubdomains, setIncludeSubdomains] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return;

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
    onAddResource(cleanDomain, title.trim() || cleanDomain, includeSubdomains);
    setDomain('');
    setTitle('');
  };

  return (
    <div className="flex flex-col h-full bg-[#191715] border border-[#32302D] rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-4 border-b border-[#32302D] flex items-center justify-between bg-[#110F0E]">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#DB7A57]" />
          <h3 className="text-sm font-semibold text-[#F4F2EB]">Permitted Documentation</h3>
        </div>
        <span className="text-xs text-[#DB7A57] font-mono px-2.5 py-0.5 rounded-full bg-[#DB7A57]/10 border border-[#DB7A57]/30">
          {resources.filter(r => r.is_active).length} Active Domains
        </span>
      </div>

      {/* Add Domain Form */}
      {isInterviewer && (
        <form onSubmit={handleSubmit} className="p-3 bg-[#110F0E]/40 border-b border-[#32302D] space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="e.g. react.dev"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#211E1C] border border-[#32302D] text-xs text-[#F4F2EB] placeholder-[#ABA7A2] focus:outline-none focus:border-[#DB7A57]"
              required
            />
            <input
              type="text"
              placeholder="Doc Title (Optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#211E1C] border border-[#32302D] text-xs text-[#F4F2EB] placeholder-[#ABA7A2] focus:outline-none focus:border-[#DB7A57]"
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-[11px] text-[#ABA7A2] cursor-pointer">
              <input
                type="checkbox"
                checked={includeSubdomains}
                onChange={(e) => setIncludeSubdomains(e.target.checked)}
                className="rounded border-[#32302D] text-[#DB7A57] focus:ring-0 bg-[#211E1C]"
              />
              <span>Allow subdomains (*.domain.com)</span>
            </label>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#DB7A57] hover:bg-[#EA8D69] text-[#110F0E] text-xs font-semibold shadow-md transition-all duration-300"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Allow Domain</span>
            </button>
          </div>
        </form>
      )}

      {/* Domain List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {resources.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#ABA7A2] text-xs py-8">
            <Globe className="w-8 h-8 text-[#32302D] mb-2" />
            <p className="font-medium text-[#F4F2EB]">No external documentation allowed.</p>
            <p className="text-[11px] text-[#ABA7A2] mt-1">
              {isInterviewer ? 'Specify documentation websites permitted for this session.' : 'Interviewer has not allowed external documentation.'}
            </p>
          </div>
        ) : (
          resources.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                item.is_active
                  ? 'bg-[#211E1C] border-[#32302D]'
                  : 'bg-[#191715]/40 border-[#32302D]/40 opacity-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${item.is_active ? 'bg-[#DB7A57]/15 text-[#DB7A57]' : 'bg-[#191715] text-[#ABA7A2]'}`}>
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#F4F2EB]">{item.title}</span>
                    {item.include_subdomains && (
                      <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-[#110F0E] text-[#CBC3B9] border border-[#32302D]">
                        * subdomains
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-[#ABA7A2] mt-0.5">
                    <span>{item.domain}</span>
                    <a
                      href={`https://${item.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#DB7A57] transition-colors ml-1"
                      title="Open allowed resource"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {isInterviewer && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onToggleResource(item.id, !item.is_active)}
                    className="text-[#ABA7A2] hover:text-[#F4F2EB] transition-colors"
                  >
                    {item.is_active ? (
                      <ToggleRight className="w-6 h-6 text-[#DB7A57]" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-[#32302D]" />
                    )}
                  </button>
                  <button
                    onClick={() => onDeleteResource(item.id)}
                    className="p-1.5 rounded-lg hover:bg-rose-950/50 text-[#ABA7A2] hover:text-rose-400 transition-colors"
                    title="Remove domain"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
