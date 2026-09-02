import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import MouseGlow from './components/MouseGlow';
import AnimatedBackground from './components/AnimatedBackground';
import Home from './pages/Home';
import History from './pages/History';
import Stats from './pages/Stats';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <AnimatedBackground />
      <MouseGlow />
      <div className="app">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/history" element={<History />} />
            <Route path="/stats" element={<Stats />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
