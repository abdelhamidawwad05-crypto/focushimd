import { useState, useEffect } from 'react';
import playClick from '../utils/sounds';
import { getSessions } from '../utils/storage';

const History = () => {
  const [sessions, setSessions] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    getSessions(filter).then(setSessions);
  }, [filter]);

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });

  const moodColor = { good: 'var(--color-good)', okay: 'var(--color-okay)', rough: 'var(--color-rough)' };

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
      {Object.keys(grouped).length===0 ? (
        <div className="empty-state">No sessions yet. Start focusing!</div>
      ) : (
        <div className="sessions-list">
          {Object.entries(grouped).map(([date, daySessions]) => (
            <div key={date} className="session-group">
              <h3>{date}</h3>
              {daySessions.map(s => (
                <div key={s.id} className="session-card">
                  <div className="session-mood" style={{background:moodColor[s.mood]}} />
                  <div className="session-info">
                    <span className="session-time">{formatDate(s.completedAt)}</span>
                    <span className="session-duration-text">{s.duration} min focused</span>
                  </div>
                  {s.note && <p className="session-note">{s.note}</p>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default History;