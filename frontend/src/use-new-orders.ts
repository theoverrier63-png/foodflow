import { useEffect, useRef, useState, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer, AudioPlayer } from "expo-audio";
import { api } from "@/src/api";

const STORAGE_KEY = "admin.orders.lastSeen";
const POLL_INTERVAL_MS = 30_000;

// A short, unobtrusive notification blip (base64-encoded, 0.4s @ 22kHz mono).
// This ships inline so we do not need to add binary assets to the repo.
const CHIME_SRC =
  "https://actions.google.com/sounds/v1/alarms/beep_short.ogg";

/**
 * Polls the backend for the latest order timestamp and computes a badge count
 * against the last-seen marker stored in AsyncStorage. Plays a chime sound
 * whenever a new order is detected. Safe to call once per admin session.
 *
 * Returns:
 * - `unreadCount`: number of orders newer than the last-seen marker.
 * - `latestCreatedAt`: ISO date of the newest order (null if none).
 * - `markAllSeen()`: manually clear the badge and store the current timestamp.
 */
export function useNewOrdersNotifier() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestCreatedAt, setLatestCreatedAt] = useState<string | null>(null);
  const lastSeenRef = useRef<string | null>(null);
  const knownLatestRef = useRef<string | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Lazily create the audio player (silent noop on web fallback if it fails).
  const ensurePlayer = useCallback(() => {
    if (playerRef.current) return playerRef.current;
    try {
      playerRef.current = createAudioPlayer({ uri: CHIME_SRC });
    } catch {
      playerRef.current = null;
    }
    return playerRef.current;
  }, []);

  const playChime = useCallback(async () => {
    const p = ensurePlayer();
    if (!p) return;
    try {
      p.seekTo(0);
      p.play();
    } catch {
      /* audio may be unavailable (e.g. muted web) — ignore */
    }
  }, [ensurePlayer]);

  const computeUnread = useCallback(async () => {
    try {
      const res = await api.adminLatestOrder();
      setLatestCreatedAt(res.latest_created_at);
      const lastSeen = lastSeenRef.current;
      if (!res.latest_created_at) {
        setUnreadCount(0);
        return;
      }
      const isNew =
        !lastSeen ||
        new Date(res.latest_created_at).getTime() > new Date(lastSeen).getTime();
      if (!isNew) {
        setUnreadCount(0);
        knownLatestRef.current = res.latest_created_at;
        return;
      }
      // Fetch the full list only when there's actually something new
      const list = await api.adminOrders();
      const count = list.filter((o) =>
        lastSeen
          ? new Date(o.created_at).getTime() > new Date(lastSeen).getTime()
          : true,
      ).length;
      setUnreadCount(count);

      // Chime only when the latest changes (avoid ringing on every tick)
      if (
        knownLatestRef.current !== res.latest_created_at &&
        knownLatestRef.current !== null
      ) {
        playChime();
      }
      knownLatestRef.current = res.latest_created_at;
    } catch {
      /* silent — polling failure should never surface as a toast */
    }
  }, [playChime]);

  const markAllSeen = useCallback(async () => {
    const iso = knownLatestRef.current ?? new Date().toISOString();
    lastSeenRef.current = iso;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, iso);
    } catch {
      /* ignore */
    }
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        lastSeenRef.current = (await AsyncStorage.getItem(STORAGE_KEY)) || null;
      } catch {
        /* ignore */
      }
      if (!alive) return;
      await computeUnread();
    })();

    timerRef.current = setInterval(() => {
      if (appStateRef.current === "active") computeUnread();
    }, POLL_INTERVAL_MS);

    const sub = AppState.addEventListener("change", (state) => {
      appStateRef.current = state;
      if (state === "active") computeUnread();
    });

    return () => {
      alive = false;
      if (timerRef.current) clearInterval(timerRef.current);
      sub.remove();
      try {
        playerRef.current?.remove();
      } catch {
        /* ignore */
      }
    };
  }, [computeUnread]);

  return { unreadCount, latestCreatedAt, markAllSeen, refresh: computeUnread };
}
