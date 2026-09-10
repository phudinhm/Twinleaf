"use client";

import React, { useState, useEffect } from "react";
import { BookA, X, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface DictionaryDrawerProps {
  word: string;
  context: string;
  language: string;
  onClose: () => void;
}

export default function DictionaryDrawer({ word, context, language, onClose }: DictionaryDrawerProps) {
  const [explanation, setExplanation] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDefinition() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/dictionary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word, context, language }),
        });
        
        if (!res.ok) {
          throw new Error("Không thể kết nối đến từ điển AI.");
        }
        
        const data = await res.json();
        setExplanation(data.explanation);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchDefinition();
  }, [word, context, language]);

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[400px] bg-white shadow-2xl border-l border-stone-200 z-[60] flex flex-col animate-slide-in-right">
      <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-emerald-50/50">
        <h3 className="font-bold text-emerald-800 flex items-center gap-2">
          <BookA className="w-5 h-5 text-emerald-600" />
          Từ điển AI
        </h3>
        <button onClick={onClose} className="p-1.5 hover:bg-emerald-100/80 rounded-lg text-emerald-700 transition">
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div className="p-5 border-b border-stone-100 bg-stone-50">
        <p className="text-xs text-stone-500 uppercase font-semibold tracking-wider mb-1">Từ cần tra</p>
        <p className="text-xl font-bold text-stone-800">{word}</p>
        <p className="text-xs text-stone-500 mt-2 font-serif italic border-l-2 border-stone-300 pl-3">
          "...{context}..."
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-40 text-stone-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <span className="text-sm">AI đang phân tích ngữ cảnh...</span>
          </div>
        ) : error ? (
          <div className="text-red-500 text-sm bg-red-50 p-4 rounded-xl border border-red-100">
            {error}
          </div>
        ) : (
          <div className="prose prose-sm prose-emerald max-w-none prose-headings:text-stone-800 prose-p:text-stone-700 leading-relaxed">
            <ReactMarkdown>{explanation}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
