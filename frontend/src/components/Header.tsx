import React from "react";
import { ModelInfo } from "../types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Sparkles, HelpCircle } from "lucide-react";

interface HeaderProps {
  info: ModelInfo | null;
  error?: string | null;
  onOpenHelp?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ info, error, onOpenHelp }) => {
  return (
    <header className="flex items-center justify-between gap-4 px-6 py-3 bg-[#0c0e17] border-b border-white/[0.08] shrink-0 select-none max-[1100px]:px-4 max-[1100px]:py-2.5 max-[1100px]:flex-wrap">
      {/* Brand Identity */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 p-[1px] shadow-sm shadow-indigo-500/20">
          <div className="w-full h-full bg-[#0c0e17] rounded-[7px] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight text-slate-100 m-0">
              AI Neuroscope
            </h1>
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 text-slate-400 border-white/[0.06]">
              v1.2
            </Badge>
          </div>
          <p className="text-[11px] text-slate-400 font-normal leading-none mt-0.5">
            Mechanistic Interpretability &amp; Circuit Explorer
          </p>
        </div>
      </div>

      {/* Model Spec Badge */}
      <div className="flex items-center gap-2">
        <div 
          id="model-badge" 
          className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-xs font-mono"
        >
          {error ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span className="text-rose-400">Offline</span>
            </>
          ) : info ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] pulse-live" />
              <span className="text-slate-300 font-medium">{info.model_name}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400 text-[11px]">{info.num_layers}L × {info.num_heads}H</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400 text-[11px]">{info.mlp_dim.toLocaleString()} MLP</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 pulse-busy" />
              <span className="text-slate-400">Connecting…</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 text-xs">
        {onOpenHelp && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenHelp}
            className="text-slate-400 hover:text-slate-200 gap-1.5 text-xs h-7 px-2.5"
            title="Shortcuts & Documentation (?)"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="max-[700px]:hidden">Guide</span>
            <kbd className="text-[10px] bg-white/[0.08] border border-white/[0.1] px-1 py-0.2 rounded text-slate-300 font-mono">?</kbd>
          </Button>
        )}

        <a
          href="https://github.com/sunjay-dev/ai_neuroscope"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-white/[0.03] border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
          title="View on GitHub"
          aria-label="GitHub Repository"
        >
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
        </a>
      </div>
    </header>
  );
};
