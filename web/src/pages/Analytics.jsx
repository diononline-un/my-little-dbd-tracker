import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, pct } from '../api.js';

function RateTable({ rows, label, rateKey, countKey, rateFn }) {
  if (!rows?.length) return <p className="muted">Not enough data yet.</p>;
  const max = Math.max(...rows.map((r) => r[countKey]));
  return (
    <table>
      <thead>
        <tr><th>{label}</th><th>Matches</th><th>Rate</th><th style={{ width: 160 }} /></tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const rate = rateFn(r);
          return (
            <tr key={i}>
              <td>{r[rateKey] ?? '—'}</td>
              <td>{r[countKey]}</td>
              <td>{pct(rate)}</td>
              <td>
                <div className="bar">
                  <span
                    className={rate != null && rate < 0.4 ? 'low' : ''}
                    style={{ width: `${(rate ?? 0) * 100}%` }}
                  />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function Analytics() {
  const [tab, setTab] = useState('killers');
  const killers = useQuery({ queryKey: ['an', 'killers'], queryFn: () => api.killers() });
  const builds = useQuery({ queryKey: ['an', 'builds'], queryFn: () => api.builds() });
  const teammates = useQuery({ queryKey: ['an', 'teammates'], queryFn: () => api.teammates() });

  return (
    <>
      <h2>Analytics</h2>
      <div className="tabs">
        {['killers', 'builds', 'teammates'].map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'killers' && (
        <>
          <p className="muted">Your escape rate as survivor, by the killer you faced.</p>
          <RateTable
            rows={killers.data?.killers}
            label="Killer"
            rateKey="killerName"
            countKey="matches"
            rateFn={(r) => r.escapeRate}
          />
        </>
      )}
      {tab === 'builds' && (
        <>
          <p className="muted">Your escape rate by a perk you were running.</p>
          <RateTable
            rows={builds.data?.builds}
            label="Perk"
            rateKey="perkName"
            countKey="matches"
            rateFn={(r) => r.escapeRate}
          />
        </>
      )}
      {tab === 'teammates' && (
        <>
          <p className="muted">Your escape rate when a random teammate ran a given perk (solo-queue).</p>
          <RateTable
            rows={teammates.data?.teammates}
            label="Teammate perk"
            rateKey="perkName"
            countKey="matches"
            rateFn={(r) => r.selfEscapeRateWhenPresent}
          />
        </>
      )}
    </>
  );
}
