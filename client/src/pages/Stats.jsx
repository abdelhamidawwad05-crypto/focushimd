import { useState, useEffect } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler } from 'chart.js';
import { getStats, getWeekly } from '../utils/storage';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);

const Stats = () => {
  const [weeklyData, setWeeklyData] = useState(null);
  const [stats, setStats] = useState({ streak:0, totalHours:0, totalSessions:0 });
  const [repos, setRepos] = useState([]);

  useEffect(() => {
    Promise.all([getWeekly(), getStats()]).then(([w,s]) => { setWeeklyData(w); setStats(s); });
    fetch('https://api.github.com/users/focushimd/repos?sort=updated&per_page=6')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRepos(data); })
      .catch(() => {});
  }, []);

  if (!weeklyData) return <div className="loading">Loading...</div>;

  const labels = Object.values(weeklyData).map(d=>d.label);
  const hours = Object.values(weeklyData).map(d=>parseFloat(d.hours.toFixed(2)));
  const moodCounts = { good:0, okay:0, rough:0 };
  Object.values(weeklyData).forEach(d => d.moods.forEach(m => moodCounts[m]++));

  const focusData = {
    labels,
    datasets:[{
      label:'Focus Hours', data:hours,
      borderColor:'#4ade80', backgroundColor:'rgba(74,222,128,0.08)',
      fill:true, tension:0.4, pointRadius:5, pointBackgroundColor:'#4ade80',
      pointBorderColor:'#191a1f', pointBorderWidth:2
    }]
  };
  const moodData = {
    labels:['Good','Okay','Rough'],
    datasets:[{ label:'Sessions', data:[moodCounts.good,moodCounts.okay,moodCounts.rough], backgroundColor:['#4ade80','#facc15','#f87171'], borderRadius:8 }]
  };

  const gridColor = 'rgba(255,255,255,0.04)';
  const tickColor = '#6b7280';
  const opts = { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true,grid:{color:gridColor},ticks:{color:tickColor,font:{size:12}}}, x:{grid:{display:false},ticks:{color:tickColor,font:{size:12}}} } };
  const moodOpts = { ...opts, scales:{ ...opts.scales, y:{...opts.scales.y, ticks:{...opts.scales.y.ticks, stepSize:1}} } };

  const streakText = stats.streak === 1 ? '1 day' : `${stats.streak} days`;
  const langColors = { JavaScript:'#f1e05a', TypeScript:'#3178c6', Python:'#3572A5', HTML:'#e34c26', CSS:'#563d7c', Java:'#b07219' };

  return (
    <div className="stats-page">
      <h2>Your Stats</h2>
      <div className="stats-overview">
        <div className="stat-card"><div className="stat-title">Day Streak</div><div className="stat-number">{streakText}</div></div>
        <div className="stat-card"><div className="stat-title">Total Focus</div><div className="stat-number">{stats.totalHours}h</div></div>
        <div className="stat-card"><div className="stat-title">Sessions</div><div className="stat-number">{stats.totalSessions}</div></div>
      </div>
      <div className="chart-container">
        <h3>Weekly Focus Hours</h3>
        <div className="chart-wrapper"><Line data={focusData} options={opts} /></div>
      </div>
      <div className="chart-container">
        <h3>Mood Trend</h3>
        <div className="chart-wrapper"><Bar data={moodData} options={moodOpts} /></div>
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
                  {repo.language && (
                    <span><span className="repo-lang" style={{background:langColors[repo.language]||'#999'}}></span>{repo.language}</span>
                  )}
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
