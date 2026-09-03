const AnimatedBackground = () => {
  return (
    <div className="animated-bg" aria-hidden="true">
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />
      <div className="bg-orb orb-3" />

      <div className="study-scene">
        <svg width="320" height="220" viewBox="0 0 320 220" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g opacity="0.07">
            <rect x="60" y="140" width="200" height="12" rx="6" fill="#4ade80" />
            <rect x="80" y="110" width="44" height="32" rx="4" fill="#fff" />
            <rect x="84" y="116" width="36" height="2" rx="1" fill="#191a1f" opacity="0.3" />
            <rect x="84" y="122" width="28" height="2" rx="1" fill="#191a1f" opacity="0.2" />
            <rect x="84" y="128" width="32" height="2" rx="1" fill="#191a1f" opacity="0.2" />
            <rect x="130" y="110" width="44" height="32" rx="4" fill="#fff" opacity="0.9" />
            <rect x="134" y="116" width="36" height="2" rx="1" fill="#191a1f" opacity="0.3" />
            <rect x="134" y="122" width="28" height="2" rx="1" fill="#191a1f" opacity="0.2" />
            <circle cx="160" cy="78" r="22" fill="#fff" />
            <path d="M138 78 C138 60 145 48 160 48 C175 48 182 60 182 78" fill="#4ade80" opacity="0.9" />
            <circle cx="154" cy="78" r="1.5" fill="#191a1f" />
            <circle cx="166" cy="78" r="1.5" fill="#191a1f" />
            <path d="M155 86 Q160 90 165 86" stroke="#191a1f" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            <rect x="144" y="100" width="32" height="28" rx="8" fill="#4ade80" />
            <rect x="110" y="108" width="36" height="10" rx="5" fill="#fff" opacity="0.8" />
            <rect x="174" y="108" width="36" height="10" rx="5" fill="#fff" opacity="0.8" />
            <g className="lamp-glow">
              <rect x="220" y="70" width="3" height="45" rx="1.5" fill="#fff" opacity="0.5" />
              <path d="M200 70 L240 70 L232 90 L208 90 Z" fill="#4ade80" opacity="0.8" />
              <ellipse cx="220" cy="92" rx="22" ry="8" fill="#4ade80" opacity="0.1" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
};

export default AnimatedBackground;