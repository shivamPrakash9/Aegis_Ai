import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <Card className="max-w-md w-full text-center p-8 border-border">
        <CardContent className="space-y-4 p-0">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <ShieldAlert className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Page Not Found</h1>
            <p className="text-xs text-muted-foreground mt-2">
              The endpoint or navigation route you requested is unavailable or outside your current tenant permissions.
            </p>
          </div>

          <div className="pt-4 flex items-center justify-center gap-3">
            <Link to="/overview">
              <Button size="sm" className="gap-2 text-xs">
                <Home className="h-4 w-4" />
                <span>Return to Overview</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
