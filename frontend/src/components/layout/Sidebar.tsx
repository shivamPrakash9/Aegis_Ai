import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  Shield,
  LayoutDashboard,
  Bot,
  FileText,
  GitCommit,
  ShieldCheck,
  Sliders,
  CheckSquare,
  FileSearch,
  Cpu,
  Users,
  Building2,
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile
}: SidebarProps) {
  const { user, isAdmin } = useAuth();

  const navGroups = [
    {
      title: 'WORKSPACE',
      items: [
        { label: 'Overview', to: '/overview', icon: LayoutDashboard },
        { label: 'AI Playground', to: '/playground', icon: Bot },
        { label: 'AI Requests', to: '/requests', icon: FileText },
        { label: 'Request Traces', to: '/traces', icon: GitCommit }
      ]
    },
    {
      title: 'SECURITY & GOVERNANCE',
      items: [
        { label: 'Privacy Scanner', to: '/privacy', icon: ShieldCheck },
        { label: 'Policies', to: '/policies', icon: Sliders },
        { label: 'Approval Center', to: '/approvals', icon: CheckSquare },
        { label: 'Security Audit', to: '/audit', icon: FileSearch }
      ]
    },
    {
      title: 'PLATFORM',
      items: [
        { label: 'Model Providers', to: '/models', icon: Cpu },
        ...(isAdmin
          ? [
              { label: 'Organization', to: '/organization', icon: Building2 },
              { label: 'Developers & Team', to: '/developers', icon: Users }
            ]
          : []),
        { label: 'Settings', to: '/settings', icon: Settings }
      ]
    }
  ];

  const sidebarContent = (
    <aside
      className={`h-full flex flex-col border-r border-border bg-card transition-all duration-200 select-none ${
        isCollapsed ? 'w-18' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm shadow-primary/20">
            <Shield className="h-5 w-5" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-foreground flex items-center gap-1.5">
                AegisAI
                <span className="text-[10px] uppercase font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm">
                  v1.0
                </span>
              </span>
              <span className="text-[11px] text-muted-foreground truncate max-w-[130px]">
                Security Gateway
              </span>
            </div>
          )}
        </div>
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            {!isCollapsed && (
              <h4 className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                {group.title}
              </h4>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    } ${isCollapsed ? 'justify-center px-0' : ''}`
                  }
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer Info */}
      {!isCollapsed && (
        <div className="p-3 border-t border-border m-2 rounded-lg bg-muted/40">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[11px] font-medium text-muted-foreground">All Services Operational</span>
          </div>
          <p className="text-[10px] text-muted-foreground/80 mt-1 truncate">
            Tenant: {user?.organizationId || 'default'}
          </p>
        </div>
      )}
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:block h-screen shrink-0">{sidebarContent}</div>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={onCloseMobile} />
          <div className="relative z-10 w-64 max-w-[80vw] h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
