# 🎯 Quests & Missions System - Technisch Ontwerp

## 📋 Overzicht

Het Quests & Missions System laat server owners custom quests/missions maken die automatisch worden bijgehouden. Gebruikers kunnen quests voltooien door specifieke acties uit te voeren (berichten sturen, voice activiteit, economy transacties, etc.) en krijgen beloningen (coins, XP, roles, items).

---

## 🗄️ Database Schema

### 1. `quests` Table
Bevat alle quest definities per guild.

```sql
CREATE TABLE IF NOT EXISTS quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  
  -- Quest Basic Info
  name TEXT NOT NULL,
  description TEXT,
  emoji TEXT DEFAULT '📋',
  category TEXT DEFAULT 'general', -- daily, weekly, special, event, general
  
  -- Quest Type & Requirements
  quest_type TEXT NOT NULL, -- message_count, voice_minutes, coin_spend, coin_earn, xp_gain, 
                            -- level_reach, command_use, invite_count, reaction_count,
                            -- channel_visit, role_obtain, duel_win, stock_profit, custom
  
  -- Quest Requirements (JSONB for flexibility)
  requirements JSONB NOT NULL DEFAULT '{}',
  -- Example: { "target": 10, "channel_ids": ["123"], "role_ids": ["456"] }
  
  -- Quest Rewards (JSONB - can give multiple rewards)
  rewards JSONB NOT NULL DEFAULT '{}',
  -- Example: { "coins": 100, "xp": 50, "role_id": "789", "item_id": "abc" }
  
  -- Quest Settings
  reset_type TEXT DEFAULT 'never', -- never, daily, weekly, monthly
  reset_time TIME, -- Time of day to reset (for daily/weekly)
  reset_day_of_week INTEGER, -- 0-6 (0 = Sunday) for weekly reset
  
  -- Quest Availability
  enabled BOOLEAN DEFAULT true,
  visible BOOLEAN DEFAULT true, -- Hide from users but still track
  
  -- Quest Prerequisites
  prerequisite_quest_ids UUID[] DEFAULT '{}', -- Must complete these first
  required_level INTEGER, -- Minimum level to see/accept quest
  required_roles TEXT[] DEFAULT '{}', -- Roles required to see/accept
  
  -- Quest Limits
  max_completions INTEGER, -- null = unlimited
  completion_cooldown_hours INTEGER, -- Cooldown between completions
  
  -- Quest Chain
  chain_id UUID, -- For quest chains
  chain_position INTEGER, -- Position in chain (1, 2, 3...)
  
  -- Metadata
  created_by TEXT, -- User ID who created
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT quests_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_quests_guild ON quests(guild_id);
CREATE INDEX IF NOT EXISTS idx_quests_type ON quests(guild_id, quest_type);
CREATE INDEX IF NOT EXISTS idx_quests_category ON quests(guild_id, category);
CREATE INDEX IF NOT EXISTS idx_quests_chain ON quests(chain_id);
CREATE INDEX IF NOT EXISTS idx_quests_reset ON quests(guild_id, reset_type, enabled);
```

### 2. `quest_progress` Table
Bijhoudt de voortgang van elke gebruiker per quest.

```sql
CREATE TABLE IF NOT EXISTS quest_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  
  -- Progress Tracking
  current_progress INTEGER DEFAULT 0, -- Current progress toward target
  target_progress INTEGER NOT NULL, -- Target to complete (copied from quest)
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  
  -- Completion Tracking
  completion_count INTEGER DEFAULT 0, -- How many times completed (for repeatable)
  last_completed_at TIMESTAMPTZ, -- Last completion time (for cooldowns)
  
  -- Reset Tracking
  reset_at TIMESTAMPTZ, -- When this quest will reset (for daily/weekly)
  
  -- Metadata
  started_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(quest_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_quest_progress_quest ON quest_progress(quest_id);
CREATE INDEX IF NOT EXISTS idx_quest_progress_user ON quest_progress(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_quest_progress_completed ON quest_progress(guild_id, user_id, completed);
CREATE INDEX IF NOT EXISTS idx_quest_progress_reset ON quest_progress(reset_at) WHERE reset_at IS NOT NULL;
```

### 3. `quest_completions` Table
Log alle quest completions voor statistieken.

```sql
CREATE TABLE IF NOT EXISTS quest_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  
  -- Completion Info
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  progress_achieved INTEGER, -- Final progress value
  rewards_given JSONB, -- What rewards were given
  
  -- Metadata
  completion_number INTEGER, -- Which completion (1st, 2nd, 3rd...)
  
  INDEX idx_quest_completions_quest ON quest_completions(quest_id, completed_at);
  INDEX idx_quest_completions_user ON quest_completions(guild_id, user_id, completed_at);
  INDEX idx_quest_completions_date ON quest_completions(completed_at);
);
```

### 4. `quest_chains` Table
Voor quest series/chains.

```sql
CREATE TABLE IF NOT EXISTS quest_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  
  name TEXT NOT NULL,
  description TEXT,
  emoji TEXT DEFAULT '🔗',
  
  -- Chain Settings
  reward_bonus DECIMAL(5,2) DEFAULT 1.0, -- Bonus multiplier for completing entire chain
  
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_quest_chains_guild ON quest_chains(guild_id);
);
```

---

## 🎮 Quest Types & Hoe Ze Werken

### 1. **Message Count** (`message_count`)
**Doel:** Stuur X berichten  
**Tracking:** Automatisch via `messageCreate` event  
**Requirements:** `{ "target": 50, "channel_ids": ["123", "456"] }`

```javascript
// In message-create.js
if (questManager.isTracking(guildId, 'message_count')) {
  await questManager.updateProgress(guildId, userId, 'message_count', {
    channelId: message.channel.id,
    increment: 1
  });
}
```

---

### 2. **Voice Minutes** (`voice_minutes`)
**Doel:** Ben X minuten actief in voice  
**Tracking:** Automatisch via voice state tracking  
**Requirements:** `{ "target": 60, "channel_ids": ["789"] }` (minuten)

```javascript
// In voice state update handler
if (questManager.isTracking(guildId, 'voice_minutes')) {
  // Track time in voice channel
  await questManager.trackVoiceTime(guildId, userId, {
    channelId: voiceChannel.id,
    minutes: timeSpent
  });
}
```

---

### 3. **Coin Spend** (`coin_spend`)
**Doel:** Geef X coins uit  
**Tracking:** Via economy transactions  
**Requirements:** `{ "target": 500 }`

```javascript
// In economy manager when coins are spent
if (questManager.isTracking(guildId, 'coin_spend')) {
  await questManager.updateProgress(guildId, userId, 'coin_spend', {
    amount: transactionAmount
  });
}
```

---

### 4. **Coin Earn** (`coin_earn`)
**Doel:** Verdien X coins  
**Tracking:** Via economy transactions  
**Requirements:** `{ "target": 1000 }`

---

### 5. **XP Gain** (`xp_gain`)
**Doel:** Verdien X XP  
**Tracking:** Via XP manager  
**Requirements:** `{ "target": 500 }`

---

### 6. **Level Reach** (`level_reach`)
**Doel:** Bereik level X  
**Tracking:** Via XP manager (level up event)  
**Requirements:** `{ "target": 10 }`

---

### 7. **Command Use** (`command_use`)
**Doel:** Gebruik X keer een command  
**Tracking:** Via interaction handler  
**Requirements:** `{ "target": 20, "command_names": ["/daily", "/shop"] }`

---

### 8. **Invite Count** (`invite_count`)
**Doel:** Nodig X mensen uit  
**Tracking:** Via invite tracking (nieuw systeem)  
**Requirements:** `{ "target": 5 }`

---

### 9. **Reaction Count** (`reaction_count`)
**Doel:** Reageer X keer  
**Tracking:** Via message reaction events  
**Requirements:** `{ "target": 30 }`

---

### 10. **Channel Visit** (`channel_visit`)
**Doel:** Bezoek X verschillende channels  
**Tracking:** Via message events (unique channels)  
**Requirements:** `{ "target": 5 }`

---

### 11. **Role Obtain** (`role_obtain`)
**Doel:** Krijg een specifieke role  
**Tracking:** Via role update events  
**Requirements:** `{ "role_id": "123" }`

---

### 12. **Duel Win** (`duel_win`)
**Doel:** Win X duels  
**Tracking:** Via duel manager  
**Requirements:** `{ "target": 5 }`

---

### 13. **Stock Profit** (`stock_profit`)
**Doel:** Maak X profit in stock market  
**Tracking:** Via stock market manager  
**Requirements:** `{ "target": 500 }`

---

### 14. **Custom** (`custom`)
**Doel:** Handmatig completeren (admin)  
**Tracking:** Via command  
**Requirements:** `{}`

---

## 📊 Progress Tracking Systeem

### QuestManager Class

```javascript
class QuestManager {
  constructor() {
    this.supabase = createClient(...);
    this.activeTrackers = new Map(); // Cache: guildId -> Set of quest_types
  }

  /**
   * Check if we should track a specific quest type for a guild
   */
  async isTracking(guildId, questType) {
    const cacheKey = `${guildId}:${questType}`;
    
    if (!this.activeTrackers.has(cacheKey)) {
      // Check database for active quests of this type
      const { data } = await this.supabase
        .from('quests')
        .select('id')
        .eq('guild_id', guildId)
        .eq('quest_type', questType)
        .eq('enabled', true);
      
      this.activeTrackers.set(cacheKey, data && data.length > 0);
    }
    
    return this.activeTrackers.get(cacheKey);
  }

  /**
   * Update progress for a quest
   */
  async updateProgress(guildId, userId, questType, data) {
    // Get all active quests of this type for this user
    const { data: quests } = await this.supabase
      .from('quests')
      .select('*, quest_progress!left(*)')
      .eq('guild_id', guildId)
      .eq('quest_type', questType)
      .eq('enabled', true)
      .is('quest_progress.completed', false);
    
    for (const quest of quests) {
      // Check prerequisites
      if (!await this.checkPrerequisites(guildId, userId, quest)) {
        continue;
      }
      
      // Check cooldown
      if (!await this.checkCooldown(quest, userId)) {
        continue;
      }
      
      // Validate requirements (channel, role, etc.)
      if (!this.validateRequirements(quest.requirements, data)) {
        continue;
      }
      
      // Get or create progress
      let progress = quest.quest_progress?.[0];
      if (!progress) {
        progress = await this.createProgress(quest.id, guildId, userId);
      }
      
      // Update progress
      const newProgress = this.calculateProgress(quest, progress, data);
      
      await this.supabase
        .from('quest_progress')
        .update({
          current_progress: newProgress,
          updated_at: new Date().toISOString()
        })
        .eq('id', progress.id);
      
      // Check if completed
      if (newProgress >= quest.requirements.target) {
        await this.completeQuest(quest, userId, newProgress);
      }
    }
  }

  /**
   * Complete a quest and give rewards
   */
  async completeQuest(quest, userId, finalProgress) {
    // Mark as completed
    await this.supabase
      .from('quest_progress')
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
        current_progress: finalProgress,
        completion_count: progress.completion_count + 1,
        last_completed_at: new Date().toISOString()
      })
      .eq('quest_id', quest.id)
      .eq('user_id', userId);
    
    // Give rewards
    await this.giveRewards(quest.guild_id, userId, quest.rewards);
    
    // Log completion
    await this.supabase
      .from('quest_completions')
      .insert({
        quest_id: quest.id,
        guild_id: quest.guild_id,
        user_id: userId,
        progress_achieved: finalProgress,
        rewards_given: quest.rewards,
        completion_number: progress.completion_count + 1
      });
    
    // Check if quest is repeatable
    if (quest.reset_type !== 'never' && 
        (!quest.max_completions || progress.completion_count + 1 < quest.max_completions)) {
      // Reset quest for next cycle
      await this.resetQuest(quest.id, userId);
    }
    
    // Check for quest chain
    if (quest.chain_id) {
      await this.checkQuestChain(quest.chain_id, quest.guild_id, userId);
    }
  }

  /**
   * Give quest rewards
   */
  async giveRewards(guildId, userId, rewards) {
    if (rewards.coins) {
      await economyManager.addCoins(guildId, userId, rewards.coins, 'quest', 'Quest reward');
    }
    
    if (rewards.xp) {
      await xpManager.addXP(guildId, userId, rewards.xp, 'Quest reward');
    }
    
    if (rewards.role_id) {
      // Give role
      const member = await guild.members.fetch(userId);
      await member.roles.add(rewards.role_id);
    }
    
    if (rewards.item_id) {
      // Give combat item
      await inventoryManager.addItem(guildId, userId, rewards.item_id, 1);
    }
  }

  /**
   * Reset quest for daily/weekly cycles
   */
  async resetQuest(questId, userId) {
    const quest = await this.getQuest(questId);
    const resetAt = this.calculateResetTime(quest);
    
    await this.supabase
      .from('quest_progress')
      .update({
        completed: false,
        current_progress: 0,
        completed_at: null,
        reset_at: resetAt.toISOString()
      })
      .eq('quest_id', questId)
      .eq('user_id', userId);
  }

  /**
   * Scheduled job to reset daily/weekly quests
   */
  async resetDailyQuests() {
    // Run every hour, check for quests that need resetting
    const now = new Date();
    
    const { data: quests } = await this.supabase
      .from('quests')
      .select('*')
      .in('reset_type', ['daily', 'weekly'])
      .eq('enabled', true);
    
    for (const quest of quests) {
      if (this.shouldReset(quest, now)) {
        // Reset all user progress for this quest
        await this.resetQuestForAllUsers(quest);
      }
    }
  }
}
```

---

## 🎯 Integratie Punt 1: Message Events

```javascript
// In modules/comcraft/bot/events/message-create.js
if (global.questManager && global.questManager.isTracking(guildId, 'message_count')) {
  await global.questManager.updateProgress(guildId, userId, 'message_count', {
    channelId: message.channel.id,
    increment: 1
  });
}
```

---

## 🎯 Integratie Punt 2: Economy Transactions

```javascript
// In modules/comcraft/economy/manager.js
// When coins are spent
if (global.questManager) {
  await global.questManager.updateProgress(guildId, userId, 'coin_spend', {
    amount: amount
  });
}

// When coins are earned
if (global.questManager) {
  await global.questManager.updateProgress(guildId, userId, 'coin_earn', {
    amount: amount
  });
}
```

---

## 🎯 Integratie Punt 3: XP Gain

```javascript
// In modules/comcraft/leveling/xp-manager.js
// After XP is added
if (global.questManager) {
  await global.questManager.updateProgress(guildId, userId, 'xp_gain', {
    amount: xpGain
  });
  
  // Check for level_reach quests
  const newLevel = this.calculateLevel(newXP);
  const oldLevel = this.calculateLevel(oldXP);
  
  if (newLevel > oldLevel) {
    await global.questManager.updateProgress(guildId, userId, 'level_reach', {
      level: newLevel
    });
  }
}
```

---

## 🎯 Integratie Punt 4: Voice Activity

```javascript
// In voice state update handler
if (global.questManager && global.questManager.isTracking(guildId, 'voice_minutes')) {
  // Track time in voice
  await global.questManager.trackVoiceTime(guildId, userId, {
    channelId: voiceChannel.id,
    minutes: calculateMinutesInVoice()
  });
}
```

---

## 📱 Discord Commands

### 1. `/quests` - View Available Quests
```
/quests [category] [user]
```
Shows all available quests with progress bars.

---

### 2. `/quest progress` - View Specific Quest
```
/quest progress <quest_name>
```
Shows detailed progress for a specific quest.

---

### 3. `/quest complete` - Manually Complete (Admin)
```
/quest complete <quest_name> <user>
```
Admin command to manually complete a quest for a user.

---

### 4. `/questchain` - View Quest Chain Progress
```
/questchain [chain_name]
```
Shows progress through a quest chain.

---

## 🖥️ Dashboard UI Concept

### Quest Management Page: `/dashboard/[guildId]/quests`

**Tabs:**
1. **Active Quests** - List of all active quests with stats
2. **Create Quest** - Form to create new quest
3. **Quest Chains** - Manage quest chains
4. **Quest Analytics** - Completion rates, popular quests, etc.

**Quest Creation Form:**
- Name, Description, Emoji
- Category (Daily, Weekly, Special, Event)
- Quest Type (dropdown)
- Requirements (dynamic based on type)
- Rewards (coins, XP, role, item)
- Reset Type
- Prerequisites
- Limits & Cooldowns

**Quest Preview:**
- Real-time preview of how quest will look to users
- Progress bar example
- Reward display

---

## 🔄 Automatische Reset Logica

### Daily Reset
- Reset tijd instelbaar (bijv. 00:00 server timezone)
- Elke dag op die tijd worden alle daily quests gereset
- Gebruiker progress wordt op 0 gezet
- Completion count blijft behouden

### Weekly Reset
- Reset dag + tijd instelbaar (bijv. Maandag 00:00)
- Elke week op die tijd worden alle weekly quests gereset

### Monthly Reset
- Eerste dag van de maand
- Alle monthly quests worden gereset

**Implementation:**
```javascript
// Scheduled job (runs every hour)
setInterval(async () => {
  await questManager.resetDailyQuests();
  await questManager.resetWeeklyQuests();
  await questManager.resetMonthlyQuests();
}, 3600000); // Every hour
```

---

## 🎁 Reward System

### Multiple Rewards per Quest
Een quest kan meerdere beloningen geven:
```json
{
  "coins": 100,
  "xp": 50,
  "role_id": "123456789",
  "item_id": "sword_001"
}
```

### Reward Notifications
Wanneer een quest wordt voltooid:
- Embed in quest channel (optioneel)
- DM naar gebruiker (optioneel)
- Notification in `/quests` command

---

## 📊 Quest Analytics

### Metrics te Tracken:
- Completion rate per quest
- Average completion time
- Most popular quests
- Reward distribution
- User engagement

### Dashboard Analytics Tab:
- Charts en graphs
- Export naar CSV
- Filter op periode

---

## 🚀 Implementation Stappen

1. **Database Schema** - Create alle tables
2. **QuestManager Class** - Core logic
3. **Integration Points** - Hook into existing systems
4. **Commands** - Discord slash commands
5. **Dashboard UI** - Quest management interface
6. **Reset Scheduler** - Automatic quest resets
7. **Testing** - Uitgebreide testing

---

## 💡 Advanced Features (Future)

1. **Quest Templates** - Pre-made quest templates
2. **Quest Marketplace** - Share quests tussen servers
3. **Quest Rarity** - Common, Rare, Epic, Legendary
4. **Quest Seasonal Events** - Limited-time quests
5. **Quest Achievements** - Badges voor completing many quests
6. **Quest Leaderboards** - Top quest completers
7. **Quest Notifications** - Auto-DM bij nieuwe quests
8. **Quest Suggestions** - AI-generated quest suggestions

