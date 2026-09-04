import { useState, useEffect } from 'react';
import Timer from '../components/Timer';
import MoodPopup from '../components/MoodPopup';
import playClick, { playAlarm } from '../utils/sounds';
import { saveSession, getTodayCount, getStats } from '../utils/storage';
import { useTimer } from '../context/TimerContext';

const Home = () => {
  const [todayCount, setTodayCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [completedDuration, setCompletedDuration] = useState(null);
  const [showMoodPopup, setShowMoodPopup] = useState(false);
  const { completedDuration: timerDone, taskLabel, ackSession } = useTimer();

  const refresh = async () => {
    const [count, stats] = await Promise.all([getTodayCount(), getStats()]);
    setTodayCount(count);
    setStreak(stats.streak);
  };

  useEffect(() => { refresh(); }, []);

  // When the timer naturally finishes, surface the completed session + end sound.
  useEffect(() => {
    if (timerDone != null) {
      playAlarm();
      setCompletedDuration(timerDone);
      setShowMoodPopup(true);
    }
  }, [timerDone]);

  const handleMoodSave = async ({ duration, mood, note }) => {
    // The optional task label is saved together with the session.
    const combinedNote = [taskLabel, note].filter(Boolean).join(' — ');
    await saveSession({ duration, mood, note: combinedNote });
    setShowMoodPopup(false);
    setCompletedDuration(null);
    ackSession();
    refresh();
  };

  const streakText = streak === 1 ? '1 day' : `${streak} days`;

  return (
    <div className="home-page">
      <div className="home-header">
        <div className="today-label">Today</div>
        <h1>Make this moment count.</h1>
      </div>

      <div className="home-layout">
        <Timer />

        <div className="stats-sidebar">
          <div className="stat-card">
            <div className="stat-title">Today's sessions</div>
            <div className="stat-number">{todayCount}</div>
            <div className="stat-subtitle">Completed focus blocks</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Current streak</div>
            <div className="stat-number">{streakText}</div>
            <div className="stat-subtitle">One session keeps it going</div>
          </div>
        </div>
      </div>

      {showMoodPopup && (
        <MoodPopup
          duration={completedDuration}
          onSave={handleMoodSave}
          onClose={() => { playClick(); setShowMoodPopup(false); setCompletedDuration(null); ackSession(); }}
        />
      )}
    </div>
  );
};

export default Home;
