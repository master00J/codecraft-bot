# Discord Invite Link Setup

## Contact Page Discord Link

De contact pagina toont een "Join Discord Server" button voor ingelogde users.

### Configuratie in Vercel:

Voeg deze environment variable toe in Vercel:

**Variable Name:** `NEXT_PUBLIC_DISCORD_INVITE_URL`  
**Value:** Je Discord server invite link (bijv. `https://discord.gg/jouw-invite-code`)

### Hoe te verkrijgen:

1. Ga naar je Discord server
2. Klik op server naam → "Invite People"
3. Klik "Edit invite link"
4. Stel in:
   - Expire after: Never
   - Max number of uses: No limit
5. Kopieer de link (bijv. `https://discord.gg/abc123`)
6. Plak in Vercel environment variables

### Zonder configuratie:

Als de env var niet is ingesteld, gebruikt de pagina een fallback:
`https://discord.gg/your-server`

### Na instellen:

1. Sla de env variable op in Vercel
2. Redeploy de applicatie
3. Test de contact pagina als ingelogde user
4. De "Join Discord Server" button zou nu naar jouw server moeten linken

