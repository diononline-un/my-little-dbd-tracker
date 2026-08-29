export default function Settings() {
  return (
    <>
      <h2>Settings</h2>
      <p className="muted">
        EntityTrack has two moving parts. This dashboard only reads the backend database.
      </p>
      <ol className="muted" style={{ lineHeight: 1.8 }}>
        <li>
          <strong>Backend</strong> — the container serving this page and the{' '}
          <code>/api</code>. Configure it with env vars (<code>INGEST_TOKEN</code>,{' '}
          <code>PORT</code>, <code>DB_PATH</code>); see <code>docker-compose.yml</code>.
        </li>
        <li>
          <strong>Collector extension</strong> — load it unpacked in Chrome/Brave from{' '}
          <code>extension/</code>, then open its options page and set the backend URL +
          ingest token. It polls <code>stats.deadbydaylight.com</code> every 10 minutes.
        </li>
      </ol>
      <p className="muted">
        Data source: the official <code>account-backend.bhvr.com</code> match-history API.
        Automated polling of it is a grey area under BHVR's Terms of Use — the collector
        stays at a 10-minute floor and backs off on errors. Use at your own risk.
      </p>
    </>
  );
}
