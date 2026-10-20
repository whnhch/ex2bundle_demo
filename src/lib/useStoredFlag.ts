import { useCallback, useSyncExternalStore } from "react";

// A boolean persisted in localStorage, with an in-memory fallback when storage is
// unavailable (private mode, blocked site data). `fallback` is used until a value is set;
// `serverValue` is what the server render and hydration see.

const EVENT = "stored-flag-change";
const memory = new Map<string, boolean>();

function read(key: string): boolean | undefined {
  try {
    const value = localStorage.getItem(key);
    if (value !== null) return value === "1";
  } catch {
    // storage unavailable
  }
  return memory.get(key);
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useStoredFlag(key: string, fallback: boolean, serverValue = fallback) {
  const value = useSyncExternalStore(subscribe, () => read(key) ?? fallback, () => serverValue);
  const set = useCallback(
    (next: boolean) => {
      memory.set(key, next);
      try {
        localStorage.setItem(key, next ? "1" : "0");
      } catch {
        // storage unavailable
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return [value, set] as const;
}
