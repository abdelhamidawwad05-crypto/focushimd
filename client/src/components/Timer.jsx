import { useState, useRef, useEffect } from 'react';
import { playStart, playStop, playPause, playAlarm } from '../utils/sounds';

const Timer = ({ onSessionComplete }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isBreak, setIsBreak] = useState(false);
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (isRunning && !isPaused) {
      startTimeRef.current = Date.now() - (25 * 60 - timeLeft) * 1000;
      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const remaining = 25 * 60 - elapsed;
        if (remaining <= 0) {
          clearInterval(intervalRef.current);
          setIsRunning(false);
          setIsPaused(false);
          playAlarm();
          if (!isBreak) {
            onSessionComplete(25);
            setTimeLeft(5 * 60);
            setIsBreak(true);
          } else {
            setTimeLeft(25 * 60);
            setIsBreak(false);
          }
        } else {
          setTimeLeft(remaining);
        }
      }, 100);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, isPaused, isBreak]);

  const handleStart = () => {
    playStart();
    setIsRunning(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    playPause();
    setIsPaused(true);
    setIsRunning(false);
  };

  const handleResume = () => {
    playStart();
    setIsPaused(false);
    setIsRunning(true);
  };

  const handleStop = () => {
    playStop();
    setIsRunning(false);
    setIsPaused(false);
    if (!isBreak && timeLeft < 25 * 60) {
      const elapsed = Math.floor((25 * 60 - timeLeft) / 60);
      if (elapsed > 0) onSessionComplete(elapsed);
    }
    setTimeLeft(isBreak ? 5 * 60 : 25 * 60);
    setIsBreak(false);
  };

  const handleEnd = () => {
    playStop();
    setIsRunning(false);
    setIsPaused(false);
    setTimeLeft(isBreak ? 5 * 60 : 25 * 60);
    setIsBreak(false);
  };

  const totalTime = isBreak ? 5 * 60 : 25 * 60;
  const progress = ((totalTime - timeLeft) / totalTime) * 100;
  const circumference = 2 * Math.PI * 110;
  const offset = circumference - (progress / 100) * circumference;

  let label = isBreak ? 'Break Time' : 'Focus Session';
  if (isPaused) label = 'Paused';
  else if (isBreak && isRunning) label = 'Break Time';

  return (
    <div className={`timer-card ${isRunning ? 'running' : ''} ${isPaused ? 'paused' : ''}`}>
      <div className="timer-label">{label}</div>
      <div className="timer-circle">
        <svg width="240" height="240" viewBox="0 0 240 240">
          <circle className="track" cx="120" cy="120" r="110" fill="none" strokeWidth="5" />
          <circle
            className="progress"
            cx="120" cy="120" r="110"
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 120 120)"
          />
        </svg>
        <div className="timer-display">{formatTime(timeLeft)}</div>
        {isPaused && <div className="pause-indicator">⏸</div>}
      </div>
      <div className="timer-controls">
        {!isRunning && !isPaused ? (
          <>
            <button onClick={handleStart} className="btn btn-start">
              ▶ Start
            </button>
            <button onClick={handleEnd} className="btn btn-end">
              ⏹ End
            </button>
          </>
        ) : isPaused ? (
          <>
            <button onClick={handleResume} className="btn btn-start">
              ▶ Resume
            </button>
            <button onClick={handleStop} className="btn btn-stop">
              ⏹ Stop
            </button>
          </>
        ) : (
          <>
            <button onClick={handlePause} className="btn btn-pause">
              ⏸ Pause
            </button>
            <button onClick={handleStop} className="btn btn-stop">
              ⏹ Stop
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Timer;
