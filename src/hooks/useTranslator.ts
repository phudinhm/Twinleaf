"use client";
import { useState, useCallback, useRef } from "react";
import { BookChunk } from "@/types";

const BATCH_SIZE = 5;
const PARALLEL = 2;

export function useTranslator() {
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef(false);

  const translateChunks = useCallback(
    async (
      initialChunks: BookChunk[],
      targetLang: string,
      engine: string,
      onUpdate: (chunks: BookChunk[]) => void
    ) => {
      setIsTranslating(true);
      setProgress(0);
      abortRef.current = false;
      let currentChunks = [...initialChunks];
      let completed = 0;

      type Batch = { indices: number[]; texts: string[] };
      const allBatches: Batch[] = [];

      for (let i = 0; i < currentChunks.length; i += BATCH_SIZE) {
        const batch: Batch = { indices: [], texts: [] };
        for (let j = 0; j < BATCH_SIZE && i + j < currentChunks.length; j++) {
          const idx = i + j;
          const chunk = currentChunks[idx];
          if (!chunk.original.trim() || chunk.original.match(/^[-_*]{3,}$/)) {
            completed++;
          } else {
            batch.indices.push(idx);
            batch.texts.push(chunk.original);
          }
        }
        if (batch.texts.length > 0) allBatches.push(batch);
      }

      for (let w = 0; w < allBatches.length; w += PARALLEL) {
        if (abortRef.current) break;

        const wave = allBatches.slice(w, w + PARALLEL);

        const results = await Promise.allSettled(
          wave.map(async (batch) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 40000);
            const res = await fetch("/api/translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: batch.texts, targetLang, engine }),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || "Translation request failed");
            }
            const { translatedText } = await res.json();
            return { batch, translatedText };
          })
        );

        let needsRetry = false;

        for (const r of results) {
          if (r.status === "fulfilled") {
            const { batch, translatedText } = r.value;
            const translations = Array.isArray(translatedText) ? translatedText : [translatedText];
            batch.indices.forEach((chunkIdx, arrayIdx) => {
              currentChunks[chunkIdx] = {
                ...currentChunks[chunkIdx],
                translated: translations[arrayIdx] ?? "[Missing]",
              };
              completed++;
            });
          } else {
            console.warn("Batch failed, will retry:", r.reason?.message);
            needsRetry = true;
          }
        }

        // Update progress and chunks
        const pct = Math.round((completed / currentChunks.length) * 100);
        setProgress(pct);
        onUpdate([...currentChunks]);

        // If needed, retry failed batches after short delay
        if (needsRetry) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }

      setProgress(100);
      setIsTranslating(false);
    },
    []
  );

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { isTranslating, progress, translateChunks, abort };
}
