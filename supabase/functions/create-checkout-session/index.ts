import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'npm:stripe@14';

// TODO: Set STRIPE_SECRET_KEY secret via:
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_...

// TODO: Fill in Stripe price IDs after creating products in the Stripe Dashboard
const PRICE_IDS: Record<string, string> = {
  monthly: 'price_1TBfqoE6Ov68b0Y9eu8Y47vL',
  yearly: 'price_1TBfrpE6Ov68b0Y9D9xiDRug',
  lifetime: 'price_1TBfskE6Ov68b0Y9m9mfGwYZ',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify JWT and extract user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;

    // Verify the user token
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { planType } = await req.json();
    const priceId = PRICE_IDS[planType];
    if (!priceId) {
      return new Response(JSON.stringify({ error: `Unknown plan type: ${planType}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // Look up or create Stripe customer for this user
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('stripe_customer_id, username')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id, username: profile?.username ?? '' },
      });
      customerId = customer.id;

      await serviceClient
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // Build checkout session params based on plan type
    const isLifetime = planType === 'lifetime';
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      payment_method_types: ['card'],
      mode: isLifetime ? 'payment' : 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: 'atlas://pro-success',
      cancel_url: 'atlas://pro-cancel',
      metadata: { supabase_user_id: user.id, plan_type: planType },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[create-checkout-session] error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
