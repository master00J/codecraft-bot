"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MessageCircle, AlertCircle } from "lucide-react"
import { Link } from '@/navigation'
import { useSearchParams, useRouter } from "next/navigation"
import { signIn, useSession } from "next-auth/react"
import { useEffect } from "react"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"

export default function LoginPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const error = searchParams.get('error')
  
  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (status === 'authenticated' && session) {
      const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
      router.push(callbackUrl)
    }
  }, [status, session, router, searchParams])

  const errorMessages: Record<string, string> = {
    'OAuthAccountNotLinked': 'This account is already linked to another provider',
    'OAuthSignin': 'Error signing in with Discord. Please try again.',
    'OAuthCallback': 'Error during OAuth callback. Please try again.',
    'Callback': 'Error in callback. Please try again.',
    'Default': 'An error occurred. Please try again.',
    'unauthorized': 'You need to login to access this page',
  }
  
  const handleDiscordLogin = () => {
    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
    signIn('discord', { callbackUrl })
  }
  
  // Show loading while checking session
  if (status === 'loading') {
    return (
      <div>
        <Navbar />
        <main className="min-h-screen flex items-center justify-center px-6 py-24">
          <Card className="max-w-md w-full">
            <CardContent className="py-10 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Checking authentication...</p>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div>
      <Navbar />
      <main className="min-h-screen flex items-center justify-center px-6 py-24">
        <div className="mx-auto max-w-md w-full">
          <div className="text-center mb-8">
            <Badge className="mb-4">🔐 Secure Login</Badge>
            <h1 className="text-3xl font-bold mb-2">
              Welcome to CodeCraft
            </h1>
            <p className="text-muted-foreground">
              Login with Discord to access your dashboard
            </p>
          </div>

          {error && (
            <Card className="mb-6 border-destructive">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-destructive">Login Failed</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {errorMessages[error] || error}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Check Vercel Logs for details or contact support
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="text-center">
              <MessageCircle className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle>Discord Login</CardTitle>
              <CardDescription>
                Sign in with your Discord account to continue
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                className="w-full" 
                size="lg"
                onClick={handleDiscordLogin}
              >
                Login with Discord
              </Button>

              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  By logging in, you agree to our{' '}
                  <Link href="/terms" className="underline hover:text-primary">
                    Terms of Service
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="mt-8 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have a Discord account?
            </p>
            <Link href="https://discord.com/register" target="_blank">
              <Button variant="outline" size="sm">
                Create Discord Account
              </Button>
            </Link>
          </div>

          <div className="mt-8 text-center">
            <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
              ← Back to Home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

