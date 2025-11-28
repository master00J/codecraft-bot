"use client"

import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Link } from '@/navigation'
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function DebugPage() {
  const { data: session, status } = useSession()

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <Link href="/">
          <Button variant="ghost" className="gap-2 mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        <h1 className="text-3xl font-bold mb-6">Auth Debug Info</h1>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Session Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 font-mono text-sm">
                <p><strong>Status:</strong> {status}</p>
                <p><strong>Has Session:</strong> {session ? 'Yes ✅' : 'No ❌'}</p>
              </div>
            </CardContent>
          </Card>

          {session && (
            <Card>
              <CardHeader>
                <CardTitle>Session Data</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded overflow-auto text-xs">
                  {JSON.stringify(session, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {status === 'unauthenticated' && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle>Not Authenticated</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">You are not logged in.</p>
                <Link href="/login">
                  <Button>Go to Login</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Environment Check (Client)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 font-mono text-sm">
                <p><strong>NEXT_PUBLIC_SUPABASE_URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set ✅' : 'Missing ❌'}</p>
                <p><strong>URL:</strong> {typeof window !== 'undefined' ? window.location.href : 'SSR'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Instructions</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert">
              <h3>If session status is "unauthenticated":</h3>
              <ol>
                <li>Check Vercel Environment Variables:
                  <ul>
                    <li><code>NEXTAUTH_SECRET</code> - Must be set!</li>
                    <li><code>NEXTAUTH_URL</code> - Should be your domain</li>
                    <li><code>DISCORD_CLIENT_ID</code></li>
                    <li><code>DISCORD_CLIENT_SECRET</code></li>
                  </ul>
                </li>
                <li>Check Discord Developer Portal redirect URI</li>
                <li>Check Vercel Runtime Logs for errors</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

