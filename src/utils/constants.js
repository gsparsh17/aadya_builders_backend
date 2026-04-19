module.exports = {
  // API Configuration
  API_PREFIX: process.env.API_PREFIX || '/api/v1',
  
  // User Roles
  USER_ROLES: {
    BUYER: 'buyer',
    OWNER: 'owner',
    DEALER: 'dealer',
    BUILDER: 'builder',
    ADMIN: 'admin',
  },
  
  // Property Purposes
  PROPERTY_PURPOSES: {
    BUY: 'buy',
    RENT: 'rent',
    NEW_LAUNCH: 'new_launch',
    COMMERCIAL: 'commercial',
    LAND: 'land',
  },
  
  // Property Types
  PROPERTY_TYPES: {
    APARTMENT: 'apartment',
    VILLA: 'villa',
    INDEPENDENT_HOUSE: 'independent_house',
    BUILDER_FLOOR: 'builder_floor',
    PLOT: 'plot',
    OFFICE: 'office',
    SHOP: 'shop',
    WAREHOUSE: 'warehouse',
    PG: 'pg',
    FARMHOUSE: 'farmhouse',
  },
  
  // Property Status
  PROPERTY_STATUS: {
    PENDING: 'pending',
    ACTIVE: 'active',
    SOLD: 'sold',
    RENTED: 'rented',
    INACTIVE: 'inactive',
  },
  
  // Lead Status
  LEAD_STATUS: {
    NEW: 'new',
    CONTACTED: 'contacted',
    NEGOTIATING: 'negotiating',
    CLOSED: 'closed',
    REJECTED: 'rejected',
  },
  
  // Subscription Types
  SUBSCRIPTION_TYPES: {
    DEALER: 'dealer',
    BUILDER: 'builder',
    OWNER: 'owner',
  },
  
  // Article Categories
  ARTICLE_CATEGORIES: {
    BUYER_GUIDE: 'buyer_guide',
    TENANT_GUIDE: 'tenant_guide',
    OWNER_GUIDE: 'owner_guide',
    NEWS: 'news',
    LEGAL: 'legal',
    INTERIOR_DESIGN: 'interior_design',
    MARKET_TRENDS: 'market_trends',
    POLICY: 'policy',
  },
  
  // Free Tier Limits
  FREE_LIMITS: {
    OWNER_MAX_LISTINGS: 3,
    IMAGES_PER_PROPERTY: 20,
    LEADS_PER_HOUR: 10,
  },
  
  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // Cache TTL (seconds)
  CACHE_TTL: {
    SEARCH_RESULTS: 300,      // 5 minutes
    PROPERTY_DETAILS: 3600,    // 1 hour
    STATIC_CONTENT: 86400,     // 24 hours
  },
  
  // JWT Cookie Options
  COOKIE_OPTIONS: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
};