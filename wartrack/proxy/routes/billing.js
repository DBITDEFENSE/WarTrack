// ============================================
// BILLING ROUTES — Stripe subscription management
// ============================================

import Stripe from 'stripe';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY || 'price_1TEgcTBzqjEiVYn5N3A4QMFa';
const STRIPE_PRICE_YEARLY = process.env.STRIPE_PRICE_YEARLY || '';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

let stripe = null;
if (STRIPE_SECRET_KEY) {
  stripe = new Stripe(STRIPE_SECRET_KEY);
}

export async function handleBilling(req, res, urlPath, body, rawBody) {
  // ============================================
  // STATUS CHECK
  // ============================================
  if (urlPath === '/api/billing/status' && req.method === 'GET') {
    if (!stripe) {
      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'free', configured: false }));
    }

    let user;
    try { user = await requireAuth(req); } catch (err) {
      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'free', authenticated: false }));
    }

    // Admins always have pro access
    if (user.isAdmin || user.role === 'admin') {
      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'active', admin: true, configured: true }));
    }

    // Look up subscription status in Supabase
    if (supabaseConfigured) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.userId)
          .maybeSingle();

        res.writeHead(200);
        return res.end(JSON.stringify({
          status: profile?.subscription_status || 'free',
          periodEnd: profile?.subscription_period_end || null,
          configured: true,
        }));
      } catch {
        // Table may not have billing columns yet — fall through
      }
    }

    res.writeHead(200);
    return res.end(JSON.stringify({ status: 'free', configured: true }));
  }

  // ============================================
  // CREATE CHECKOUT SESSION
  // ============================================
  if (urlPath === '/api/billing/checkout' && req.method === 'POST') {
    if (!stripe) {
      res.writeHead(503);
      return res.end(JSON.stringify({ error: 'Stripe not configured' }));
    }

    let user;
    try { user = await requireAuth(req); } catch (err) {
      res.writeHead(err.status || 401);
      return res.end(JSON.stringify({ error: err.message }));
    }

    const plan = body?.plan || 'monthly';
    const priceId = plan === 'yearly' ? STRIPE_PRICE_YEARLY : STRIPE_PRICE_MONTHLY;
    if (!priceId) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'No price configured for this plan' }));
    }

    try {
      // Find or create Stripe customer
      let customerId = null;
      if (supabaseConfigured) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('stripe_customer_id')
          .eq('id', user.userId)
          .maybeSingle();
        customerId = profile?.stripe_customer_id;
      }

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { wartrack_user_id: user.userId },
        });
        customerId = customer.id;

        // Save customer ID
        if (supabaseConfigured) {
          await supabase.from('profiles').upsert({
            id: user.userId,
            stripe_customer_id: customerId,
          });
        }
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${APP_URL}?billing=success`,
        cancel_url: `${APP_URL}?billing=cancelled`,
        metadata: { wartrack_user_id: user.userId },
      });

      res.writeHead(200);
      return res.end(JSON.stringify({ url: session.url }));
    } catch (err) {
      console.error('Stripe checkout error:', err.message);
      res.writeHead(500);
      return res.end(JSON.stringify({ error: 'Failed to create checkout session' }));
    }
  }

  // ============================================
  // CUSTOMER PORTAL
  // ============================================
  if (urlPath === '/api/billing/portal' && req.method === 'POST') {
    if (!stripe) {
      res.writeHead(503);
      return res.end(JSON.stringify({ error: 'Stripe not configured' }));
    }

    let user;
    try { user = await requireAuth(req); } catch (err) {
      res.writeHead(err.status || 401);
      return res.end(JSON.stringify({ error: err.message }));
    }

    try {
      let customerId = null;
      if (supabaseConfigured) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('stripe_customer_id')
          .eq('id', user.userId)
          .maybeSingle();
        customerId = profile?.stripe_customer_id;
      }

      if (!customerId) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: 'No billing account found' }));
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: APP_URL,
      });

      res.writeHead(200);
      return res.end(JSON.stringify({ url: session.url }));
    } catch (err) {
      res.writeHead(500);
      return res.end(JSON.stringify({ error: 'Failed to create portal session' }));
    }
  }

  // ============================================
  // WEBHOOK — Stripe event handler
  // ============================================
  if (urlPath === '/api/billing/webhook' && req.method === 'POST') {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Webhook not configured' }));
    }

    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody || JSON.stringify(body), sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Invalid signature' }));
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const userId = session.metadata?.wartrack_user_id;
          if (userId && supabaseConfigured) {
            await supabase.from('profiles').upsert({
              id: userId,
              stripe_customer_id: session.customer,
              subscription_status: 'active',
              subscription_id: session.subscription,
            });
          }
          break;
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object;
          if (supabaseConfigured) {
            await supabase.from('profiles')
              .update({
                subscription_status: sub.status,
                subscription_period_end: new Date(sub.current_period_end * 1000).toISOString(),
              })
              .eq('stripe_customer_id', sub.customer);
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          if (supabaseConfigured) {
            await supabase.from('profiles')
              .update({ subscription_status: 'canceled', subscription_id: null })
              .eq('stripe_customer_id', sub.customer);
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          if (supabaseConfigured) {
            await supabase.from('profiles')
              .update({ subscription_status: 'past_due' })
              .eq('stripe_customer_id', invoice.customer);
          }
          break;
        }
      }

      res.writeHead(200);
      return res.end(JSON.stringify({ received: true }));
    } catch (err) {
      console.error('Webhook processing error:', err.message);
      res.writeHead(500);
      return res.end(JSON.stringify({ error: 'Webhook processing failed' }));
    }
  }

  // ============================================
  // PRICING INFO (public)
  // ============================================
  if (urlPath === '/api/billing/pricing' && req.method === 'GET') {
    res.writeHead(200);
    return res.end(JSON.stringify({
      plans: [
        { id: 'monthly', price: '$1/month', priceId: STRIPE_PRICE_MONTHLY ? 'configured' : null },
        { id: 'yearly', price: '$15/year', priceId: STRIPE_PRICE_YEARLY ? 'configured' : null, badge: 'SAVE 17%' },
      ],
      configured: !!stripe,
    }));
  }

  return false;
}
