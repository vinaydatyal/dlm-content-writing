import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, PenTool, Users, Archive, Settings, LogOut, FileText, Calendar, Layers, Compass } from 'lucide-react';

export default function Layout({ onLogout }) {
  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <FileText size={24} />
          Digital Leap Content Dashboard
        </div>
        
        <nav className="sidebar-nav">
          <NavLink to="/" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
            <LayoutDashboard size={20} />
            Dashboard
          </NavLink>
          <NavLink to="/new" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
            <PenTool size={20} />
            New Content
          </NavLink>
          <NavLink to="/planner" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
            <Compass size={20} />
            Topic Strategy
          </NavLink>
          <NavLink to="/bulk" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
            <Layers size={20} />
            Bulk Generate
          </NavLink>
          <NavLink to="/calendar" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
            <Calendar size={20} />
            Calendar
          </NavLink>
          <NavLink to="/clients" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
            <Users size={20} />
            Clients
          </NavLink>
          <NavLink to="/templates" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
            <Settings size={20} />
            Templates
          </NavLink>
          <NavLink to="/library" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
            <Archive size={20} />
            Library
          </NavLink>
        </nav>
        
        <div className="sidebar-footer">
          <button onClick={onLogout} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', border: 'none', background: 'transparent' }}>
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>
      
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
