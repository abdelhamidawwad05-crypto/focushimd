import { useState } from 'react';
import playClick from '../utils/sounds';

const MoodPopup = ({ duration, onSave, onClose }) => {
  const [mood, setMood] = useState(null);
  const [note, setNote] = useState('');

  const moods = [
    { value: 'good', label: 'Good', emoji: '😊' },
    { value: 'okay', label: 'Okay', emoji: '😐' },
    { value: 'rough', label: 'Rough', emoji: '😔' }
  ];

  const handleSave = () => {
    if (!mood) return;
    playClick();
    onSave({ duration, mood, note });
  };

  const handleMoodSelect = (value) => {
    playClick();
    setMood(value);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Session Complete</h3>
          <button className="modal-close" onClick={() => { playClick(); onClose(); }}>✕</button>
        </div>
        <div className="modal-body">
          <p className="session-duration">{duration} minutes focused</p>
          <p className="mood-label">How are you feeling?</p>
          <div className="mood-options">
            {moods.map((m) => (
              <button
                key={m.value}
                className={`mood-btn ${mood === m.value ? 'selected' : ''}`}
                onClick={() => handleMoodSelect(m.value)}
              >
                <span className="mood-emoji">{m.emoji}</span>
                <span className="mood-text">{m.label}</span>
              </button>
            ))}
          </div>
          <textarea
            className="mood-note"
            placeholder="Add a note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
          <button className="btn btn-full" onClick={handleSave} disabled={!mood}>
            Save Session
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoodPopup;
