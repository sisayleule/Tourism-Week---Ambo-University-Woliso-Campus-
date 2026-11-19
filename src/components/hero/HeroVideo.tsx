/**
 * HeroVideo.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-contained hero background video component.
 *
 * Loading strategy
 * ────────────────
 * 1. Render the <video> with no src — only the poster is visible (no network
 *    request, no first-paint delay).
 * 2. After the window load event (or requestIdleCallback), pick the right
 *    source (480 vs 720) and assign it to videoRef.current.src, then call
 *    load() to trigger buffering.
 * 3. Fade the video in when the first "playing" event fires.
 *
 * Source selection
 * ────────────────
 * Mobile source (480p) when:
 *   - viewport width ≤ 767 px, OR
 *   - navigator.connection.saveData === true, OR
 *   - effectiveType is "2g", "slow-2g", or "3g"
 * Desktop source (720p) otherwise.
 *
 * Stall guard
 * ───────────
 * If "waiting" or "stalled" fires before the first "playing" event AND the
 * total stall time exceeds 4 s, OR if readyState stays < 3 for 6 s after
 * src assignment, the guard:
 *   1. Pauses and clears the src (releases the network connection).
 *   2. Calls onStallFallback() so the parent shows the static poster.
 *   3. Stores a session flag so it never retries on this page load.
 *
 * IntersectionObserver / visibility
 * ──────────────────────────────────
 * Pauses when the hero leaves the viewport or the tab is hidden; resumes
 * when it comes back. This prevents buffering a video the user can't see.
 *
 * Existing rules preserved
 * ─────────────────────────
 * - Save-Data / prefers-reduced-motion → no video (caller passes skipVideo).
 * - autoPlay, loop, muted, playsInline, webkit-playsinline, preload="auto",
 *   disablePictureInPicture, disableRemotePlayback, no controls.
 * - onError → onStallFallback.
 * - Inline styles beat the global `img, video { height: auto }` rule.
 *
 * Debug data
 * ──────────
 * Exposes a ref-forwarded getDebugSnapshot() function used by the debug panel.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { DEFAULT_HERO_480, DEFAULT_HERO_720 } from '../../lib/heroMedia';
import { registerHeroVideoDebug, unregisterHeroVideoDebug } from '../../lib/heroVideoDebugStore';

// ─── Public debug snapshot shape ─────────────────────────────────────────────

export interface HeroVideoDebugSnapshot {
  chosenSrc: string;
  chosenReason: string;
  readyState: number;
  bufferedRanges: Array<{ start: number; end: number }>;
  stallCount: number;
  droppedFrames: number | null;
  totalFrames: number | null;
  timeToFirstPlaying: number | null; // ms
  stallGuardFired: boolean;
  isPlaying: boolean;
}

export interface HeroVideoHandle {
  play(): void;
  pause(): void;
  getDebugSnapshot(): HeroVideoDebugSnapshot;
}

// ─── Source selection ─────────────────────────────────────────────────────────

const SESSION_STALL_KEY = '__heroVideoStalled';

function pickSource(): { src: string; reason: string } {
  const nav = navigator as unknown as {
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const conn = nav.connection;
  if (conn?.saveData) return { src: DEFAULT_HERO_480, reason: 'saveData=true' };
  const et = conn?.effectiveType ?? '';
  if (et === '2g' || et === 'slow-2g' || et === '3g')
    return { src: DEFAULT_HERO_480, reason: `effectiveType=${et}` };
  if (window.innerWidth <= 767)
    return { src: DEFAULT_HERO_480, reason: `viewport=${window.innerWidth}px` };
  return { src: DEFAULT_HERO_720, reason: 'desktop default' };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  /** Resolved poster URL (content-hashed or remote override). */
  posterSrc: string;
  /**
   * When true the component renders nothing (caller shows static poster).
   * This covers Save-Data, prefers-reduced-motion, and stall-guard fallback.
   */
  skipVideo: boolean;
  /** Called when the video should be abandoned and the static poster shown. */
  onStallFallback(): void;
  /** Called with updated isPlaying state. */
  onPlayingChange(playing: boolean): void;
  /** Called when autoplay is blocked by browser policy. */
  onAutoplayBlocked(): void;
  /** Manual play/pause toggle requested by the bottom bar button. */
  externalIsPlaying: boolean;
}

const STALL_TIMEOUT_MS   = 4_000; // waiting/stalled → fallback after 4 s
const READY_TIMEOUT_MS   = 6_000; // readyState < 3 for 6 s after src assign

const HeroVideoInner = forwardRef<HeroVideoHandle, Props>(function HeroVideoInner(
  { posterSrc, skipVideo, onStallFallback, onPlayingChange, onAutoplayBlocked, externalIsPlaying },
  ref,
) {
  const videoRef  = useRef<HTMLVideoElement>(null);

  // Track whether we have ever fired the playing event
  const srcAssignedAt     = useRef<number | null>(null);
  const firstPlayingAt    = useRef<number | null>(null);
  const stallCount        = useRef(0);
  const stallTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guardFired        = useRef(false);
  const chosenSrc         = useRef('');
  const chosenReason      = useRef('');
  const [videoOpacity, setVideoOpacity] = useState(0);
  const isPlayingRef      = useRef(false);

  // ── Debug render counter (dev only) ──────────────────────────────────────
  const renderCount = useRef(0);
  if (import.meta.env.DEV) renderCount.current++;

  // ── Imperative handle ────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    play() {
      const v = videoRef.current;
      if (!v) return;
      v.play().then(() => {
        isPlayingRef.current = true;
        onPlayingChange(true);
      }).catch(() => {});
    },
    pause() {
      const v = videoRef.current;
      if (!v) return;
      v.pause();
      isPlayingRef.current = false;
      onPlayingChange(false);
    },
    getDebugSnapshot(): HeroVideoDebugSnapshot {
      const v = videoRef.current;
      const ranges: Array<{ start: number; end: number }> = [];
      if (v) {
        for (let i = 0; i < v.buffered.length; i++) {
          ranges.push({ start: v.buffered.start(i), end: v.buffered.end(i) });
        }
      }
      let dropped: number | null = null;
      let total: number | null = null;
      try {
        if (v && typeof v.getVideoPlaybackQuality === 'function') {
          const q = v.getVideoPlaybackQuality();
          dropped = q.droppedVideoFrames ?? null;
          total   = q.totalVideoFrames   ?? null;
        }
      } catch { /* not supported */ }
      return {
        chosenSrc:         chosenSrc.current,
        chosenReason:      chosenReason.current,
        readyState:        v?.readyState ?? -1,
        bufferedRanges:    ranges,
        stallCount:        stallCount.current,
        droppedFrames:     dropped,
        totalFrames:       total,
        timeToFirstPlaying: firstPlayingAt.current != null && srcAssignedAt.current != null
          ? firstPlayingAt.current - srcAssignedAt.current
          : null,
        stallGuardFired: guardFired.current,
        isPlaying:       isPlayingRef.current,
      };
    },
  }), [onPlayingChange]);

  // ── Stall guard helpers ───────────────────────────────────────────────────

  const clearStallTimer = () => {
    if (stallTimerRef.current != null) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  };

  const clearReadyTimer = () => {
    if (readyTimerRef.current != null) {
      clearTimeout(readyTimerRef.current);
      readyTimerRef.current = null;
    }
  };

  const triggerFallback = (v: HTMLVideoElement) => {
    if (guardFired.current) return;
    guardFired.current = true;
    clearStallTimer();
    clearReadyTimer();
    try {
      v.pause();
      v.removeAttribute('src');
      v.load();
    } catch { /* ignore */ }
    sessionStorage.setItem(SESSION_STALL_KEY, '1');
    onStallFallback();
  };

  // ── Main effect: src assignment + all event wiring ───────────────────────
  // Single consolidated effect — src assignment and event listeners together
  // so canplay is always attached before load() is called.

  useEffect(() => {
    if (skipVideo) return;
    if (sessionStorage.getItem(SESSION_STALL_KEY)) {
      onStallFallback();
      return;
    }

    const v = videoRef.current;
    if (!v) return;

    // Choose source once
    const { src, reason } = pickSource();
    chosenSrc.current    = src;
    chosenReason.current = reason;

    // ── Wire all event listeners BEFORE assigning src ────────────────────
    // This guarantees canplay/playing/error are in place when load() triggers
    // network activity.

    const onPlaying = () => {
      if (firstPlayingAt.current == null) firstPlayingAt.current = performance.now();
      clearStallTimer();
      clearReadyTimer();
      setVideoOpacity(1);
      isPlayingRef.current = true;
      onPlayingChange(true);
    };

    const onWaitingOrStalled = () => {
      if (firstPlayingAt.current != null) return; // only guard before first play
      stallCount.current++;
      clearStallTimer();
      stallTimerRef.current = setTimeout(() => {
        const vid = videoRef.current;
        if (!guardFired.current && firstPlayingAt.current == null && vid) {
          triggerFallback(vid);
        }
      }, STALL_TIMEOUT_MS);
    };

    const onCanPlay = () => {
      const promise = v.play();
      if (promise !== undefined) {
        promise.catch((err: Error) => {
          if (err.name === 'NotAllowedError') {
            onAutoplayBlocked();
            isPlayingRef.current = false;
            onPlayingChange(false);
          }
        });
      }
    };

    const onError = () => { onStallFallback(); };
    const onPause = () => { isPlayingRef.current = false; onPlayingChange(false); };

    v.addEventListener('playing',  onPlaying);
    v.addEventListener('waiting',  onWaitingOrStalled);
    v.addEventListener('stalled',  onWaitingOrStalled);
    v.addEventListener('canplay',  onCanPlay,  { once: true });
    v.addEventListener('error',    onError);
    v.addEventListener('pause',    onPause);

    // ── Deferred src assignment — called exactly once ────────────────────
    let assigned = false;
    const assignSrc = () => {
      if (assigned || !videoRef.current) return;
      assigned = true;
      const vid = videoRef.current;
      vid.src = src;
      vid.load();
      srcAssignedAt.current = performance.now();

      // readyState watchdog
      readyTimerRef.current = setTimeout(() => {
        if (!guardFired.current && videoRef.current && videoRef.current.readyState < 3 && firstPlayingAt.current == null) {
          triggerFallback(videoRef.current);
        }
      }, READY_TIMEOUT_MS);
    };

    // Schedule after first paint — use rIC if available, otherwise load/setTimeout
    let ricId: number | undefined;
    const scheduleAssign = () => {
      if ('requestIdleCallback' in window) {
        ricId = requestIdleCallback(assignSrc, { timeout: 2000 });
      } else {
        setTimeout(assignSrc, 100);
      }
    };

    if (document.readyState === 'complete') {
      scheduleAssign();
    } else {
      window.addEventListener('load', scheduleAssign, { once: true });
    }

    return () => {
      assigned = true; // prevent late callback from running after unmount
      if (ricId !== undefined) cancelIdleCallback(ricId);
      window.removeEventListener('load', scheduleAssign);
      clearStallTimer();
      clearReadyTimer();
      v.removeEventListener('playing',  onPlaying);
      v.removeEventListener('waiting',  onWaitingOrStalled);
      v.removeEventListener('stalled',  onWaitingOrStalled);
      v.removeEventListener('canplay',  onCanPlay);
      v.removeEventListener('error',    onError);
      v.removeEventListener('pause',    onPause);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipVideo]);

  // ── IntersectionObserver: pause when hero leaves viewport ───────────────

  useEffect(() => {
    if (skipVideo) return;
    const v = videoRef.current;
    if (!v || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          v.pause();
        } else if (firstPlayingAt.current != null) {
          v.play().catch(() => {});
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(v);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipVideo]);

  // ── Page visibility: pause when tab is hidden ────────────────────────────

  useEffect(() => {
    if (skipVideo) return;
    const v = videoRef.current;
    if (!v) return;
    const onVisibility = () => {
      if (document.hidden) {
        v.pause();
      } else if (firstPlayingAt.current != null) {
        v.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipVideo]);

  // ── External play/pause (bottom-bar button) ───────────────────────────────

  useEffect(() => {
    const v = videoRef.current;
    if (!v || skipVideo || firstPlayingAt.current == null) return;
    if (externalIsPlaying) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalIsPlaying]);

  // ── Register/unregister debug snapshot getter in module store ───────────
  useEffect(() => {
    registerHeroVideoDebug(() => ({
      chosenSrc:         chosenSrc.current,
      chosenReason:      chosenReason.current,
      readyState:        videoRef.current?.readyState ?? -1,
      bufferedRanges:    (() => {
        const v = videoRef.current;
        const r: Array<{ start: number; end: number }> = [];
        if (v) for (let i = 0; i < v.buffered.length; i++)
          r.push({ start: v.buffered.start(i), end: v.buffered.end(i) });
        return r;
      })(),
      stallCount:        stallCount.current,
      droppedFrames:     (() => {
        try {
          const v = videoRef.current;
          return v && typeof v.getVideoPlaybackQuality === 'function'
            ? v.getVideoPlaybackQuality().droppedVideoFrames ?? null : null;
        } catch { return null; }
      })(),
      totalFrames:       (() => {
        try {
          const v = videoRef.current;
          return v && typeof v.getVideoPlaybackQuality === 'function'
            ? v.getVideoPlaybackQuality().totalVideoFrames ?? null : null;
        } catch { return null; }
      })(),
      timeToFirstPlaying: firstPlayingAt.current != null && srcAssignedAt.current != null
        ? firstPlayingAt.current - srcAssignedAt.current : null,
      stallGuardFired: guardFired.current,
      isPlaying:       isPlayingRef.current,
    }));
    return () => unregisterHeroVideoDebug();
  // Register once on mount; the getter closes over the refs which always read current values.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (skipVideo) return null;

  return (
    <>
      {import.meta.env.DEV && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 2,
            left: 4,
            zIndex: 999,
            fontSize: 9,
            color: '#D9A441',
            opacity: 0.7,
            pointerEvents: 'none',
          }}
        >
          HeroVideo render #{renderCount.current}
        </span>
      )}
      <video
        ref={videoRef}
        /* No src here — assigned lazily after window load */
        autoPlay
        loop
        muted
        playsInline
        {...({ 'webkit-playsinline': 'true' } as Record<string, string>)}
        preload="auto"
        poster={posterSrc}
        disablePictureInPicture
        {...({ disableremoteplayback: 'true' } as Record<string, string>)}
        style={{
          position:    'absolute',
          top:         0,
          left:        0,
          width:       '100%',
          height:      '100%',
          minWidth:    '100%',
          minHeight:   '100%',
          maxWidth:    'none',
          maxHeight:   'none',
          aspectRatio: 'auto',
          objectFit:   'cover',
          objectPosition: 'center',
          display:     'block',
          transform:   'none',
          // Fade in when playing; poster is visible via the poster attribute
          opacity:     videoOpacity,
          transition:  'opacity 0.6s ease',
          willChange:  'opacity',
        }}
      />
    </>
  );
});

export const HeroVideo = memo(HeroVideoInner);
