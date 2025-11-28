import { NextRequest, NextResponse } from 'next/server'

// Logout endpoint - redirects to NextAuth signout
export async function GET(request: NextRequest) {
  // Redirect to NextAuth signout which handles cookie clearing
  return NextResponse.redirect(new URL('/api/auth/signout', request.url))
}

export async function POST(request: NextRequest) {
  // Same logic for POST requests
  return NextResponse.redirect(new URL('/api/auth/signout', request.url))
}
