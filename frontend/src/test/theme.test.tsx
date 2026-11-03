import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ThemeProvider, useTheme } from '../hooks/useTheme';

function TestThemeConsumer() {
  const { theme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <button onClick={toggleTheme} data-testid="toggle-btn">Toggle</button>
      <button onClick={() => setTheme('light')} data-testid="set-light">Light</button>
      <button onClick={() => setTheme('dark')} data-testid="set-dark">Dark</button>
    </div>
  );
}

describe('useTheme and ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('initializes with default dark theme when no stored preference exists', () => {
    render(
      <ThemeProvider>
        <TestThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggles theme between dark and light', () => {
    render(
      <ThemeProvider>
        <TestThemeConsumer />
      </ThemeProvider>
    );

    const toggleBtn = screen.getByTestId('toggle-btn');
    fireEvent.click(toggleBtn);

    expect(screen.getByTestId('current-theme').textContent).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('aegis_theme')).toBe('light');

    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('current-theme').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('aegis_theme')).toBe('dark');
  });

  it('sets theme directly via setTheme', () => {
    render(
      <ThemeProvider>
        <TestThemeConsumer />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByTestId('set-light'));
    expect(screen.getByTestId('current-theme').textContent).toBe('light');
    expect(localStorage.getItem('aegis_theme')).toBe('light');

    fireEvent.click(screen.getByTestId('set-dark'));
    expect(screen.getByTestId('current-theme').textContent).toBe('dark');
    expect(localStorage.getItem('aegis_theme')).toBe('dark');
  });
});
