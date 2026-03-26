"use client";

import { useEffect } from "react";

export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options?: { ctrl?: boolean; meta?: boolean; shift?: boolean }
) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const matchKey = e.key.toLowerCase() === key.toLowerCase();
      const matchCtrl = options?.ctrl ? e.ctrlKey : true;
      const matchMeta = options?.meta ? e.metaKey : true;
      const matchShift = options?.shift ? e.shiftKey : !e.shiftKey;

      // For Cmd+K / Ctrl+K style shortcuts
      if (options?.ctrl || options?.meta) {
        if (matchKey && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          callback();
        }
        return;
      }

      if (matchKey && matchCtrl && matchMeta && matchShift) {
        // Don't trigger if user is typing in an input
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
        callback();
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [key, callback, options?.ctrl, options?.meta, options?.shift]);
}
