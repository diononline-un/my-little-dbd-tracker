import { NavLink, Outlet } from 'react-router-dom';

const link = ({ isActive }) => (isActive ? 'active' : undefined);

export default function App() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>ENTITYTRACK</h1>
        <nav>
          <NavLink to="/" end className={link}>Dashboard</NavLink>
          <NavLink to="/matches" className={link}>Matches</NavLink>
          <NavLink to="/analytics" className={link}>Analytics</NavLink>
          <NavLink to="/settings" className={link}>Settings</NavLink>
        </nav>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
