import { useState, useEffect } from 'react';
import Timer from '../components/Timer';
import MoodPopup from '../components/MoodPopup';
import playClick, { playAlarm } from '../utils/sounds';
import { saveSession, getTodayCount, getStats, flushSessionQueue } from '../utils/storage';
import { useTimer } from '../context/TimerContext';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const [todayCount, setTodayCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showMoodPopup, setShowMoodPopup] = useState(false);
  const { user } = useAuth();
  const { completedSession: timerDone, taskLabel, ackSession, updateCompletedSession } = useTimer();

  const refresh = async () => {
    const [count, stats] = await Promise.all([getTodayCount(user?.id), getStats(user?.id)]);
    setTodayCount(count);
    setStreak(stats.streak);
  };

  useEffect(() => { if (user?.id) refresh(); }, [user?.id]);

  // When the timer naturally finishes, surface the completed session + end sound.
  useEffect(() => {
    if (timerDone != null) {
      playAlarm();
      setShowMoodPopup(true);
    }
  }, [timerDone?.clientId]);

  // Retry durable local sessions on reconnect. The queue removes an item only
  // after the server confirms it, and emits an event for the pending popup.
  useEffect(() => {
    if (!user?.id) return undefined;
    const onSynced = (event) => {
      if (String(event.detail?.userId) !== String(user.id)) return;
      if (event.detail?.clientId === timerDone?.clientId) {
        ackSession(timerDone.clientId);
        setShowMoodPopup(false);
      }
      refresh();
    };
    const retry = () => flushSessionQueue(user.id).then(refresh);
    window.addEventListener('fh-session-synced', onSynced);
    window.addEventListener('online', retry);
    retry();
    return () => {
      window.removeEventListener('fh-session-synced', onSynced);
      window.removeEventListener('online', retry);
    };
  }, [user?.id, timerDone?.clientId, ackSession]);

  const handleMoodSave = async ({ duration, mood, note }) => {
    // The optional task label is saved together with the session.
    const combinedNote = [taskLabel, note].filter(Boolean).join(' — ');
    const pending = timerDone;
    if (pending) updateCompletedSession({ mood, note: combinedNote });
    const result = await saveSession({
      duration, mood, note: combinedNote, userId: user.id,
      idempotencyKey: pending?.clientId, completedAt: pending?.completedAt,
    });
    setShowMoodPopup(false);
    if (result.synced) ackSession(result.clientId);
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
          duration={timerDone.duration}
          onSave={handleMoodSave}
          initialMood={timerDone.mood}
          initialNote={timerDone.note}
          onClose={() => { playClick(); setShowMoodPopup(false); }}
        />
      )}
    </div>
  );
};

export default Home;
