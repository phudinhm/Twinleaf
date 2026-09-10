"use client";

import React, { useRef, useState, useCallback } from "react";
import { UploadCloud, Loader2, Sparkles } from "lucide-react";

interface FileDropzoneProps {
  file: File | null;
  onFileChange: (file: File) => void;
  onSubmit: () => void;
  isUploading: boolean;
}

export default function FileDropzone({
  file,
  onFileChange,
  onSubmit,
  isUploading,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) onFileChange(droppedFile);
    },
    [onFileChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileChange(e.target.files[0]);
    }
  };

  return (
    <>
      {/* Drag and Drop Zone */}
      <div
        className={`relative rounded-3xl border-2 border-dashed p-9 text-center cursor-pointer transition-all duration-300 ${
          isDragging
            ? "border-emerald-500 bg-emerald-50/80 scale-[1.02] shadow-xl shadow-emerald-100"
            : file
            ? "border-emerald-500 bg-emerald-50/40 shadow-md shadow-stone-100"
            : "border-stone-300 bg-white/80 hover:border-emerald-400 hover:shadow-lg"
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInput}
          accept=".epub,.mobi,.azw,.azw3"
          className="hidden"
        />

        {isDragging ? (
          <div className="py-6">
            <UploadCloud className="w-16 h-16 text-emerald-500 mx-auto mb-3 animate-bounce" />
            <p className="text-emerald-700 font-semibold text-lg">Thả file sách vào đây!</p>
          </div>
        ) : file ? (
          <div className="py-4">
            <div className="w-16 h-20 mx-auto mb-4 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-lg shadow-md flex items-center justify-center text-white font-bold text-xs uppercase tracking-widest border border-white/40">
              {file.name.split(".").pop()}
            </div>
            <p className="text-stone-800 font-bold text-lg max-w-sm mx-auto truncate">
              {file.name}
            </p>
            <p className="text-stone-400 text-xs mt-1">
              {(file.size / 1024 / 1024).toFixed(2)} MB • Nhấp để chọn file khác
            </p>
          </div>
        ) : (
          <div className="py-6">
            <div className="w-14 h-14 mx-auto mb-4 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-400">
              <UploadCloud className="w-7 h-7" />
            </div>
            <p className="text-stone-700 font-semibold text-base">
              Kéo thả file sách hoặc nhấp để tải lên
            </p>
            <p className="text-stone-400 text-xs mt-1.5">
              Hỗ trợ EPUB, MOBI, AZW, AZW3 (Tự động giữ nguyên bìa gốc)
            </p>
          </div>
        )}
      </div>

      {/* Action Button */}
      {file && (
        <button
          onClick={onSubmit}
          disabled={isUploading}
          className="w-full py-4 rounded-2xl font-semibold text-white text-base shadow-xl shadow-emerald-500/25 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:shadow-emerald-500/40 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Đang trích xuất nội dung & Bìa sách...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>Bắt đầu dịch & Đọc song ngữ</span>
            </>
          )}
        </button>
      )}

      <div className="text-center">
        <p className="text-xs text-stone-400">
          💡 File xuất ra tương thích 100% với Amazon Kindle (Send to Kindle)
        </p>
      </div>
    </>
  );
}
