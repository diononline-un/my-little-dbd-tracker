import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from './api.js';

const NAV = [
  { to: '/', label: 'Overview', end: true },
  { to: '/trends', label: 'Trends' },
  { to: '/matches', label: 'Matches' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/settings', label: 'Settings' },
];

const cls = ({ isActive }) => (isActive ? 'topnav-link active' : 'topnav-link');

export default function App() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  // tiny liveness pill — is the backend reachable / does it have data
  const health = useQuery({
    queryKey: ['summary'], queryFn: api.summary, refetchInterval: 60_000, retry: false,
  });

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark" />
            ENTITYTRACK
          </div>

          <nav className={`topnav${open ? ' is-open' : ''}`}>
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={cls}>{n.label}</NavLink>
            ))}
          </nav>

          <div className="topbar-right">
            <span className={`live-pill${health.isError ? ' down' : ''}`} title={health.isError ? 'backend unreachable' : 'collecting'}>
              <span className="dot" />
              {health.isError ? 'offline' : `${health.data?.totalMatches ?? '—'} tracked`}
            </span>
            <button className="topnav-toggle" aria-label="menu" onClick={() => setOpen((o) => !o)}>☰</button>
          </div>
        </div>
      </header>

      <main className="page">
        <Outlet />
      </main>

      <footer className="site-footer">
        <span>EntityTrack · self-hosted · data from the official BHVR stats API</span>
        <a href="https://github.com/diononline-un/entitytrack" target="_blank" rel="noreferrer">source</a>
      </footer>
    </>
  );
}
