import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const routeNames: Record<string, string> = {
  playground: 'AI Playground',
  requests: 'AI Requests',
  traces: 'Request Traces',
  privacy: 'Privacy Scanner',
  policies: 'Policies',
  approvals: 'Approval Center',
  audit: 'Security Audit',
  models: 'Model Providers',
  users: 'Users & Organizations',
  settings: 'Settings'
};

export function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
        <Home className="h-3.5 w-3.5" />
        <span>Workspace</span>
        <ChevronRight className="h-3 w-3 opacity-60" />
        <span className="text-foreground font-semibold">Overview</span>
      </div>
    );
  }

  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium" aria-label="Breadcrumb">
      <Link to="/" className="flex items-center gap-1 hover:text-foreground transition-colors">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {segments.map((seg, idx) => {
        const isLast = idx === segments.length - 1;
        const path = `/${segments.slice(0, idx + 1).join('/')}`;
        const name = routeNames[seg] || seg;

        return (
          <React.Fragment key={path}>
            <ChevronRight className="h-3 w-3 opacity-60" />
            {isLast ? (
              <span className="text-foreground font-semibold truncate max-w-[150px]">{name}</span>
            ) : (
              <Link to={path} className="hover:text-foreground transition-colors truncate max-w-[120px]">
                {name}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
