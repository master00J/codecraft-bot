import 'next-auth'

declare module 'next-auth' {
  interface User {
    id?: string
    discordId?: string
    discordTag?: string
    isAdmin?: boolean
    sub?: string
  }

  interface Session {
    user: {
      id?: string
      discordId?: string
      discordTag?: string
      isAdmin?: boolean
      sub?: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    discordId?: string
    discordTag?: string
    isAdmin?: boolean
  }
}

