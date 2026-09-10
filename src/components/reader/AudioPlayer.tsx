"use client";

import React, { useState } from "react";
import { Play, Pause, Square, Volume2, FastForward, Settings2, X } from "lucide-react";
import type { TTSState } from "@/hooks/useTTS";

interface AudioPlayerProps {
  tts: TTSState & {
    togglePlayPause: () => void;
    stop: () => void;
    setRate: (rate: number) => void;
    setVoice: (uri: string) => void;
  };
}

export default function AudioPlayer({ tts }: AudioPlayerProps) {
  const [showSettings, setShowSettings] = useState(false);

  if (!tts.isPlaying && !showSettings) {
    // Show a collapsed mini button when not playing
    return (
      <button
        onClick={() => setShowSettings(true)}
        className="fixed bottom-24 right-6 w-11 h-11 bg-white rounded-full shadow-xl flex items-center justify-center text-emerald-600 hover:scale-110 transition z-40 border border-stone-200"
        title="Trình phát Audio"
      >
        <Volume2 className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-sm bg-white/95 backdrop-blur-xl border border-stone-200/80 rounded-3xl shadow-2xl z-50 overflow-hidden animate-fade-in-scale">
      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 border-b border-stone-100 bg-stone-50/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-stone-500 uppercase">Cài đặt Audio</span>
            <button onClick={() => setShowSettings(false)} className="text-stone-400 hover:text-stone-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs text-stone-600 mb-1.5 block font-medium">Giọng đọc</label>
              <select 
                value={tts.voiceURI || ""} 
                onChange={e => tts.setVoice(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-stone-200 bg-white outline-none"
              >
                {tts.voices.map(v => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs text-stone-600 font-medium">Tốc độ</label>
                <span className="text-xs font-mono text-emerald-600 font-bold">{tts.rate.toFixed(1)}x</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="2.0" 
                step="0.1" 
                value={tts.rate}
                onChange={e => tts.setRate(parseFloat(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Player Bar */}
      <div className="flex items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${tts.isPlaying && !tts.isPaused ? "bg-emerald-500 animate-pulse" : "bg-stone-300"}`} />
          <span className="text-xs font-semibold text-stone-700">
            {tts.isPlaying && !tts.isPaused ? "Đang đọc..." : tts.isPaused ? "Tạm dừng" : "Sẵn sàng"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-full transition ${showSettings ? "bg-emerald-100 text-emerald-700" : "text-stone-500 hover:bg-stone-100"}`}
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <button
            onClick={tts.stop}
            disabled={!tts.isPlaying}
            className="p-2 text-stone-500 hover:bg-stone-100 hover:text-red-500 rounded-full transition disabled:opacity-50"
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            onClick={tts.togglePlayPause}
            className="w-10 h-10 flex items-center justify-center bg-emerald-600 text-white rounded-full hover:bg-emerald-700 hover:scale-105 active:scale-95 shadow-md shadow-emerald-500/20 transition"
          >
            {tts.isPlaying && !tts.isPaused ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
