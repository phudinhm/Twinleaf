"use client";

import React from "react";
import { BookOpen, Trash2, Clock, Trash } from "lucide-react";
import type { LibraryBookMeta } from "@/types";

interface LibraryViewProps {
  library: LibraryBookMeta[];
  onOpenBook: (id: string) => void;
  onDeleteBook: (id: string) => void;
  onClearLibrary: () => void;
}

export default function LibraryView({ library, onOpenBook, onDeleteBook, onClearLibrary }: LibraryViewProps) {
  if (library.length === 0) return null;

  return (
    <div className="mt-12 bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-stone-200/60 shadow-sm">
      <div className="flex items-center justify-between mb-4 border-b border-stone-200/50 pb-3">
        <h2 className="text-sm font-bold text-stone-700 uppercase tracking-wider flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-600" />
          Thư viện của bạn ({library.length})
        </h2>
        <button
          onClick={() => {
            if (confirm("Bạn có chắc chắn muốn xóa toàn bộ sách trong thư viện?")) {
              onClearLibrary();
            }
          }}
          className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium transition"
        >
          <Trash className="w-3.5 h-3.5" /> Xóa tất cả
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {library.map((book) => (
          <div
            key={book.id}
            className="flex gap-3 bg-white p-3 rounded-2xl border border-stone-100 shadow-sm hover:border-emerald-300 hover:shadow-md transition group cursor-pointer"
            onClick={() => onOpenBook(book.id)}
          >
            {book.cover ? (
              <img src={book.cover} alt="" className="w-14 h-20 object-cover rounded-lg shadow-sm border border-stone-200" />
            ) : (
              <div className="w-14 h-20 bg-stone-100 rounded-lg flex items-center justify-center border border-stone-200">
                <BookOpen className="w-6 h-6 text-stone-300" />
              </div>
            )}
            
            <div className="flex-1 min-w-0 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-stone-800 line-clamp-2 leading-tight group-hover:text-emerald-700 transition">
                  {book.title || "Unknown Book"}
                </h3>
                <p className="text-[10px] text-stone-400 mt-1 uppercase tracking-wide truncate">
                  {book.author || "Unknown"} • {book.targetLang.toUpperCase()}
                </p>
              </div>
              
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2 flex-1">
                  <div className="h-1.5 w-16 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${book.progress}%` }} />
                  </div>
                  <span className="text-[10px] font-medium text-emerald-600">{book.progress}%</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Xóa cuốn sách này?")) onDeleteBook(book.id);
                  }}
                  className="p-1.5 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
