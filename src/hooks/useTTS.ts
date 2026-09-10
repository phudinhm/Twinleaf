"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { BookChunk } from "@/types";

export interface TTSState {
  isPlaying: boolean;
  isPaused: boolean;
  currentChunkId: number | null;
  rate: number;
  voiceURI: string | null;
  voices: SpeechSynthesisVoice[];
}

export function useTTS(chunks: BookChunk[], targetLang: string) {
  const [state, setState] = useState<TTSState>({
    isPlaying: false,
    isPaused: false,
    currentChunkId: null,
    rate: 1.0,
    voiceURI: null,
    voices: [],
  });

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isPlayingRef = useRef(false);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      let availableVoices = window.speechSynthesis.getVoices();
      // Filter primarily for English, German, and Vietnamese
      availableVoices = availableVoices.filter(v => 
        v.lang.startsWith("vi") || v.lang.startsWith("en") || v.lang.startsWith("de")
      );
      // Auto-select a voice based on targetLang if none selected
      setState(s => {
        if (!s.voiceURI && availableVoices.length > 0) {
          const prefix = targetLang === "vi" ? "vi" : targetLang === "de" ? "de" : "en";
          const matched = availableVoices.find(v => v.lang.startsWith(prefix));
          if (matched) {
            return { ...s, voices: availableVoices, voiceURI: matched.voiceURI };
          }
        }
        return { ...s, voices: availableVoices };
      });
    };
    
    loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [targetLang]);

  const playChunk = useCallback((id: number) => {
    if (typeof window === "undefined") return;
    
    window.speechSynthesis.cancel();
    const chunkIndex = chunks.findIndex(c => c.id === id);
    if (chunkIndex === -1) return;
    
    const chunk = chunks[chunkIndex];
    // Don't read empty chunks or just headings (optional, but let's read headings too for now)
    const textToRead = chunk.translated || chunk.original;
    if (!textToRead.trim()) {
      // Skip empty
      if (chunkIndex + 1 < chunks.length) {
        playChunk(chunks[chunkIndex + 1].id);
      } else {
        stop();
      }
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.rate = state.rate;
    
    if (state.voiceURI) {
      const selectedVoice = state.voices.find(v => v.voiceURI === state.voiceURI);
      if (selectedVoice) utterance.voice = selectedVoice;
    } else {
      utterance.lang = targetLang === "vi" ? "vi-VN" : targetLang === "de" ? "de-DE" : "en-US";
    }

    utterance.onend = () => {
      if (!isPlayingRef.current) return;
      // Play next
      if (chunkIndex + 1 < chunks.length) {
        playChunk(chunks[chunkIndex + 1].id);
      } else {
        stop();
      }
    };

    utterance.onerror = (e) => {
      console.warn("TTS Error", e);
      stop();
    };

    utteranceRef.current = utterance;
    isPlayingRef.current = true;
    setState(s => ({ ...s, isPlaying: true, isPaused: false, currentChunkId: id }));
    window.speechSynthesis.speak(utterance);
  }, [chunks, state.rate, state.voiceURI, state.voices, targetLang]);

  const togglePlayPause = useCallback(() => {
    if (!state.isPlaying && state.currentChunkId === null && chunks.length > 0) {
      // Start from beginning
      playChunk(chunks[0].id);
      return;
    }

    if (state.isPlaying && !state.isPaused) {
      window.speechSynthesis.pause();
      setState(s => ({ ...s, isPaused: true }));
    } else if (state.isPlaying && state.isPaused) {
      window.speechSynthesis.resume();
      setState(s => ({ ...s, isPaused: false }));
    }
  }, [state, chunks, playChunk]);

  const stop = useCallback(() => {
    if (typeof window !== "undefined") {
      window.speechSynthesis.cancel();
    }
    isPlayingRef.current = false;
    setState(s => ({ ...s, isPlaying: false, isPaused: false, currentChunkId: null }));
  }, []);

  const setRate = useCallback((rate: number) => {
    setState(s => ({ ...s, rate }));
    if (state.isPlaying && !state.isPaused && state.currentChunkId !== null) {
      // Restart current chunk with new rate
      playChunk(state.currentChunkId);
    }
  }, [state, playChunk]);

  const setVoice = useCallback((voiceURI: string) => {
    setState(s => ({ ...s, voiceURI }));
    if (state.isPlaying && !state.isPaused && state.currentChunkId !== null) {
      playChunk(state.currentChunkId);
    }
  }, [state, playChunk]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    ...state,
    playChunk,
    togglePlayPause,
    stop,
    setRate,
    setVoice,
  };
}
