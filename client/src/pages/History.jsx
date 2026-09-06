import { useState, useEffect } from 'react';
import playClick from '../utils/sounds';
import { getSessions } from '../utils/storage';
import { useAuth } from '../context/AuthContext';

const MOOD_META = {
  good: { label: 'Good', color: 'var(--color-good)' },
  okay: { label: 'Okay', color: 'var(--color-okay)' },
  rough: { label: 'Rough', color: 'var(--color-rough)' },
};

const History = () => {
  const [sessions, setSessions] = useState([]);
  const [filter, setFilter] = useState('all');
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    getSessions(filter, user.id).then((data) => {
      // Guarantee newest-first regardless of source (API or local fallback).
      const sorted = [...data].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
      setSessions(sorted);
    });
  }, [filter, user?.id]);

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });

  const grouped = sessions.reduce((acc, s) => {
    const date = new Date(s.completedAt).toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(s);
    return acc;
  }, {});

  return (
    <div className="history-page">
      <h2>Session History</h2>
      <div className="filter-bar">
        {['all','week','month'].map(f => (
          <button key={f} className={`filter-btn ${filter===f?'active':''}`} onClick={()=>{ playClick(); setFilter(f); }}>
            {f==='all'?'All Time':f==='week'?'This Week':'This Month'}
          </button>
        ))}
      </div>
      {sessions.length===0 ? (
        <div className="empty-state">No sessions yet. Start focusing!</div>
      ) : (
        <div className="sessions-list">
          {Object.entries(grouped).map(([date, daySessions]) => (
            <div key={date} className="session-group">
              <h3>{date}</h3>
              {daySessions.map(s => {
                const mood = MOOD_META[s.mood] || { label: '—', color: 'var(--text-muted)' };
                return (
                  <div key={s.id} className="session-card">
                    <div className="session-mood" style={{ background:mood.color }} />
                    <div className="session-info">
                      <span className="session-time">{formatDate(s.completedAt)}</span>
                      <span className="session-duration-text">{s.duration} min focused</span>
                      {mood.label !== '—' && <span className="session-mood-label">{mood.label}</span>}
                    </div>
                    {s.note && <p className="session-note">{s.note}</p>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default History;
