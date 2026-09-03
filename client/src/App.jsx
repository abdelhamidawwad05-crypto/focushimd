import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import MouseGlow from './components/MouseGlow';
import AnimatedBackground from './components/AnimatedBackground';
import Home from './pages/Home';
import History from './pages/History';
import Stats from './pages/Stats';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
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
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
