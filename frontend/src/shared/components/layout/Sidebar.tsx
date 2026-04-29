import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Briefcase, CalendarCheck, DatabaseZap, Settings } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/candidates', label: 'Candidates', icon: Users },
  { to: '/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/interviews', label: 'Interviews', icon: CalendarCheck },
  { to: '/talent-pool', label: 'Talent Pool', icon: DatabaseZap },
];

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, mobileOpen, onToggle, onMobileClose }: SidebarProps) {
  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={onMobileClose} />
      )}

      <aside className={cn(
        'fixed left-0 top-0 h-screen bg-bg-panel border-r border-border-subtle flex flex-col z-50 transition-all duration-200 group/sidebar',
        collapsed ? 'w-16' : 'w-56',
        'max-md:w-56',
        mobileOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full',
      )}>
        {/* Logo */}
        <div className="flex items-center justify-center border-b border-border-subtle h-12 shrink-0">
          <span className="inline-flex items-center gap-2 text-base font-bold tracking-tight">
            {/* Logo icon — CV icon with 4 corner brackets on orange bg */}
            <span className="relative w-7 h-7 rounded-md shrink-0 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="relative z-10">
                <rect x="3" y="1" width="8" height="12" rx="1" stroke="currentColor" strokeWidth="1.8" className="text-accent" />
                <line x1="5" y1="4.5" x2="9" y2="4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="text-accent" />
                <line x1="5" y1="6.5" x2="9" y2="6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="text-accent" />
                <line x1="5" y1="8.5" x2="7.5" y2="8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="text-accent" />
              </svg>
              <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 border-t-2 border-l-2 border-accent" />
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 border-t-2 border-r-2 border-accent" />
              <span className="absolute bottom-0.5 left-0.5 w-1.5 h-1.5 border-b-2 border-l-2 border-accent" />
              <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 border-b-2 border-r-2 border-accent" />
            </span>
            {!collapsed && <span className="text-accent">LF Talent Scan</span>}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onMobileClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors whitespace-nowrap overflow-hidden',
                  collapsed ? 'justify-center px-0' : 'px-2.5',
                  isActive
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface'
                )
              }
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={16} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Settings */}
        <div className="px-2 py-3 border-t border-border-subtle shrink-0">
          <NavLink
            to="/settings"
            onClick={onMobileClose}
            className={cn(
              'flex items-center gap-2.5 py-1.5 rounded-md text-[13px] font-medium text-text-tertiary hover:text-text-primary hover:bg-bg-surface transition-colors whitespace-nowrap overflow-hidden',
              collapsed ? 'justify-center px-0' : 'px-2.5',
            )}
            title={collapsed ? 'Settings' : undefined}
          >
            <Settings size={16} className="shrink-0" />
            {!collapsed && <span>Settings</span>}
          </NavLink>
        </div>

        {/* Toggle button — vertically centered */}
        <button
          onClick={onToggle}
          className={cn(
            'hidden md:flex absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 items-center justify-center',
            'bg-bg-panel border border-border-default rounded-full shadow-sm',
            'text-text-muted hover:text-text-primary hover:border-accent transition-all',
            'opacity-0 group-hover/sidebar:opacity-100',
          )}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={cn('transition-transform', collapsed && 'rotate-180')}>
            <path d="M8 2L4 6L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </aside>
    </>
  );
}
