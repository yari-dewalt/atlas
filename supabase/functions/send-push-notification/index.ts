import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const {
      type,
      recipientId,
      actorId,
      actorUsername,
      actorAvatarUrl,
      postId,
      routineId,
      commentId,
      conversationId,
      isTestToSelf = false,
    } = payload;

    // Skip self-notifications unless it's a dev test
    if (recipientId === actorId && !isTestToSelf) {
      return new Response(JSON.stringify({ skipped: 'self-notification' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch recipient's push token
    const { data: profile } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', recipientId)
      .single();

    const pushToken = profile?.push_token;
    if (!pushToken) {
      return new Response(JSON.stringify({ skipped: 'no-token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check notification settings (direct_message always sends)
    if (type !== 'direct_message') {
      const { data: settings } = await supabase
        .from('notification_settings')
        .select('follows, likes, comments, likes_on_comments')
        .eq('user_id', recipientId)
        .single();

      if (settings) {
        let allowed = true;
        switch (type) {
          case 'follow':
            allowed = settings.follows;
            break;
          case 'post_like':
          case 'routine_like':
          case 'routine_save':
            allowed = settings.likes;
            break;
          case 'post_comment':
          case 'comment_reply':
            allowed = settings.comments;
            break;
          case 'comment_like':
            allowed = settings.likes_on_comments;
            break;
        }
        if (!allowed) {
          return new Response(JSON.stringify({ skipped: 'settings-disabled' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Count unread notifications for badge
    const { count: badgeCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', recipientId)
      .eq('read', false);

    // Build title/body
    const title = 'Atlas';
    let body = '';
    const actor = `@${actorUsername}`;

    switch (type) {
      case 'post_like':
        body = `${actor} liked your post`;
        break;
      case 'follow':
        body = `${actor} started following you`;
        break;
      case 'routine_like':
        body = `${actor} liked your routine`;
        break;
      case 'routine_save':
        body = `${actor} saved your routine`;
        break;
      case 'comment_like':
        body = `${actor} liked your comment`;
        break;
      case 'comment_reply':
        body = `${actor} replied to your comment`;
        break;
      case 'post_comment':
        body = `${actor} commented on your post`;
        break;
      case 'direct_message':
        body = `${actor} sent you a message`;
        break;
      default:
        body = `${actor} interacted with your content`;
    }

    // Send to Expo push service
    const message = {
      to: pushToken,
      title,
      body,
      sound: 'default',
      badge: badgeCount ?? 0,
      data: {
        type,
        actorId,
        actorUsername,
        actorAvatarUrl,
        postId,
        routineId,
        commentId,
        conversationId,
      },
    };

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // Push is non-critical — always return 200
    console.error('[send-push-notification] error:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
