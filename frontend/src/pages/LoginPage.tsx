import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { Shield, KeyRound, AlertCircle } from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please provide both email and password.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      await login({ email, password });
      toastSuccess('Authenticated successfully', 'Welcome to AegisAI Governance Gateway');
    } catch (err: any) {
      const msg = err.message || 'Authentication failed. Please check your credentials.';
      setErrorMessage(msg);
      toastError('Login Failed', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <Card className="shadow-xl border-border bg-card">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-2 h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Shield className="h-6 w-6" />
        </div>
        <CardTitle className="text-xl font-bold tracking-tight">Enterprise Sign In</CardTitle>
        <CardDescription className="text-xs">
          Authenticate with the AegisAI Identity Service to access governance dashboard
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <Input
            label="Corporate Email"
            type="email"
            placeholder="admin@enterprise.internal"
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
            autoComplete="current-password"
          />

          <Button type="submit" variant="primary" className="w-full mt-2" isLoading={isLoading}>
            <KeyRound className="h-4 w-4 mr-2" />
            Authenticate
          </Button>

          {/* Quick Demo Credentials */}
          <div className="pt-4 border-t border-border mt-4">
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
        </CardContent>

        <CardFooter className="flex flex-col text-center text-[11px] text-muted-foreground space-y-1">
          <span>Protected by argon2id hashing and token rotation</span>
          <span>Zero passwords or secrets logged in browser memory</span>
        </CardFooter>
      </form>
    </Card>
  );
}
