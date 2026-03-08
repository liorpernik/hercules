import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const EntrancePage = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  // Theme Toggle Component
  const ThemeToggle = () => (
    <div className="absolute top-6 right-6 flex bg-secondary/50 backdrop-blur-md rounded-full p-1 border border-border/50">
      <button
        onClick={() => setTheme('light')}
        className={`p-2 rounded-full transition-all ${theme === 'light' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        title="Light Mode"
      >
        ☀️
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`p-2 rounded-full transition-all ${theme === 'dark' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        title="Dark Mode"
      >
        🌙
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`p-2 rounded-full transition-all ${theme === 'system' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        title="System"
      >
        🖥️
      </button>
    </div>
  );

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background via-muted to-accent transition-colors duration-500">
      <ThemeToggle />

      {/* Background Blobs for Atmosphere */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-500/20 rounded-full blur-[120px] animate-pulse pointer-events-none delay-1000" />

      <div className="z-10 flex flex-col items-center max-w-5xl w-full">
        <h1 className="text-6xl font-extrabold mb-4 bg-gradient-to-r from-primary to-purple-600 text-transparent bg-clip-text tracking-tight animate-fade-in-up">
          Pernik Law AI
        </h1>
        <p className="text-xl text-muted-foreground mb-16 font-light tracking-wide animate-fade-in-up delay-100">
          Select your intelligent workspace
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mb-12">
          {/* Hercules Card */}
          <div
            onClick={() => navigate('/hercules')}
            className="glass-card p-10 rounded-3xl cursor-pointer group hover:-translate-y-2 transition-transform duration-300"
          >
            <div className="h-16 w-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-8 text-3xl group-hover:bg-blue-500/20 transition-colors">
              ⚖️
            </div>
            <h2 className="text-3xl font-bold mb-3 text-foreground group-hover:text-blue-600 transition-colors">Hercules</h2>
            <p className="text-muted-foreground leading-relaxed">
              Strategic case management, intelligent scheduling.
            </p>
          </div>

          {/* Moneta Card */}
          <div
            onClick={() => navigate('/moneta')}
            className="glass-card p-10 rounded-3xl cursor-pointer group hover:-translate-y-2 transition-transform duration-300"
          >
            <div className="h-16 w-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-8 text-3xl group-hover:bg-emerald-500/20 transition-colors">
              💰
            </div>
            <h2 className="text-3xl font-bold mb-3 text-foreground group-hover:text-emerald-600 transition-colors">Moneta</h2>
            <p className="text-muted-foreground leading-relaxed">
              Tactical collections recovery, compassionate negotiation, and revenue optimization.
            </p>
          </div>
        </div>

        {/* Feature Buttons */}
        <div className="flex gap-6 animate-fade-in-up delay-200">
          <button
            onClick={() => navigate('/hercules?action=personal-tasks')}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-orange-400 to-pink-500 text-white font-bold shadow-lg hover:shadow-orange-500/25 hover:scale-105 transition-all flex items-center gap-2"
          >
            <span>📝</span> Personal Tasks
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-8 py-3 rounded-xl bg-card border border-border text-foreground font-semibold hover:bg-muted transition-all shadow-sm flex items-center gap-2"
          >
            <span>📊</span> Dashboard
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="px-8 py-3 rounded-xl bg-card border border-border text-foreground font-semibold hover:bg-muted transition-all shadow-sm flex items-center gap-2"
          >
            <span>⚙️</span> Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default EntrancePage;
