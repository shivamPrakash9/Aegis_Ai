import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { User, LogOut, Shield, ChevronDown } from 'lucide-react';

export function UserMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 rounded-lg border border-border bg-card hover:bg-muted/60 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
        aria-expanded={isOpen}
      >
        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
          {user.displayName ? user.displayName.slice(0, 2).toUpperCase() : 'AI'}
        </div>
        <div className="hidden md:flex flex-col text-left">
          <span className="text-xs font-semibold text-foreground leading-none truncate max-w-[120px]">
            {user.displayName || user.email}
          </span>
          <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
            {user.role}
          </span>
        </div>
        <ChevronDown className="h-3 w-3 text-muted-foreground ml-0.5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border border-border bg-card p-1 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-2 border-b border-border mb-1">
            <p className="text-xs font-semibold text-foreground truncate">{user.displayName}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
            <div className="flex items-center gap-1 mt-1.5">
              <Shield className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">{user.role}</span>
            </div>
          </div>
          <button
            onClick={() => {
              setIsOpen(false);
              logout();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
