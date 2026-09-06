import { useState } from 'react';
import playClick from '../utils/sounds';

const MoodPopup = ({ duration, initialMood, initialNote, onSave, onClose }) => {
  const [mood, setMood] = useState(initialMood || null);
  const [note, setNote] = useState(initialNote || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const moods = [
    { value: 'good', label: 'Good', color: '#4ade80' },
    { value: 'okay', label: 'Okay', color: '#facc15' },
    { value: 'rough', label: 'Rough', color: '#f87171' }
  ];

  const handleSave = async () => {
    if (!mood || saving) return;
    setError('');
    setSaving(true);
    playClick();
    try {
      await onSave({ duration, mood, note });
    } catch (err) {
      setError(err.message || 'Could not save this session. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleMoodSelect = (value) => {
    playClick();
    setMood(value);
  };

  return (
      <div className="modal-overlay" onClick={saving ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Session Complete</h3>
          <button className="modal-close" onClick={() => { if (!saving) { playClick(); onClose(); } }} aria-label="Close" disabled={saving}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="modal-body">
          <p className="session-duration">{duration} minutes focused</p>
          <p className="mood-label">How are you feeling?</p>
          {error && <div className="fh-error" role="alert">{error}</div>}
          <div className="mood-options">
            {moods.map((m) => (
              <button
                key={m.value}
                className={`mood-btn ${mood === m.value ? 'selected' : ''}`}
                onClick={() => handleMoodSelect(m.value)}
                disabled={saving}
                style={{ '--mood-color': m.color }}
              >
                <span className="mood-dot" />
                <span className="mood-text">{m.label}</span>
              </button>
            ))}
          </div>
          <textarea
            className="mood-note"
            placeholder="Add a note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={saving}
            rows={3}
          />
          <button className="btn btn-full" onClick={handleSave} disabled={!mood || saving}>
            {saving ? 'Saving…' : 'Save Session'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoodPopup;
