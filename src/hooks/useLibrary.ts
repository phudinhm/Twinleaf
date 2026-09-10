"use client";

import { useState, useEffect, useCallback } from "react";
import { get, set, del, keys } from "idb-keyval";
import { SavedBook, LibraryBookMeta } from "@/types";

export function useLibrary() {
  const [library, setLibrary] = useState<LibraryBookMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadLibrary = useCallback(async () => {
    try {
      setIsLoading(true);
      const allKeys = await keys();
      const bookKeys = allKeys.filter((k) => typeof k === "string" && k.startsWith("twinleaf_book_"));
      
      const metaList: LibraryBookMeta[] = [];
      for (const k of bookKeys) {
        const book = await get<SavedBook>(k as string);
        if (book) {
          const translatedCount = book.chunks.filter((c) => c.translated).length;
          const total = book.chunks.length;
          metaList.push({
            id: book.id,
            title: book.title,
            author: book.author,
            cover: book.cover,
            targetLang: book.targetLang,
            lastReadAt: book.lastReadAt,
            progress: total > 0 ? Math.round((translatedCount / total) * 100) : 0,
          });
        }
      }
      setLibrary(metaList.sort((a, b) => b.lastReadAt - a.lastReadAt));
    } catch (err) {
      console.error("Failed to load library", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const saveBook = async (book: SavedBook) => {
    try {
      await set(`twinleaf_book_${book.id}`, { ...book, lastReadAt: Date.now() });
      await loadLibrary();
    } catch (err) {
      console.error("Failed to save book", err);
    }
  };

  const getBook = async (id: string): Promise<SavedBook | undefined> => {
    return await get<SavedBook>(`twinleaf_book_${id}`);
  };

  const deleteBook = async (id: string) => {
    try {
      await del(`twinleaf_book_${id}`);
      await loadLibrary();
    } catch (err) {
      console.error("Failed to delete book", err);
    }
  };

  const clearLibrary = async () => {
    try {
      const allKeys = await keys();
      const bookKeys = allKeys.filter((k) => typeof k === "string" && k.startsWith("twinleaf_book_"));
      for (const k of bookKeys) {
        await del(k);
      }
      await loadLibrary();
    } catch (err) {
      console.error("Failed to clear library", err);
    }
  };

  return {
    library,
    isLoadingLibrary: isLoading,
    saveBook,
    getBook,
    deleteBook,
    clearLibrary,
    refreshLibrary: loadLibrary,
  };
}
