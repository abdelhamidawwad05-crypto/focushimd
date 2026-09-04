import { useState, useEffect, useCallback } from 'react';
import { useTimer } from '../context/TimerContext';
import { playStart, playStop, playPause } from '../utils/sounds';

const formatTime = (s) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

const Timer = () => {
  const {
    isRunning, isPaused, isBreak, focusMin, taskLabel,
    display, presets,
    start, pause, resume, stop, setPreset, setTaskLabel,
  } = useTimer();
  const [labelDraft, setLabelDraft] = useState(taskLabel);

  // Keep the draft local input in sync with context after navigation.
  useEffect(() => { setLabelDraft(taskLabel); }, [taskLabel]);

  const active = isRunning || isPaused;
  const isTyping = (t) => {
    const el = t.target;
    const tag = el && el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable);
  };

  // Spacebar shortcut: start when stopped, stop when running. Ignored while typing.
  const handleKey = useCallback((e) => {
    if (isTyping(e)) return;
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      if (isBreak) return; // don't let space during break restart a session unexpectedly
      if (isRunning) stop();
      else start(focusMin);
    }
  }, [isRunning, isBreak, focusMin, start, stop]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // Tab title countdown while running; restore when idle.
  useEffect(() => {
    if (active) {
      document.title = `${formatTime(display)} – Focus Himd`;
    } else {
      document.title = 'Focus Himd';
    }
  }, [active, display]);

  const handleStart = () => { playStart(); start(focusMin); };
  const handlePause = () => { playPause(); pause(); };
  const handleResume = () => { playStart(); resume(); };
  const handleStop = () => { playStop(); stop(); };

  const totalTime = (isBreak ? 5 : focusMin) * 60;
  const progress = Math.min(100, ((totalTime - display) / totalTime) * 100);
  const circumference = 2 * Math.PI * 110;
  const offset = circumference - (progress / 100) * circumference;

  let label = isBreak ? 'Break Time' : 'Focus Session';
  if (isPaused) label = 'Paused';

  const dndText = `Phone away, ${isBreak ? 5 : focusMin} min.`;

  return (
    <div>
      <div className={`timer-card ${isRunning ? 'running' : ''} ${isPaused ? 'paused' : ''}`}>
        <div className="timer-label">{label}</div>

        {/* Session length presets (only selectable while idle) */}
        {!active && !isBreak && (
          <div className="timer-presets">
            {presets.map((min) => (
              <button
                key={min}
                type="button"
                className={`preset-btn ${focusMin === min ? 'active' : ''}`}
                onClick={() => { playStart(); setPreset(min); }}
              >
                {min}m
              </button>
            ))}
          </div>
        )}

        <div className="timer-circle">
          <svg width="240" height="240" viewBox="0 0 240 240">
            <circle className="track" cx="120" cy="120" r="110" fill="none" strokeWidth="5" />
            <circle className="progress" cx="120" cy="120" r="110" fill="none" strokeWidth="5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 120 120)" />
          </svg>
          <div className="timer-display">{formatTime(display)}</div>
          {isPaused && <div className="pause-indicator">II</div>}
        </div>

        {/* Do Not Disturb note — only while running */}
        {isRunning && <div className="timer-dnd">{dndText}</div>}

        <div className="timer-controls">
          {!active ? (
            <>
              <button onClick={handleStart} className="btn btn-start">Start</button>
              <button onClick={stop} className="btn btn-end">End</button>
            </>
          ) : isPaused ? (
            <>
              <button onClick={handleResume} className="btn btn-start">Resume</button>
              <button onClick={handleStop} className="btn btn-stop">Stop</button>
            </>
          ) : (
            <>
              <button onClick={handlePause} className="btn btn-pause">Pause</button>
              <button onClick={handleStop} className="btn btn-stop">Stop</button>
            </>
          )}
        </div>
      </div>

      {/* Optional task label */}
      <div className="timer-task">
        <input
          className="fh-input task-input"
          type="text"
          placeholder="What are you studying?"
          value={labelDraft}
          onChange={(e) => { setLabelDraft(e.target.value); setTaskLabel(e.target.value); }}
          disabled={isRunning || isPaused}
        />
      </div>
    </div>
  );
};

export default Timer;
