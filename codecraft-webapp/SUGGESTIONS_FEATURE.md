# 💡 Suggestions & Feedback System

A complete feedback and suggestions system for ComCraft bot users.

## 📋 Overview

This feature allows ComCraft users to submit suggestions, feature requests, and bug reports directly from their dashboard. Admins can then review, prioritize, and manage all suggestions from the admin panel.

## ✨ Features

### For Users:
- ✅ Submit suggestions with categories (Bug, Feature, Improvement, Other)
- ✅ Track status of their submissions
- ✅ View admin responses and notes
- ✅ See priority levels assigned by admins
- ✅ Clean, intuitive UI

### For Admins:
- ✅ View all suggestions from all users
- ✅ Filter by status, category, or search
- ✅ Update suggestion status (Pending → Under Review → Planned → In Progress → Completed/Rejected)
- ✅ Set priority levels (Low, Medium, High)
- ✅ Add internal notes and user-facing responses
- ✅ Delete suggestions if needed
- ✅ Statistics dashboard showing totals and breakdown

## 🗃️ Database Schema

```sql
CREATE TABLE suggestions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  discord_id TEXT NOT NULL,
  discord_tag TEXT NOT NULL,
  guild_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- 'bug' | 'feature' | 'improvement' | 'other'
  priority TEXT, -- 'low' | 'medium' | 'high'
  status TEXT DEFAULT 'pending', -- 'pending' | 'under_review' | 'planned' | 'in_progress' | 'completed' | 'rejected'
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🚀 Installation

### 1. Run Database Migration

Execute the SQL migration file in your Supabase SQL Editor:

```bash
# File: supabase-suggestions-migration.sql
```

Or run it via Supabase CLI:

```bash
supabase db push
```

### 2. Verify Installation

The following files have been added/modified:

**New Files:**
- `src/types/database.ts` - Added `Suggestion` type
- `src/app/api/suggestions/route.ts` - POST & GET endpoints
- `src/app/api/suggestions/[id]/route.ts` - PATCH & DELETE endpoints
- `src/app/(site)/comcraft/dashboard/[guildId]/suggestions/page.tsx` - User submission page
- `src/app/(site)/admin/suggestions/page.tsx` - Admin management page
- `supabase-suggestions-migration.sql` - Database migration

**Modified Files:**
- `src/app/(site)/comcraft/dashboard/[guildId]/page.tsx` - Added navigation link
- `src/app/(site)/admin/layout.tsx` - Added admin menu link

## 📍 Access URLs

### Users:
```
/comcraft/dashboard/[guildId]/suggestions
```
Accessible from the "Dashboard Links" section on the main ComCraft dashboard.

### Admins:
```
/admin/suggestions
```
Accessible from the admin sidebar navigation.

## 🔒 Security

### Row Level Security (RLS)
- Users can only view and create their own suggestions
- Admins can view, update, and delete all suggestions
- All operations are authenticated via NextAuth JWT

### API Protection
- All API routes require authentication
- Admin-only operations require `isAdmin` flag
- Input validation on all submissions

## 🎯 Usage

### User Workflow:
1. Navigate to ComCraft dashboard
2. Click "💡 Suggestions & Feedback"
3. Fill out the form with title, description, and category
4. Submit suggestion
5. Track status in "Your Suggestions" section

### Admin Workflow:
1. Navigate to Admin Dashboard → Suggestions
2. View all suggestions with statistics
3. Filter by status, category, or search
4. Click eye icon to open suggestion details
5. Update status, set priority, add admin notes
6. User will see admin response in their dashboard

## 📊 Status Flow

```
Pending → Under Review → Planned → In Progress → Completed
                                                 ↓
                                              Rejected
```

## 🎨 Categories

- **🐛 Bug Report** - Issues and bugs in the bot
- **💡 Feature Request** - New features users want
- **✨ Improvement** - Enhancements to existing features
- **💬 Other** - General feedback

## 🔔 Future Enhancements

Potential improvements you could add:

- [ ] Email notifications when status changes
- [ ] Discord webhook notifications to a staff channel
- [ ] Voting system (upvotes/downvotes)
- [ ] Comment threads on suggestions
- [ ] Attachments/screenshots support
- [ ] Auto-labeling using AI
- [ ] Public roadmap page showing planned features

## 🛠️ API Reference

### POST /api/suggestions
Submit a new suggestion
```json
{
  "title": "Add dark mode",
  "description": "It would be great to have a dark mode option",
  "category": "feature",
  "guild_id": "123456789"
}
```

### GET /api/suggestions
Get suggestions (all for admin, own for users)
```
Query params:
- status: filter by status
- category: filter by category
```

### PATCH /api/suggestions/[id]
Update suggestion (admin only)
```json
{
  "status": "in_progress",
  "priority": "high",
  "admin_notes": "We're working on this!"
}
```

### DELETE /api/suggestions/[id]
Delete suggestion (admin only)

## 📝 Notes

- All text is in English as requested
- Fully integrated with existing Supabase authentication
- Mobile responsive design
- Real-time updates (no page refresh needed)
- Clean and modern UI using shadcn/ui components

## 🤝 Support

If you encounter any issues:
1. Check Supabase logs
2. Verify authentication is working
3. Ensure RLS policies are enabled
4. Check browser console for errors

---

**Built with ❤️ for CodeCraft Solutions**

