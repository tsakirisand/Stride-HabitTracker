const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const Stripe = require('stripe');
const cors = require('cors')({ origin: true });

admin.initializeApp();
const db = admin.firestore();

// --- CONFIGURATION ---
// IMPORTANT: Configure these via Firebase Functions environment configuration
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'your_stripe_secret_key_here';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'your_stripe_webhook_secret_here';

const stripe = Stripe(STRIPE_SECRET_KEY);

/**
 * 1. Create Checkout Session (v2)
 */
exports.createCheckoutSession = onRequest({
  cors: true,
  maxInstances: 10
}, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { returnUrl, idToken } = req.body.data || req.body;
  let uid = null;

  if (idToken) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      uid = decodedToken.uid;
    } catch (e) {
      console.error('Token verification failed:', e);
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (!uid) {
    return res.status(401).json({ error: 'User must be signed in' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      client_reference_id: uid,
      success_url: returnUrl ? `${returnUrl}?status=success` : 'https://example.com/success',
      cancel_url: returnUrl ? `${returnUrl}?status=cancel` : 'https://example.com/cancel',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Stride Premium',
              description: 'Unlock unlimited habits and advanced statistics. 14 days free.',
            },
            unit_amount: 199, // $1.99
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          firebaseUID: uid,
        },
      },
      metadata: {
        firebaseUID: uid,
      }
    });

    console.log(`Checkout session created for user: ${uid}`);
    return res.json({ data: { url: session.url, id: session.id } });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * 2. Stripe Webhook (v2)
 */
exports.stripeWebhook = onRequest({
  invoker: 'public',
  maxInstances: 10
}, async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook Signature Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`Received event: ${event.type}`);

  // Handle successful purchase
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // Robust User Lookup Strategy
    let uid = session.client_reference_id || (session.metadata && session.metadata.firebaseUID);
    
    if (!uid && session.customer_details && session.customer_details.email) {
      console.log(`UID missing, searching by email: ${session.customer_details.email}`);
      try {
        const userFound = await admin.auth().getUserByEmail(session.customer_details.email);
        uid = userFound.uid;
      } catch (authError) {
        console.error(`Could not find user by email: ${session.customer_details.email}`);
      }
    }

    if (uid) {
      await db.collection('users').doc(uid).set(
        { 
          isPremium: true,
          stripeCustomerId: session.customer,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      console.log(`SUCCESS: User ${uid} is now Premium.`);
    } else {
      console.error('CRITICAL: Could not determine user UID for checkout session.');
    }
  }

  // Handle cancellation or expiration
  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
    const subscription = event.data.object;
    
    // In subscription events, UID is usually in metadata
    let uid = subscription.metadata && subscription.metadata.firebaseUID;
    
    // If deleted, we mark as not premium
    if (event.type === 'customer.subscription.deleted' && uid) {
      await db.collection('users').doc(uid).set({ isPremium: false }, { merge: true });
      console.log(`INFO: User ${uid} subscription deleted.`);
    }
  }

  res.json({ received: true });
});

/**
 * 3. Create Portal Session (v2)
 */
exports.createPortalSession = onCall({
  cors: true,
  maxInstances: 10
}, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'User must be signed in.');
  }

  const uid = request.auth.uid;
  const returnUrl = request.data ? request.data.returnUrl : null;
  
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();
    
    if (!userData || !userData.stripeCustomerId) {
      throw new HttpsError('not-found', 'No Stripe customer record found.');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: userData.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  } catch (error) {
    console.error('Portal Error:', error);
    throw new HttpsError('internal', error.message);
  }
});
