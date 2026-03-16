import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'npm:stripe@14';

// TODO: Set secrets via:
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
//   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
//
// Register this function as a webhook endpoint in the Stripe Dashboard:
//   URL: https://<project-ref>.supabase.co/functions/v1/stripe-webhook
//   Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted

Deno.serve(async (req) => {
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Verify Stripe webhook signature
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err);
    return new Response(`Webhook signature verification failed: ${String(err)}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // TODO: Handle successful checkout
        // - For subscriptions: the subscription becomes active via subscription.updated event
        // - For lifetime (one-time payment): grant pro access immediately
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const planType = session.metadata?.plan_type;

        if (!userId || !planType) break;

        if (planType === 'lifetime' && session.payment_status === 'paid') {
          // Grant lifetime pro access
          await supabase
            .from('profiles')
            .update({
              subscription_tier: 'pro',
              subscription_expires_at: null, // null = never expires
            })
            .eq('id', userId);

          await supabase.from('subscriptions').insert({
            user_id: userId,
            stripe_customer_id: session.customer as string,
            plan_type: 'lifetime',
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: null,
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        // TODO: Sync subscription status changes (renewals, plan changes, cancellations)
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;

        if (!userId) break;

        const isActive = subscription.status === 'active';
        const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

        await supabase
          .from('profiles')
          .update({
            subscription_tier: isActive ? 'pro' : 'free',
            subscription_expires_at: isActive ? periodEnd : null,
          })
          .eq('id', userId);

        // Update or insert subscription record
        await supabase
          .from('subscriptions')
          .upsert(
            {
              user_id: userId,
              stripe_subscription_id: subscription.id,
              stripe_customer_id: subscription.customer as string,
              plan_type: subscription.metadata?.plan_type ?? 'monthly',
              status: subscription.status as string,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: periodEnd,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'stripe_subscription_id' },
          );
        break;
      }

      case 'customer.subscription.deleted': {
        // TODO: Revoke pro access when subscription is fully canceled
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;

        if (!userId) break;

        await supabase
          .from('profiles')
          .update({
            subscription_tier: 'free',
            subscription_expires_at: null,
          })
          .eq('id', userId);

        await supabase
          .from('subscriptions')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }

      default:
        console.log(`[stripe-webhook] unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[stripe-webhook] handler error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
