import { useRef, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Shared 6-box verification input. value = digit string (max 6).
// Auto-advances on type, backspace jumps to the previous box,
// pasting a full code fills all boxes. Used by signup step 2 + /verify.
// ---------------------------------------------------------------------------

const CodeInput = ({ value, onChange, disabled, autoFocus = true }) => {
  const inputs = useRef([]);
  const chars = Array.from({ length: 6 }, (_, i) => (value && value[i]) || '');

  useEffect(() => {
    if (autoFocus && inputs.current[0]) inputs.current[0].focus();
  }, [autoFocus]);

  const handleChange = (i, e) => {
    const v = e.target.value.replace(/\D/g, '').slice(-1);
    const next = ((value || '') + '').split('');
    while (next.length < 6) next.push('');
    next[i] = v;
    onChange(next.join('').slice(0, 6));
    if (v && i < 5 && inputs.current[i + 1]) inputs.current[i + 1].focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !chars[i] && i > 0 && inputs.current[i - 1]) {
      inputs.current[i - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    onChange(text);
    const idx = Math.min(text.length, 5);
    if (inputs.current[idx]) inputs.current[idx].focus();
  };

  return (
    <div className="fh-code-row" onPaste={handlePaste}>
      {chars.map((d, i) => (
        <input
          key={i}
          ref={(el) => (inputs.current[i] = el)}
          className="fh-code-box"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={d}
          disabled={disabled}
          placeholder="•"
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
        />
      ))}
    </div>
  );
};

export default CodeInput;
