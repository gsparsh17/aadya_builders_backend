const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  // References
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: [true, 'Property reference is required']
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Buyer reference is required']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Owner reference is required']
  },

  // Lead Details
  message: {
    type: String,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  contactPreference: {
    type: String,
    enum: ['phone', 'email', 'whatsapp', 'any'],
    default: 'any'
  },
  preferredTimeToContact: {
    type: String,
    enum: ['morning', 'afternoon', 'evening', 'anytime'],
    default: 'anytime'
  },

  // Buyer Information Snapshot (at time of lead)
  buyerSnapshot: {
    name: String,
    email: String,
    phone: String,
    profilePicture: String
  },

  // Property Information Snapshot
  propertySnapshot: {
    title: String,
    price: Number,
    purpose: String,
    location: {
      locality: String,
      city: String
    },
    primaryImage: String
  },

  // Lead Status
  status: {
    type: String,
    enum: ['new', 'viewed', 'contacted', 'negotiating', 'site_visit_scheduled',
      'site_visit_done', 'offer_made', 'closed_won', 'closed_lost', 'rejected', 'spam'],
    default: 'new'
  },

  // Contact Information Sharing
  contactShared: {
    type: Boolean,
    default: false
  },
  contactSharedAt: Date,

  // Communication History
  communications: [{
    type: {
      type: String,
      enum: ['call', 'email', 'sms', 'whatsapp', 'site_visit', 'note']
    },
    direction: {
      type: String,
      enum: ['incoming', 'outgoing']
    },
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    duration: Number, // For calls in seconds
    outcome: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Notes (internal for owner)
  notes: [{
    text: {
      type: String,
      required: true
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isPrivate: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Follow-up
  followUp: {
    scheduled: Boolean,
    scheduledDate: Date,
    reminder: Boolean,
    reminderSent: { type: Boolean, default: false },
    notes: String
  },

  // Offer Details (if applicable)
  offer: {
    amount: Number,
    isNegotiable: Boolean,
    offeredAt: Date,
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'countered']
    },
    counterOffer: Number,
    notes: String
  },

  // Site Visit
  siteVisit: {
    scheduled: Boolean,
    scheduledDate: Date,
    completed: { type: Boolean, default: false },
    completedAt: Date,
    feedback: String,
    rating: { type: Number, min: 1, max: 5 }
  },

  // Deal Closing
  closedDetails: {
    closedAt: Date,
    finalAmount: Number,
    paymentMethod: String,
    agreementUrl: String,
    notes: String
  },

  // Ratings and Feedback
  rating: {
    given: { type: Boolean, default: false },
    score: { type: Number, min: 1, max: 5 },
    feedback: String,
    ratedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    ratedAt: Date
  },

  // Spam Detection
  isSpam: {
    type: Boolean,
    default: false
  },
  spamScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  spamReasons: [String],

  // Metadata
  source: {
    type: String,
    enum: ['website', 'mobile_app', 'direct', 'referral', 'campaign'],
    default: 'website'
  },
  campaign: String,
  ipAddress: String,
  userAgent: String,

  // Timestamps for status changes
  statusHistory: [{
    status: String,
    changedAt: { type: Date, default: Date.now },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String
  }]

}, {
  timestamps: true
});

// Prevent duplicate leads from same user for same property within 7 days
leadSchema.index(
  { property: 1, buyer: 1 },
  { unique: true, partialFilterExpression: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }
);
leadSchema.index({ owner: 1, status: 1 });
leadSchema.index({ buyer: 1, createdAt: -1 });
leadSchema.index({ property: 1, status: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ 'followUp.scheduledDate': 1 }, { sparse: true });
leadSchema.index({ isSpam: 1 });

// Pre-save hook to capture snapshots
leadSchema.pre('save', async function () {
  if (this.isNew) {
    // Capture buyer snapshot
    if (this.buyer && !this.buyerSnapshot.name) {
      const User = mongoose.model('User');
      const buyer = await User.findById(this.buyer).select('name email phone profilePicture');
      if (buyer) {
        this.buyerSnapshot = {
          name: buyer.name,
          email: buyer.email,
          phone: buyer.phone,
          profilePicture: buyer.profilePicture
        };
      }
    }

    // Capture property snapshot
    if (this.property && !this.propertySnapshot.title) {
      const Property = mongoose.model('Property');
      const property = await Property.findById(this.property)
        .select('title price purpose location primaryImage');
      if (property) {
        this.propertySnapshot = {
          title: property.title,
          price: property.price,
          purpose: property.purpose,
          location: {
            locality: property.location?.locality,
            city: property.location?.city
          },
          primaryImage: property.primaryImage
        };
      }
    }

    // Add status history entry
    this.statusHistory.push({
      status: this.status,
      notes: 'Lead created'
    });
  }

  // Track status changes
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      changedAt: new Date(),
      notes: `Status changed to ${this.status}`
    });
  }
});

// Post-save hook to update property lead count
leadSchema.post('save', async function () {
  if (this.isNew) {
    const Property = mongoose.model('Property');
    await Property.findByIdAndUpdate(this.property, {
      $inc: { leads: 1 }
    });
  }
});

// Method to mark as contacted
leadSchema.methods.markAsContacted = async function (userId, notes) {
  this.status = 'contacted';
  this.contactShared = true;
  this.contactSharedAt = new Date();

  this.communications.push({
    type: 'note',
    direction: 'outgoing',
    initiatedBy: userId,
    content: notes || 'Marked as contacted',
    createdAt: new Date()
  });

  return this.save();
};

// Method to schedule follow-up
leadSchema.methods.scheduleFollowUp = async function (date, notes) {
  this.followUp = {
    scheduled: true,
    scheduledDate: date,
    reminder: true,
    reminderSent: false,
    notes: notes
  };

  return this.save();
};

// Method to add communication
leadSchema.methods.addCommunication = async function (commData) {
  this.communications.push({
    ...commData,
    createdAt: new Date()
  });

  // Update status if still new
  if (this.status === 'new') {
    this.status = 'viewed';
  }

  return this.save();
};

// Method to calculate spam score
leadSchema.methods.calculateSpamScore = async function () {
  let score = 0;
  const reasons = [];

  // Check for duplicate leads
  const Lead = mongoose.model('Lead');
  const recentLeads = await Lead.countDocuments({
    buyer: this.buyer,
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  });

  if (recentLeads > 10) {
    score += 50;
    reasons.push('High volume of leads in 24 hours');
  }

  // Check message content
  if (this.message) {
    // Check for common spam patterns
    const spamPatterns = ['loan', 'credit', 'insurance', 'investment', 'earn money'];
    const messageLower = this.message.toLowerCase();
    const hasSpamPattern = spamPatterns.some(p => messageLower.includes(p));
    if (hasSpamPattern) {
      score += 30;
      reasons.push('Message contains spam keywords');
    }

    // Check message length
    if (this.message.length < 10) {
      score += 10;
      reasons.push('Very short message');
    }
  }

  // Check buyer account age
  const User = mongoose.model('User');
  const buyer = await User.findById(this.buyer);
  if (buyer) {
    const accountAge = (Date.now() - buyer.createdAt) / (1000 * 60 * 60 * 24);
    if (accountAge < 1) {
      score += 20;
      reasons.push('New account (less than 1 day old)');
    }

    if (!buyer.phoneVerified && !buyer.emailVerified) {
      score += 20;
      reasons.push('Unverified account');
    }
  }

  this.spamScore = Math.min(score, 100);
  this.spamReasons = reasons;
  this.isSpam = this.spamScore >= 50;

  return this.spamScore;
};

const Lead = mongoose.model('Lead', leadSchema);

module.exports = Lead;