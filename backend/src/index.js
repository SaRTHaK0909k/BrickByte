require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createClient } = require('@supabase/supabase-js');
const { validateProperty } = require('./middleware/validate');
const errorHandler = require('./middleware/errorHandler');

// Initialize Express app
const app = express();

// Define allowed origins in one place so we can reuse for CORS and manual preflight handling
const allowedOrigins = [
  'http://localhost:3000',  // Local development
  'https://brickbyte.vercel.app',  // Vercel frontend
  'https://brickbytev24.vercel.app', // New Vercel domain
  process.env.FRONTEND_URL  // Environment variable for additional domains
].filter(Boolean);

// Middleware
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'X-CSRF-Token',
    'X-API-Key',
    // Wallet auth header used by frontend axios interceptor
    'x-wallet-address',
    'X-Wallet-Address'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400 // 24 hours
}));

// Explicit preflight handler: ensure custom headers (x-wallet-address) are always allowed
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token, X-API-Key, x-wallet-address');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.sendStatus(204);
  }
  next();
});

// Configure helmet with more permissive settings
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://brickbyte-backend.onrender.com", "https://brickbyte.vercel.app", "https://brickbytev24.vercel.app"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginEmbedderPolicy: false
}));

// Add error handling for CORS
app.use((err, req, res, next) => {
  if (err.name === 'CORS') {
    console.error('CORS Error:', err);
    return res.status(403).json({
      error: 'CORS Error',
      message: 'Not allowed by CORS'
    });
  }
  next(err);
});

app.use(morgan('dev'));
app.use(express.json());

// Initialize Supabase client (admin)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize public Supabase client (for non-admin operations)
const publicSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// NOTE: JWT-based auth removed. We'll use wallet-address-based identification instead.

// Middleware to resolve user by wallet address header
async function resolveUserByWallet(req, res, next) {
  try {
    const wallet = req.headers['x-wallet-address'] || req.body?.walletAddress;
    if (!wallet) {
      // no wallet provided — proceed without attaching user
      return next();
    }

    const walletAddress = Array.isArray(wallet) ? wallet[0] : wallet;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (error && error.code === 'PGRST116') {
      // not found — create a lightweight profile
      const { data: created, error: createErr } = await supabase
        .from('profiles')
        .insert([{ wallet_address: walletAddress, created_at: new Date().toISOString() }])
        .select()
        .single();
      if (createErr) throw createErr;
      req.user = created;
    } else if (error) {
      throw error;
    } else {
      req.user = profile;
    }

    next();
  } catch (err) {
    next(err);
  }
}

app.use(resolveUserByWallet);

// Authentication routes
// Wallet connect endpoint — find or create profile by wallet address
app.post('/api/auth/wallet-connect', async (req, res, next) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ message: 'walletAddress required' });

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (error && error.code === 'PGRST116') {
      const { data: created, error: createErr } = await supabase
        .from('profiles')
        .insert([{ wallet_address: walletAddress, created_at: new Date().toISOString() }])
        .select()
        .single();
      if (createErr) throw createErr;
      return res.json({ user: created });
    }

    if (error) throw error;
    return res.json({ user: profile });
  } catch (err) {
    next(err);
  }
});

// NOTE: login endpoint removed — wallet-connect handles user identification.

// Properties endpoints
app.get('/api/properties', async (req, res, next) => {
  try {
    const { data: properties, error } = await supabase
      .from('properties')
      .select(`
        *,
        profiles:owner_id (
          id,
          email,
          wallet_address
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(properties);
  } catch (error) {
    next(error);
  }
});

app.get('/api/properties/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const { data: property, error } = await supabase
      .from('properties')
      .select(`
        *,
        profiles:owner_id (
          id,
          email,
          wallet_address
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    res.json(property);
  } catch (error) {
    next(error);
  }
});

app.post('/api/properties', validateProperty, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('properties')
      .insert([{
        ...req.body,
      owner_id: req.user?.id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select(`
        *,
        profiles:owner_id (
          id,
          email,
          wallet_address
        )
      `);

    if (error) throw error;

    res.status(201).json(data[0]);
  } catch (error) {
    next(error);
  }
});

// User routes
app.get('/api/user/profile', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user?.id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// Property trading routes
app.post('/api/properties/:id/buy', async (req, res, next) => {
  try {
    const { shares } = req.body;
    const propertyId = req.params.id;

    // Verify property exists
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single();

    if (propertyError) throw propertyError;
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Check if enough shares are available
    if (property.available_shares < shares) {
      return res.status(400).json({ error: 'Not enough shares available' });
    }

    // Check if user already has shares
    const { data: existingShares, error: sharesError } = await supabase
      .from('user_shares')
      .select('shares')
      .eq('user_id', req.user?.id)
      .eq('property_id', propertyId)
      .single();

    if (sharesError && sharesError.code !== 'PGRST116') { // PGRST116 is "not found"
      throw sharesError;
    }

    // Record transaction
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert([{
  property_id: propertyId,
  user_id: req.user?.id,
        type: 'BUY',
        shares,
        price_per_share: property.price_per_share,
        created_at: new Date().toISOString()
      }]);

    if (transactionError) throw transactionError;

    // Update user's share balance
    const newShares = (existingShares?.shares || 0) + shares;
    const { error: shareError } = await supabase
      .from('user_shares')
      .upsert([{
  user_id: req.user?.id,
        property_id: propertyId,
        shares: newShares,
        updated_at: new Date().toISOString()
      }], {
        onConflict: 'user_id,property_id'
      });

    if (shareError) throw shareError;

    // Update property's available shares
    const { error: updateError } = await supabase
      .from('properties')
      .update({ 
        available_shares: property.available_shares - shares,
        updated_at: new Date().toISOString()
      })
      .eq('id', propertyId);

    if (updateError) throw updateError;

    res.status(201).json({ message: 'Shares purchased successfully' });
  } catch (error) {
    next(error);
  }
});

app.post('/api/properties/:id/sell', async (req, res, next) => {
  try {
    const { shares } = req.body;
    const propertyId = req.params.id;

    // Verify property exists
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single();

    if (propertyError) throw propertyError;
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Verify user has enough shares
    const { data: userShares, error: sharesError } = await supabase
      .from('user_shares')
      .select('shares')
      .eq('user_id', req.user?.id)
      .eq('property_id', propertyId)
      .single();

    if (sharesError) throw sharesError;
    if (!userShares || userShares.shares < shares) {
      return res.status(400).json({ error: 'Insufficient shares' });
    }

    // Record transaction
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert([{
        property_id: propertyId,
  user_id: req.user?.id,
        type: 'SELL',
        shares,
        price_per_share: property.price_per_share,
        created_at: new Date().toISOString()
      }]);

    if (transactionError) throw transactionError;

    // Update user's share balance
    const newShareBalance = userShares.shares - shares;
    const { error: updateError } = await supabase
      .from('user_shares')
      .update({ 
        shares: newShareBalance,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', req.user?.id)
      .eq('property_id', propertyId);

    if (updateError) throw updateError;

    // Update property's available shares
    const { error: propertyUpdateError } = await supabase
      .from('properties')
      .update({ 
        available_shares: property.available_shares + shares,
        updated_at: new Date().toISOString()
      })
      .eq('id', propertyId);

    if (propertyUpdateError) throw propertyUpdateError;

    res.json({ message: 'Shares sold successfully' });
  } catch (error) {
    next(error);
  }
});

// Get user's shares
app.get('/api/user/shares', async (req, res, next) => {
  try {
  console.log('Fetching user shares for user:', req.user?.id);
    
    const { data, error } = await supabase
      .from('user_shares')
      .select(`
        shares,
        property_id,
        properties:property_id (
          id,
          name,
          location,
          price_per_share,
          rental_yield,
          image_url,
          total_shares
        )
      `)
      .eq('user_id', req.user?.id);

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    console.log('Found user shares:', JSON.stringify(data, null, 2));
    res.json(data);
  } catch (error) {
    console.error('Error in /api/user/shares:', error);
    next(error);
  }
});

// Get user's transactions
app.get('/api/transactions', async (req, res, next) => {
  try {
  console.log('Fetching transactions for user:', req.user?.id);
    
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        properties (
          name,
          location,
          price_per_share
        )
      `)
      .eq('user_id', req.user?.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    console.log('Found transactions:', data);
    res.json(data || []);
  } catch (error) {
    console.error('Error in /api/transactions:', error);
    next(error);
  }
});

// Add verify token endpoint
app.get('/api/auth/verify', async (req, res, next) => {
  try {
    // The JWT middleware already verified the token
    // We just need to get the user data
    const userId = req.user?.id;
    
    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// Apply error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 