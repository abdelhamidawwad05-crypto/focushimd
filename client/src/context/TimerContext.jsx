import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Global timer state (context, not per-component state).
// The previous timer lived entirely inside the <Timer> component, so it
// unmounted (and forgot the countdown) the moment the user navigated to
// History or Stats. Moving it up here keeps the running state, remaining time
// and start timestamp alive across navigation AND reloads (persisted to
// sessionStorage).
//
// A single interval ticks based on wall-clock time (Date.now() - startTs), so
// the countdown stays accurate even if the tab is backgrounded. When the focus
// session hits 00:00 it auto-starts a 5-minute break (auto-break), shakes the
// tab title countdown and plays the end sound.
// ---------------------------------------------------------------------------

const TimerContext = createContext(null);

const FOCUS_PRESETS = [25, 50];
const BREAK_DEFAULT = 5;
const STORE_KEY = 'fh_timer_state';

function loadPersisted() {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

const DEFAULT_STATE = {
  isRunning: false,
  isPaused: false,
  isBreak: false,
  focusMin: 25,       // selected focus length
  startTs: null,      // wall-clock ms when the current run started
  remainingBase: 25 * 60, // seconds remaining captured at (re)start
  taskLabel: '',
};

export const TimerProvider = ({ children }) => {
  const [state, setState] = useState(() => {
    const p = loadPersisted();
    // Only restore a session that was actively in progress (running or paused).
    return (p && (p.isRunning || p.isPaused)) ? { ...DEFAULT_STATE, ...p } : DEFAULT_STATE;
  });
  const [display, setDisplay] = useState(() => {
    const p = loadPersisted();
    if (p && p.isRunning) {
      const total = (p.isBreak ? BREAK_DEFAULT : p.focusMin) * 60;
      const elapsed = Math.floor((Date.now() - p.startTs) / 1000);
      return Math.max(0, total - elapsed);
    }
    if (p && p.isPaused) return p.remainingBase || 25 * 60;
    return 25 * 60;
  });
  const [completedDuration, setCompletedDuration] = useState(null);
  const intervalRef = useRef(null);

  const totalSec = (s) => (s.isBreak ? BREAK_DEFAULT : s.focusMin) * 60;

  const persist = useCallback((s) => {
    try {
      if (s.isRunning || s.isPaused) sessionStorage.setItem(STORE_KEY, JSON.stringify(s));
      else sessionStorage.removeItem(STORE_KEY);
    } catch (e) {}
  }, []);

  // Main ticker — runs only while active (running and not paused).
  useEffect(() => {
    if (!state.isRunning || state.isPaused) {
      clearInterval(intervalRef.current);
      return undefined;
    }
    // Recompute from wall clock so delays/navigation don't drift.
    const compute = () => {
      const total = totalSec(state);
      const elapsed = Math.floor((Date.now() - state.startTs) / 1000);
      const remaining = total - elapsed;
      if (remaining <= 0) {
        clearInterval(intervalRef.current);
        if (state.isBreak) {
          // Break finished → back to idle focus state (keep selected preset).
          setState((prev) => ({ ...DEFAULT_STATE, focusMin: prev.focusMin || state.focusMin }));
          setCompletedDuration(null);
        } else {
          // Focus finished → auto-start break; surface the completed session.
          setCompletedDuration(state.focusMin);
          const breakState = {
            ...DEFAULT_STATE,
            isRunning: true,
            isBreak: true,
            focusMin: state.focusMin, // keep selected focus for next round
            startTs: Date.now(),
            remainingBase: BREAK_DEFAULT * 60,
            taskLabel: state.taskLabel,
          };
          setState(breakState);
          persist(breakState);
        }
        return;
      }
      setDisplay(remaining);
    };
    compute();
    intervalRef.current = setInterval(compute, 250);
    return () => clearInterval(intervalRef.current);
  }, [state.isRunning, state.isPaused, state.startTs, state.isBreak]);

  const start = useCallback((min = state.focusMin) => {
    const s = { ...state, isRunning: true, isPaused: false, isBreak: false, focusMin: min, startTs: Date.now() };
    const total = min * 60;
    s.remainingBase = total;
    setState(s);
    setCompletedDuration(null);
    setDisplay(total);
    persist(s);
  }, [state, persist]);

  const startBreak = useCallback(() => {
    const s = { ...state, isRunning: true, isPaused: false, isBreak: true, startTs: Date.now() };
    const total = BREAK_DEFAULT * 60;
    s.remainingBase = total;
    setState(s);
    setDisplay(total);
    persist(s);
  }, [state, persist]);

  const pause = useCallback(() => {
    if (!state.isRunning) return;
    const s = { ...state, isPaused: true, remainingBase: display, startTs: null };
    setState(s);
    persist(s);
  }, [state, display, persist]);

  const resume = useCallback(() => {
    if (!state.isPaused) return;
    // Re-anchor the start timestamp to account for paused duration.
    const total = totalSec(state);
    const elapsed = total - display;
    const s = { ...state, isPaused: false, isRunning: true, startTs: Date.now() - elapsed * 1000 };
    setState(s);
    persist(s);
  }, [state, display, persist]);

  const stop = useCallback(() => {
    setState(DEFAULT_STATE);
    setCompletedDuration(null);
    persist(DEFAULT_STATE);
  }, [persist]);

  const setPreset = useCallback((min) => {
    const s = { ...state, focusMin: min, isBreak: false };
    if (!state.isRunning) {
      s.isRunning = false;
      s.isPaused = false;
      setDisplay(min * 60);
    }
    setState(s);
  }, [state]);

  const setTaskLabel = useCallback((label) => {
    setState((s) => ({ ...s, taskLabel: label }));
  }, []);

  const ackSession = useCallback(() => setCompletedDuration(null), []);

  const value = {
    isRunning: state.isRunning,
    isPaused: state.isPaused,
    isBreak: state.isBreak,
    focusMin: state.focusMin,
    taskLabel: state.taskLabel,
    display,
    completedDuration,
    presets: FOCUS_PRESETS,
    start,
    startBreak,
    pause,
    resume,
    stop,
    setPreset,
    setTaskLabel,
    ackSession,
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
};

export const useTimer = () => {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used inside <TimerProvider>');
  return ctx;
};
