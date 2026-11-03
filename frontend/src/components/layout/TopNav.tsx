import React from 'react';
import { Breadcrumbs } from './Breadcrumbs';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import { Menu } from 'lucide-react';

interface TopNavProps {
  onOpenMobileSidebar: () => void;
}

export function TopNav({ onOpenMobileSidebar }: TopNavProps) {
  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="p-1.5 rounded-lg border border-border md:hidden text-muted-foreground hover:bg-muted focus:outline-none"
          aria-label="Open sidebar"
        >
          <Menu className="h-4 w-4" />
        </button>
        <Breadcrumbs />
      </div>

      <div className="flex items-center gap-2.5">
        <ThemeToggle />
        <div className="h-5 w-px bg-border mx-1 hidden sm:block" />
        <UserMenu />
      </div>
    </header>
  );
}
