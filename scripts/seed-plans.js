/**
 * Seed the subscription plans shown in the app's "Plans & pricing" screen.
 * Idempotent: plans are upserted by `code`, so re-running updates them.
 *
 *   npm run seed:plans
 *
 * Prices are starting points — edit them here (or in the admin panel)
 * before going live.
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const SubscriptionPlan = require('../src/modules/payments/subscription.model');

const PLANS = [
  {
    code: 'OWNER_PLUS',
    name: 'Owner Plus',
    type: 'owner',
    description: 'For owners selling or renting out one or two properties.',
    price: 999,
    duration: 90,
    listingLimit: 5,
    featuredListingLimit: 1,
    searchPriority: 1,
    features: ['5 active listings', '1 featured listing', 'Verified owner badge', 'See who viewed your listing'],
    includes: { propertyVerification: true, analytics: true },
    displayOrder: 1,
  },
  {
    code: 'OWNER_MAX',
    name: 'Owner Max',
    type: 'owner',
    description: 'Sell faster with a professional shoot and top placement.',
    price: 2499,
    duration: 180,
    listingLimit: 10,
    featuredListingLimit: 3,
    premiumListingLimit: 1,
    searchPriority: 2,
    features: ['10 active listings', '3 featured listings', 'Professional photo shoot', 'Social media promotion', 'Priority in search'],
    includes: { propertyVerification: true, photoShoot: true, socialMediaPromotion: true, analytics: true },
    isRecommended: true,
    displayOrder: 2,
  },
  {
    code: 'AGENT_PRO',
    name: 'Agent Pro',
    type: 'dealer',
    description: 'For brokers and agents managing many listings and leads.',
    price: 4999,
    duration: 90,
    listingLimit: 50,
    featuredListingLimit: 10,
    premiumListingLimit: 3,
    searchPriority: 3,
    features: ['50 active listings', '10 featured listings', 'Verified agent badge', 'Lead export to Excel', 'Listing analytics'],
    includes: { propertyVerification: true, analytics: true, leadExport: true },
    isPopular: true,
    displayOrder: 3,
  },
  {
    code: 'BUILDER_PRO',
    name: 'Builder Pro',
    type: 'builder',
    description: 'Launch projects with plot layouts, galleries and a dedicated manager.',
    price: 14999,
    duration: 180,
    listingLimit: 200,
    featuredListingLimit: 30,
    premiumListingLimit: 10,
    searchPriority: 5,
    features: ['200 active listings', 'Unlimited projects with plot layouts', '30 featured listings', 'Home-page banner ads', 'Dedicated relationship manager'],
    includes: {
      bannerAds: true, projectGallery: true, dedicatedRM: true, propertyVerification: true,
      socialMediaPromotion: true, emailMarketing: true, analytics: true, leadExport: true,
    },
    displayOrder: 4,
  },
];

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/aadya_builders';
  await mongoose.connect(uri);
  for (const plan of PLANS) {
    await SubscriptionPlan.findOneAndUpdate({ code: plan.code }, { ...plan, isActive: true }, { upsert: true, new: true, runValidators: true });
    console.log(`✓ ${plan.name}`);
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error('Seeding plans failed:', err.message);
  process.exit(1);
});
