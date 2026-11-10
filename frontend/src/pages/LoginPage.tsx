import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { authApi } from '../services/auth-api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { Shield, KeyRound, AlertCircle, UserPlus } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (mode === 'login') {
      if (!email.trim() || !password) {
        setErrorMessage('Please provide both email and password.');
        return;
      }

      setIsLoading(true);
      try {
        await login({ email: email.trim().toLowerCase(), password });
        toastSuccess('Authenticated successfully', 'Welcome to AegisAI Governance Gateway');
        navigate('/overview');
      } catch (err: any) {
        const msg = err.message || 'Authentication failed. Please check your credentials.';
        setErrorMessage(msg);
        toastError('Login Failed', msg);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Registration mode validation
      if (!displayName.trim()) {
        setErrorMessage('Please provide your full name.');
        return;
      }
      if (!email.trim()) {
        setErrorMessage('Please provide a corporate email address.');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setErrorMessage('Please provide a valid email format.');
        return;
      }
      if (!password || password.length < 8) {
        setErrorMessage('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }

      setIsLoading(true);
      try {
        if (register) {
          await register({
            displayName: displayName.trim(),
            email: email.trim().toLowerCase(),
            password,
            organizationName: organizationName.trim() || undefined
          });
        } else {
          await authApi.register({
            displayName: displayName.trim(),
            email: email.trim().toLowerCase(),
            password,
            organizationName: organizationName.trim() || undefined
          });
        }
        toastSuccess('Account created successfully', 'Welcome to AegisAI Governance Gateway');
        navigate('/overview');
      } catch (err: any) {
        const msg = err.message || 'Registration failed. Please verify your details.';
        setErrorMessage(msg);
        toastError('Registration Failed', msg);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setMode('login');
    setErrorMessage(null);
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <Card className="shadow-xl border-border bg-card">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-2 h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Shield className="h-6 w-6" />
        </div>
        <CardTitle className="text-xl font-bold tracking-tight">
          {mode === 'login' ? 'Enterprise Sign In' : 'Create Enterprise Account'}
        </CardTitle>
        <CardDescription className="text-xs">
          {mode === 'login'
            ? 'Authenticate with the AegisAI Identity Service to access governance dashboard'
            : 'Register a new account with the AegisAI Identity Service'}
        </CardDescription>

        {/* Mode Toggle Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-muted/60 rounded-lg border border-border mt-3 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
            }}
            className={`py-1.5 rounded-md transition-all ${
              mode === 'login'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMessage(null);
            }}
            className={`py-1.5 rounded-md transition-all ${
              mode === 'register'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Register
          </button>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-3">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {mode === 'register' && (
            <>
              <Input
                label="Full Name"
                type="text"
                placeholder="Jane Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isLoading}
                required
                autoComplete="name"
              />

              <Input
                label="Organization Workspace (Optional)"
                type="text"
                placeholder="Enterprise Alpha Corp"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                disabled={isLoading}
              />
            </>
          )}

          <Input
            label="Corporate Email"
            type="email"
            placeholder={mode === 'login' ? 'admin@enterprise.internal' : 'developer@company.com'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            required
            autoComplete="email"
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

          {mode === 'register' && (
            <Input
              label="Confirm Password"
              type="password"
              placeholder="••••••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              required
              autoComplete="new-password"
            />
          )}

          <Button type="submit" variant="primary" className="w-full mt-3" isLoading={isLoading}>
            {mode === 'login' ? (
              <>
                <KeyRound className="h-4 w-4 mr-2" />
                Authenticate
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Create Account
              </>
            )}
          </Button>

          {/* Quick Demo Credentials only in login mode */}
          {mode === 'login' && (
            <div className="pt-3 border-t border-border mt-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 text-center">
                Quick Fill Test Accounts
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs truncate"
                  onClick={() => handleQuickLogin('admin@enterprise.internal', 'AdminSecurePassword!2026')}
                >
                  Admin (Alpha)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs truncate"
                  onClick={() => handleQuickLogin('developer@enterprise.internal', 'DevSecurePassword!2026')}
                >
                  Developer (Alpha)
                </Button>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col text-center text-[11px] text-muted-foreground space-y-2 pt-0">
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setErrorMessage(null);
            }}
            className="text-xs text-primary hover:underline font-medium"
          >
            {mode === 'login'
              ? "Don't have an account? Create an enterprise account"
              : 'Already have an account? Sign In'}
          </button>
          <span>Protected by argon2id hashing and token rotation</span>
        </CardFooter>
      </form>
    </Card>
  );
}
