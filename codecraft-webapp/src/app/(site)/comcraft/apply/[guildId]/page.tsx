'use client';

/**
 * Public apply form: applicants fill in questions here instead of Discord modal.
 * Supports long questions and long answers without token limits.
 */
import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, FileText, LogIn } from 'lucide-react';

interface ApplyConfig {
  name: string;
  questions: string[];
  cooldown_days: number;
  require_account_age_days: number;
}

export default function ApplyPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const guildId = params.guildId as string;
  const configId = searchParams.get('config');
  const { data: session, status } = useSession();
  const { toast } = useToast();

  const [config, setConfig] = useState<ApplyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [responses, setResponses] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!guildId || !configId) {
      setLoading(false);
      return;
    }
    fetch(`/api/comcraft/public/apply-config?guildId=${encodeURIComponent(guildId)}&configId=${encodeURIComponent(configId)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Config not found');
        return res.json();
      })
      .then((data) => {
        setConfig(data);
        setResponses((data.questions || []).map(() => ''));
      })
      .catch(() => setConfig(null))
      .finally(() => setLoading(false));
  }, [guildId, configId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config || !session?.user || !guildId || !configId) return;
    const filled = responses.every((r) => r.trim().length > 0);
    if (!filled) {
      toast({ title: 'Please answer all questions', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/applications/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configId,
          answers: { responses },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      setSuccess(true);
    } catch (err: any) {
      toast({ title: err.message || 'Failed to submit', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !guildId || !configId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading application form…</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="p-8 max-w-md w-full text-center">
          <p className="text-muted-foreground">This application type was not found or is no longer available.</p>
        </Card>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="p-8 max-w-md w-full text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h1 className="text-xl font-bold mb-2">Apply for: {config.name}</h1>
          <p className="text-muted-foreground mb-6">Sign in with Discord to submit your application.</p>
          <Button onClick={() => signIn('discord', { callbackUrl: `${window.location.pathname}?${searchParams.toString()}` })}>
            <LogIn className="h-4 w-4 mr-2" />
            Sign in with Discord
          </Button>
        </Card>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold mb-2 text-green-600">Application submitted</h1>
          <p className="text-muted-foreground">Your application for {config.name} has been sent. The staff team will review it and get back to you.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-muted/30">
      <div className="container max-w-2xl mx-auto">
        <Card className="p-6 md:p-8">
          <h1 className="text-2xl font-bold mb-1">Apply for: {config.name}</h1>
          <p className="text-sm text-muted-foreground mb-6">Answer all questions. You can use as much space as you need.</p>
          <form onSubmit={handleSubmit} className="space-y-6">
            {(config.questions || []).map((question, index) => (
              <div key={index} className="space-y-2">
                <Label htmlFor={`q-${index}`} className="text-base">
                  {question}
                </Label>
                <Textarea
                  id={`q-${index}`}
                  value={responses[index] ?? ''}
                  onChange={(e) => {
                    const next = [...responses];
                    next[index] = e.target.value;
                    setResponses(next);
                  }}
                  placeholder="Your answer"
                  className="min-h-[100px] resize-y"
                  maxLength={4000}
                  required
                />
              </div>
            ))}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting…
                </>
              ) : (
                'Submit application'
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
