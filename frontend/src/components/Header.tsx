import React from "react";
import { ModelInfo } from "../types";
import { Badge } from "./ui/badge";

interface HeaderProps {
  info: ModelInfo | null;
  error?: string | null;
}

export const Header: React.FC<HeaderProps> = ({ info, error }) => {
  return (
    <header className="flex items-center justify-between gap-4 px-7 py-3.5 bg-[#131627] border-b border-[#1e2235] shrink-0 max-[1100px]:px-4 max-[1100px]:py-3 max-[1100px]:flex-wrap">
      <div className="flex items-center gap-3">
        <div className="w-[38px] h-[38px] bg-gradient-to-br from-[#7c6af0] to-[#c47af0] rounded-[10px] flex items-center justify-center text-[18px]">
          🧠
        </div>
        <div>
          <h1 className="text-[18px] font-semibold tracking-[-0.3px] text-[#e8eaf6] m-0 leading-tight">
            AI Neuroscope
          </h1>
          <p className="text-[11px] text-[#8892b0] mt-[1px] m-0">
            Live Neuron Circuit Explorer
          </p>
        </div>
      </div>

      <div className="text-[13px] text-[#8892b0] italic max-[1100px]:hidden">
        See what the AI is thinking.
      </div>

      <div className="flex items-center gap-2 text-[13px] text-[#8892b0]">
        Model{" "}
        <Badge variant="model" id="model-badge">
          {error
            ? "offline"
            : info
            ? `${info.model_name} · ${info.num_layers}L × ${info.num_heads}H`
            : "connecting…"}
        </Badge>
      </div>
    </header>
  );
};
