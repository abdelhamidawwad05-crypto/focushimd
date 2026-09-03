import { useState, useEffect } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Filler } from 'chart.js';
import { getStats, getWeekly, getSessions } from '../utils/storage';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Filler);

const Stats = () => {
  const [weeklyData, setWeeklyData] = useState(null);
  const [stats, setStats] = useState({ streak: 0, totalHours: 0, totalSessions: 0 });
  const [prevWeekHours, setPrevWeekHours] = useState(0);
  const [repos, setRepos] = useState([]);

  useEffect(() => {
    const load = async () => {
      const [w, s] = await Promise.all([getWeekly(), getStats()]);
      setWeeklyData(w);
      setStats(s);

      // prev week comparison
      try {
        const all = await getSessions('all');
        const now = new Date();
        const startPrev = new Date(now); startPrev.setDate(now.getDate() - 14);
        const endPrev = new Date(now); endPrev.setDate(now.getDate() - 7);
        const prev = all.filter(x => {
          const d = new Date(x.completedAt);
          return d >= startPrev && d < endPrev;
        });
        const h = prev.reduce((a, b) => a + Number(b.duration), 0) / 60;
        setPrevWeekHours(parseFloat(h.toFixed(1)));
      } catch {}

      fetch('https://api.github.com/users/focushimd/repos?sort=updated&per_page=6')
        .then(r => r.json()).then(d => { if (Array.isArray(d)) setRepos(d); }).catch(()=>{});
    };
    load();
  }, []);

  if (!weeklyData) return <div className="loading">Loading...</div>;

  const labels = Object.values(weeklyData).map(d => d.label);
  const hours = Object.values(weeklyData).map(d => parseFloat(d.hours.toFixed(2)));
  const maxHours = Math.max(1, ...hours);
  const bgHours = hours.map(h => maxHours + 0.8);

  const diff = parseFloat((stats.totalHours - prevWeekHours).toFixed(1));
  const diffText = diff >= 0 ? `+${diff} hrs vs last week` : `${diff} hrs vs last week`;

  let mostIdx = 0;
  hours.forEach((h, i) => { if (h > hours[mostIdx]) mostIdx = i; });
  const mostDay = labels[mostIdx] || '—';
  const mostDayFull = { Mon:'Monday', Tue:'Tuesday', Wed:'Wednesday', Thu:'Thursday', Fri:'Friday', Sat:'Saturday', Sun:'Sunday' }[mostDay] || mostDay;
  const avgMost = hours[mostIdx] ? hours[mostIdx].toFixed(1) : '0';

  // Mood quality line — map mood to score per day
  const moodScore = { good: 3, okay: 2, rough: 1 };
  const moodDaily = Object.values(weeklyData).map(d => {
    if (!d.moods.length) return null;
    const avg = d.moods.reduce((a, m) => a + moodScore[m], 0) / d.moods.length;
    return parseFloat(avg.toFixed(2));
  });

  const moodLabels = labels;
  const hasMood = moodDaily.some(v => v !== null);
  const moodDataPoints = moodDaily.map(v => v ?? null);
  const lastMood = [...moodDaily].reverse().find(v => v !== null);
  const moodBadge = lastMood >= 2.5 ? 'Good' : lastMood >= 1.7 ? 'Okay' : lastMood ? 'Rough' : '—';

  const dotColors = moodDaily.map(v => {
    if (v === null) return 'transparent';
    if (v >= 2.5) return '#4ade80';
    if (v >= 1.7) return '#facc15';
    return '#6366f1';
  });

  return (
    <div className="stats-page stats-sample">
      <div className="stats-header">
        <h2>Stats</h2>
        <p>Your weekly overview.</p>
      </div>

      <div className="stats-top-row">
        <div className="stat-card sample-card">
          <div className="card-icon"><span className="icon-timer">⏱</span></div>
          <div className="card-label">TOTAL FOCUS</div>
          <div className="card-value">{stats.totalHours}<span> hrs</span></div>
          <div className="card-sub good">{diffText}</div>
        </div>
        <div className="stat-card sample-card">
          <div className="card-icon"><span className="icon-cal">📅</span></div>
          <div className="card-label">MOST FOCUSED DAY</div>
          <div className="card-value large">{mostDayFull}</div>
          <div className="card-sub">Average {avgMost} hrs</div>
        </div>
      </div>

      <div className="stats-charts-row">
        <div className="chart-card">
          <div className="chart-head">
            <h3>Weekly Focus</h3>
            <span>Hours/Day</span>
          </div>
          <div className="chart-body weekly-bar">
            <Bar
              data={{
                labels,
                datasets: [
                  { data: bgHours, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, barPercentage: 0.62, categoryPercentage: 0.72 },
                  { data: hours, backgroundColor: '#4ADE80', hoverBackgroundColor: '#5aeba0', borderRadius: 4, barPercentage: 0.62, categoryPercentage: 0.72 }
                ]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e1f25', titleColor: '#f0f0f0', bodyColor: '#9ca3af', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, padding: 10, displayColors: false, callbacks: { label: c => ` ${c.raw} hrs` } } },
                scales: {
                  x: { grid: { display: false }, border: { display: false }, ticks: { color: '#6b7280', font: { size: 11 } } },
                  y: { display: false, min: 0, max: maxHours + 1 }
                }
              }}
            />
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-head">
            <h3>Mood Quality</h3>
            <span className="mood-badge">{moodBadge}</span>
          </div>
          <div className="chart-body mood-line">
            {hasMood ? (
              <Line
                data={{
                  labels: moodLabels,
                  datasets: [{
                    data: moodDataPoints,
                    borderColor: '#4ade80',
                    backgroundColor: (ctx) => {
                      const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 160);
                      g.addColorStop(0, 'rgba(74,222,128,0.22)');
                      g.addColorStop(1, 'rgba(74,222,128,0)');
                      return g;
                    },
                    fill: true,
                    tension: 0.42,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: dotColors,
                    pointBorderColor: '#191a1f',
                    pointBorderWidth: 1.5,
                    borderWidth: 2,
                    spanGaps: true
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { mode: 'index', intersect: false },
                  plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e1f25', titleColor: '#f0f0f0', bodyColor: '#9ca3af', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, padding: 10, displayColors: false } },
                  scales: {
                    x: { display: false },
                    y: { display: false, min: 0, max: 3.5 }
                  }
                }}
              />
            ) : (
              <div className="empty-chart">No mood data yet — complete a session</div>
            )}
          </div>
        </div>
      </div>

      {repos.length > 0 && (
        <div className="github-section">
          <h2>GitHub Repos</h2>
          <div className="github-grid">
            {repos.map(repo => (
              <a key={repo.id} href={repo.html_url} target="_blank" rel="noopener noreferrer" className="repo-card">
                <div className="repo-name">{repo.name}</div>
                <div className="repo-desc">{repo.description || 'No description'}</div>
                <div className="repo-meta">
                  {repo.language && <span><span className="repo-lang" style={{ background: ({ JavaScript:'#f1e05a', TypeScript:'#3178c6', Python:'#3572A5' }[repo.language] || '#999') }}></span>{repo.language}</span>}
                  <span>⭐ {repo.stargazers_count}</span>
                  <span>🍴 {repo.forks_count}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Stats;
