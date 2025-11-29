-- Advanced Polls & Voting System Update V2.2.5
-- Release Date: 2025-01-XX

-- Main update entry
INSERT INTO updates (
    version,
    title,
    description,
    release_date,
    is_featured,
    image_url,
    created_at
) VALUES (
    '2.2.5',
    'Advanced Polls & Voting System',
    'Introducing a comprehensive polls and voting system with real-time results, anonymous voting, scheduled reminders, and automated posting. Perfect for community decisions and engagement.',
    NOW(),
    true,
    NULL,
    NOW()
) ON CONFLICT (version) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    release_date = EXCLUDED.release_date,
    is_featured = EXCLUDED.is_featured,
    updated_at = NOW()
RETURNING id;

-- Get the update ID for the update items
DO $$
DECLARE
    update_id_val UUID;
BEGIN
    SELECT id INTO update_id_val FROM updates WHERE version = '2.2.5';

    -- Update items for the polls system
    INSERT INTO update_items (update_id, title, description, category, order_index, created_at)
    VALUES
        (update_id_val, '📊 Poll Creation', 'Create polls with multiple options, custom descriptions, and flexible voting types (single or multiple choice). Support for up to 25 options per poll.', 'polls', 1, NOW()),
        
        (update_id_val, '🎯 Voting Types', 'Choose between public and anonymous voting. Public polls show who voted for what, while anonymous polls keep votes private while still showing results.', 'polls', 2, NOW()),
        
        (update_id_val, '⏰ Expiry & Scheduling', 'Set custom expiry times for polls (in hours) or leave them open indefinitely. Automatically closes polls when expiry time is reached.', 'polls', 3, NOW()),
        
        (update_id_val, '🔔 Smart Reminders', 'Enable automatic reminders that notify users 1 hour before a poll expires. Helps increase participation and engagement.', 'polls', 4, NOW()),
        
        (update_id_val, '📈 Real-Time Results', 'View live poll results with visual progress bars, vote counts, and percentages. Results update automatically as votes are cast.', 'polls', 5, NOW()),
        
        (update_id_val, '🔄 Vote Changes', 'Allow or disallow users to change their votes after submission. Configurable per poll for maximum flexibility.', 'polls', 6, NOW()),
        
        (update_id_val, '👥 Role Requirements', 'Restrict voting to specific roles. Perfect for staff-only polls or member-exclusive decisions.', 'polls', 7, NOW()),
        
        (update_id_val, '⚖️ Weighted Voting', 'Set custom vote weights for different roles. Some roles can have more influence on poll outcomes (e.g., admins count as 2 votes).', 'polls', 8, NOW()),
        
        (update_id_val, '🎨 Discord Integration', 'Polls are automatically posted to Discord channels with beautiful embeds, interactive buttons, and reaction-based voting support.', 'polls', 9, NOW()),
        
        (update_id_val, '💬 Multiple Choice Support', 'Create polls where users can vote for multiple options. Perfect for "select all that apply" scenarios with configurable max votes.', 'polls', 10, NOW()),
        
        (update_id_val, '📱 Dashboard Management', 'Full poll management interface in the dashboard. Create, edit, delete, and close polls with ease. View all polls in organized tabs (Active, Closed, All).', 'polls', 11, NOW()),
        
        (update_id_val, '🤖 Discord Commands', 'New slash commands: /poll create, /poll vote, /poll results, /poll end, /poll info, /poll list. Full control over polls from Discord.', 'polls', 12, NOW()),
        
        (update_id_val, '📊 Results Visualization', 'Beautiful result displays with progress bars, vote percentages, and clear formatting. Results can be viewed via buttons or commands.', 'polls', 13, NOW()),
        
        (update_id_val, '🔄 Auto-Posting', 'Polls created via the dashboard are automatically posted to Discord within 30 seconds. No manual steps required!', 'polls', 14, NOW()),
        
        (update_id_val, '🎯 Button-Based Voting', 'Users can vote directly via interactive buttons on the poll message. No need to remember poll IDs or use commands for simple voting.', 'polls', 15, NOW()),
        
        (update_id_val, '📋 Poll Information', 'Get detailed information about any poll including status, expiry time, vote counts, and direct links to the poll message.', 'polls', 16, NOW()),
        
        (update_id_val, '🗑️ Poll Management', 'Close polls early, delete polls, and view complete poll history. Full administrative control over all polls in your server.', 'polls', 17, NOW()),
        
        (update_id_val, '📈 Analytics Ready', 'Poll data is stored with timestamps, vote counts, and user information (for public polls). Ready for future analytics features.', 'polls', 18, NOW()),
        
        (update_id_val, '✨ Premium Feature', 'Polls & Voting is available to Premium and Enterprise tier subscribers. Part of the comprehensive engagement toolkit.', 'polls', 19, NOW()),
        
        (update_id_val, '🎁 Export Ready', 'Poll results can be easily exported for analysis. All data is structured and ready for CSV/JSON export in future updates.', 'polls', 20, NOW()),
        
        (update_id_val, '🔗 Integration Ready', 'Polls integrate seamlessly with other ComCraft features. Can be linked to quests, economy rewards, and more in future updates.', 'polls', 21, NOW());

    -- Add a general improvements item
    INSERT INTO update_items (update_id, title, description, category, order_index, created_at)
    VALUES
        (update_id_val, '🚀 Performance Improvements', 'Optimized database queries and improved caching for better performance on large servers. Faster poll loading and vote processing.', 'general', 22, NOW());
END $$;

