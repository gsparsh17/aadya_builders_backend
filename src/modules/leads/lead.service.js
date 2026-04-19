const Lead = require('./lead.model');
const Property = require('../properties/property.model');
const User = require('../users/user.model');
const { AppError } = require('../../middlewares/errorHandler');
const logger = require('../../utils/logger');
const emailService = require('../../utils/emailService');
const smsService = require('../../utils/smsService');

/**
 * Lead Service - Handles all business logic for lead operations
 */
class LeadService {
  
  /**
   * Create a new lead (contact owner)
   */
  async createLead(propertyId, buyerId, leadData) {
    const { message, contactPreference, preferredTimeToContact } = leadData;
    
    // Get property with owner details
    const property = await Property.findById(propertyId).populate('owner', 'name email phone');
    
    if (!property) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }
    
    // Check if property is active
    if (property.status !== 'active') {
      throw new AppError('This property is no longer available', 400, 'PROPERTY_NOT_ACTIVE');
    }
    
    // Check if buyer is the owner
    if (property.owner._id.toString() === buyerId) {
      throw new AppError('You cannot contact yourself', 400, 'SELF_CONTACT');
    }
    
    // Check for duplicate lead within 7 days
    const existingLead = await Lead.findOne({
      property: propertyId,
      buyer: buyerId,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });
    
    if (existingLead) {
      throw new AppError('You have already contacted this owner recently. Please wait before trying again.', 400, 'DUPLICATE_LEAD');
    }
    
    // Get buyer details
    const buyer = await User.findById(buyerId).select('name email phone');
    
    if (!buyer) {
      throw new AppError('Buyer not found', 404, 'BUYER_NOT_FOUND');
    }
    
    // Create lead
    const lead = await Lead.create({
      property: propertyId,
      buyer: buyerId,
      owner: property.owner._id,
      message: message || 'Interested in this property',
      contactPreference: contactPreference || 'any',
      preferredTimeToContact: preferredTimeToContact || 'anytime',
      buyerSnapshot: {
        name: buyer.name,
        email: buyer.email,
        phone: buyer.phone,
        profilePicture: buyer.profilePicture
      },
      propertySnapshot: {
        title: property.title,
        price: property.price,
        purpose: property.purpose,
        location: {
          locality: property.location.locality,
          city: property.location.city
        },
        primaryImage: property.primaryImage
      }
    });
    
    // Calculate spam score (async, don't wait)
    this.calculateSpamScore(lead._id).catch(err => 
      logger.error('Failed to calculate spam score:', err)
    );
    
    // Increment property lead count
    await Property.findByIdAndUpdate(propertyId, { $inc: { leads: 1 } });
    
    // Send notifications to owner
    this.sendLeadNotifications(property.owner, buyer, property, message).catch(err =>
      logger.error('Failed to send lead notifications:', err)
    );
    
    return lead;
  }

  /**
   * Calculate spam score for a lead
   */
  async calculateSpamScore(leadId) {
    const lead = await Lead.findById(leadId);
    
    if (!lead) return;
    
    let score = 0;
    const reasons = [];
    
    // Check recent leads from this buyer
    const recentLeadsCount = await Lead.countDocuments({
      buyer: lead.buyer,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    if (recentLeadsCount > 10) {
      score += 50;
      reasons.push('High volume of leads in 24 hours');
    } else if (recentLeadsCount > 5) {
      score += 25;
      reasons.push('Moderate volume of leads in 24 hours');
    }
    
    // Check message content
    if (lead.message) {
      const spamKeywords = ['loan', 'credit', 'insurance', 'investment', 'earn money', 'forex', 'trading', 'casino'];
      const messageLower = lead.message.toLowerCase();
      const hasSpamKeyword = spamKeywords.some(keyword => messageLower.includes(keyword));
      
      if (hasSpamKeyword) {
        score += 30;
        reasons.push('Message contains spam keywords');
      }
      
      // Check message length
      if (lead.message.length < 10) {
        score += 10;
        reasons.push('Very short message');
      }
      
      // Check for repeated identical messages
      const identicalMessages = await Lead.countDocuments({
        buyer: lead.buyer,
        message: lead.message,
        _id: { $ne: lead._id }
      });
      
      if (identicalMessages > 3) {
        score += 40;
        reasons.push('Identical message sent to multiple properties');
      }
    }
    
    // Check buyer account age
    const buyer = await User.findById(lead.buyer);
    if (buyer) {
      const accountAgeDays = (Date.now() - buyer.createdAt) / (1000 * 60 * 60 * 24);
      
      if (accountAgeDays < 1) {
        score += 20;
        reasons.push('New account (less than 1 day old)');
      } else if (accountAgeDays < 7) {
        score += 10;
        reasons.push('Recent account (less than 7 days old)');
      }
      
      if (!buyer.phoneVerified && !buyer.emailVerified) {
        score += 20;
        reasons.push('Unverified account');
      }
    }
    
    // Check property distribution (contacting many different owners)
    const uniqueOwnersContacted = await Lead.distinct('owner', {
      buyer: lead.buyer,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    if (uniqueOwnersContacted.length > 15) {
      score += 30;
      reasons.push('Contacting many different owners');
    }
    
    lead.spamScore = Math.min(score, 100);
    lead.spamReasons = reasons;
    lead.isSpam = lead.spamScore >= 50;
    
    await lead.save();
    
    return lead;
  }

  /**
   * Send lead notifications to owner
   */
  async sendLeadNotifications(owner, buyer, property, message) {
    try {
      // Send email notification
      const emailSubject = `New Lead: ${property.title}`;
      const emailBody = `
        <h2>New Lead Received</h2>
        <p><strong>Property:</strong> ${property.title}</p>
        <p><strong>Buyer:</strong> ${buyer.name}</p>
        <p><strong>Email:</strong> ${buyer.email}</p>
        <p><strong>Phone:</strong> ${buyer.phone}</p>
        <p><strong>Message:</strong> ${message || 'Interested in this property'}</p>
        <p><a href="${process.env.FRONTEND_URL}/dashboard/leads">View Lead Details</a></p>
      `;
      
      await emailService.sendEmail(owner.email, emailSubject, emailBody);
      
      // Send SMS notification if owner has phone notifications enabled
      if (owner.preferences?.notificationPreferences?.sms) {
        const smsMessage = `New lead for ${property.title}! ${buyer.name} is interested. Check your email or dashboard for details.`;
        await smsService.sendSms(owner.phone, smsMessage);
      }
    } catch (error) {
      logger.error('Failed to send lead notification:', error);
    }
  }

  /**
   * Get lead by ID
   */
  async getLeadById(leadId, userId, userRole) {
    const lead = await Lead.findById(leadId)
      .populate('property', 'title price purpose location images propertyCode')
      .populate('buyer', 'name email phone profilePicture')
      .populate('owner', 'name email phone profilePicture');
    
    if (!lead) {
      throw new AppError('Lead not found', 404, 'LEAD_NOT_FOUND');
    }
    
    // Check permission
    const isOwner = lead.owner._id.toString() === userId;
    const isBuyer = lead.buyer._id.toString() === userId;
    const isAdmin = userRole === 'admin';
    
    if (!isOwner && !isBuyer && !isAdmin) {
      throw new AppError('You do not have permission to view this lead', 403, 'FORBIDDEN');
    }
    
    // Mark as viewed if owner is viewing
    if (isOwner && lead.status === 'new') {
      lead.status = 'viewed';
      lead.statusHistory.push({
        status: 'viewed',
        changedAt: new Date(),
        notes: 'Lead viewed by owner'
      });
      await lead.save();
    }
    
    // For buyer, hide owner's private notes
    if (isBuyer) {
      lead.notes = lead.notes.filter(note => !note.isPrivate);
    }
    
    return lead;
  }

  /**
   * Get leads for a property
   */
  async getLeadsByProperty(propertyId, userId, filters = {}, page = 1, limit = 20) {
    // Verify property ownership
    const property = await Property.findById(propertyId);
    
    if (!property) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }
    
    if (property.owner.toString() !== userId) {
      throw new AppError('You do not own this property', 403, 'FORBIDDEN');
    }
    
    const query = { property: propertyId };
    
    if (filters.status) {
      query.status = filters.status;
    }
    
    if (filters.isSpam !== undefined) {
      query.isSpam = filters.isSpam === 'true';
    }
    
    const skip = (page - 1) * limit;
    
    const [leads, total] = await Promise.all([
      Lead.find(query)
        .populate('buyer', 'name email phone profilePicture')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Lead.countDocuments(query)
    ]);
    
    return {
      leads,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get leads for a user (as owner)
   */
  async getOwnerLeads(userId, filters = {}, page = 1, limit = 20) {
    const query = { owner: userId };
    
    if (filters.status) {
      query.status = filters.status;
    }
    
    if (filters.propertyId) {
      query.property = filters.propertyId;
    }
    
    if (filters.isSpam !== undefined) {
      query.isSpam = filters.isSpam === 'true';
    }
    
    if (filters.dateFrom) {
      query.createdAt = { $gte: new Date(filters.dateFrom) };
    }
    
    if (filters.dateTo) {
      query.createdAt = { ...query.createdAt, $lte: new Date(filters.dateTo) };
    }
    
    const skip = (page - 1) * limit;
    
    const [leads, total] = await Promise.all([
      Lead.find(query)
        .populate('property', 'title price purpose location primaryImage propertyCode')
        .populate('buyer', 'name email phone profilePicture')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Lead.countDocuments(query)
    ]);
    
    // Get summary statistics
    const stats = await this.getOwnerLeadStats(userId, filters);
    
    return {
      leads,
      stats,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get leads for a user (as buyer)
   */
  async getBuyerLeads(userId, page = 1, limit = 20) {
    const query = { buyer: userId };
    
    const skip = (page - 1) * limit;
    
    const [leads, total] = await Promise.all([
      Lead.find(query)
        .populate('property', 'title price purpose location primaryImage propertyCode status')
        .populate('owner', 'name phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Lead.countDocuments(query)
    ]);
    
    return {
      leads,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get lead statistics for owner
   */
  async getOwnerLeadStats(userId, filters = {}) {
    const baseQuery = { owner: userId };
    
    if (filters.propertyId) {
      baseQuery.property = filters.propertyId;
    }
    
    if (filters.dateFrom) {
      baseQuery.createdAt = { $gte: new Date(filters.dateFrom) };
    }
    
    if (filters.dateTo) {
      baseQuery.createdAt = { ...baseQuery.createdAt, $lte: new Date(filters.dateTo) };
    }
    
    const stats = await Lead.aggregate([
      { $match: baseQuery },
      { $group: {
        _id: null,
        total: { $sum: 1 },
        new: { $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] } },
        viewed: { $sum: { $cond: [{ $eq: ['$status', 'viewed'] }, 1, 0] } },
        contacted: { $sum: { $cond: [{ $eq: ['$status', 'contacted'] }, 1, 0] } },
        negotiating: { $sum: { $cond: [{ $eq: ['$status', 'negotiating'] }, 1, 0] } },
        closed_won: { $sum: { $cond: [{ $eq: ['$status', 'closed_won'] }, 1, 0] } },
        closed_lost: { $sum: { $cond: [{ $eq: ['$status', 'closed_lost'] }, 1, 0] } },
        spam: { $sum: { $cond: [{ $eq: ['$isSpam', true] }, 1, 0] } }
      }}
    ]);
    
    // Get leads by property
    const byProperty = await Lead.aggregate([
      { $match: baseQuery },
      { $group: {
        _id: '$property',
        count: { $sum: 1 }
      }},
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: {
        from: 'properties',
        localField: '_id',
        foreignField: '_id',
        as: 'property'
      }},
      { $unwind: '$property' },
      { $project: {
        propertyId: '$_id',
        title: '$property.title',
        count: 1
      }}
    ]);
    
    // Get leads by day (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const byDay = await Lead.aggregate([
      { $match: { ...baseQuery, createdAt: { $gte: sevenDaysAgo } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);
    
    return {
      summary: stats[0] || { total: 0, new: 0, viewed: 0, contacted: 0, negotiating: 0, closed_won: 0, closed_lost: 0, spam: 0 },
      byProperty,
      byDay
    };
  }

  /**
   * Update lead status
   */
  async updateLeadStatus(leadId, userId, status, notes = null) {
    const lead = await Lead.findById(leadId);
    
    if (!lead) {
      throw new AppError('Lead not found', 404, 'LEAD_NOT_FOUND');
    }
    
    // Only owner or admin can update status
    if (lead.owner.toString() !== userId) {
      throw new AppError('You do not have permission to update this lead', 403, 'FORBIDDEN');
    }
    
    const oldStatus = lead.status;
    lead.status = status;
    
    // Handle contact sharing
    if (status === 'contacted' && !lead.contactShared) {
      lead.contactShared = true;
      lead.contactSharedAt = new Date();
    }
    
    // Handle closing
    if (status === 'closed_won' || status === 'closed_lost') {
      lead.closedDetails = {
        closedAt: new Date(),
        notes: notes || `Lead ${status === 'closed_won' ? 'won' : 'lost'}`
      };
    }
    
    // Add status history
    lead.statusHistory.push({
      status,
      changedAt: new Date(),
      changedBy: userId,
      notes: notes || `Status changed from ${oldStatus} to ${status}`
    });
    
    await lead.save();
    
    return lead;
  }

  /**
   * Add note to lead
   */
  async addLeadNote(leadId, userId, text, isPrivate = false) {
    const lead = await Lead.findById(leadId);
    
    if (!lead) {
      throw new AppError('Lead not found', 404, 'LEAD_NOT_FOUND');
    }
    
    // Check permission
    const isOwner = lead.owner.toString() === userId;
    const isBuyer = lead.buyer.toString() === userId;
    
    if (!isOwner && !isBuyer) {
      throw new AppError('You do not have permission to add notes to this lead', 403, 'FORBIDDEN');
    }
    
    // Buyers can only add non-private notes
    if (isBuyer && isPrivate) {
      throw new AppError('Buyers cannot add private notes', 400, 'PRIVATE_NOTE_NOT_ALLOWED');
    }
    
    lead.notes.push({
      text,
      addedBy: userId,
      isPrivate,
      createdAt: new Date()
    });
    
    await lead.save();
    
    return lead.notes;
  }

  /**
   * Add communication record
   */
  async addCommunication(leadId, userId, communicationData) {
    const lead = await Lead.findById(leadId);
    
    if (!lead) {
      throw new AppError('Lead not found', 404, 'LEAD_NOT_FOUND');
    }
    
    if (lead.owner.toString() !== userId) {
      throw new AppError('Only the owner can add communication records', 403, 'FORBIDDEN');
    }
    
    lead.communications.push({
      ...communicationData,
      initiatedBy: userId,
      createdAt: new Date()
    });
    
    // Update status if still new
    if (lead.status === 'new') {
      lead.status = 'contacted';
      lead.contactShared = true;
      lead.contactSharedAt = new Date();
    }
    
    await lead.save();
    
    return lead.communications;
  }

  /**
   * Schedule follow-up
   */
  async scheduleFollowUp(leadId, userId, followUpData) {
    const lead = await Lead.findById(leadId);
    
    if (!lead) {
      throw new AppError('Lead not found', 404, 'LEAD_NOT_FOUND');
    }
    
    if (lead.owner.toString() !== userId) {
      throw new AppError('You do not have permission to schedule follow-ups', 403, 'FORBIDDEN');
    }
    
    lead.followUp = {
      scheduled: true,
      scheduledDate: followUpData.scheduledDate,
      reminder: followUpData.reminder !== false,
      reminderSent: false,
      notes: followUpData.notes
    };
    
    await lead.save();
    
    return lead.followUp;
  }

  /**
   * Complete follow-up
   */
  async completeFollowUp(leadId, userId, notes) {
    const lead = await Lead.findById(leadId);
    
    if (!lead) {
      throw new AppError('Lead not found', 404, 'LEAD_NOT_FOUND');
    }
    
    if (lead.owner.toString() !== userId) {
      throw new AppError('You do not have permission to complete follow-ups', 403, 'FORBIDDEN');
    }
    
    lead.followUp = {
      ...lead.followUp,
      scheduled: false
    };
    
    lead.communications.push({
      type: 'note',
      direction: 'outgoing',
      initiatedBy: userId,
      content: notes || 'Follow-up completed',
      createdAt: new Date()
    });
    
    await lead.save();
    
    return lead;
  }

  /**
   * Schedule site visit
   */
  async scheduleSiteVisit(leadId, userId, visitData) {
    const lead = await Lead.findById(leadId);
    
    if (!lead) {
      throw new AppError('Lead not found', 404, 'LEAD_NOT_FOUND');
    }
    
    if (lead.owner.toString() !== userId) {
      throw new AppError('You do not have permission to schedule site visits', 403, 'FORBIDDEN');
    }
    
    lead.siteVisit = {
      scheduled: true,
      scheduledDate: visitData.scheduledDate,
      completed: false,
      notes: visitData.notes
    };
    
    lead.status = 'site_visit_scheduled';
    lead.statusHistory.push({
      status: 'site_visit_scheduled',
      changedAt: new Date(),
      changedBy: userId,
      notes: visitData.notes
    });
    
    await lead.save();
    
    return lead.siteVisit;
  }

  /**
   * Complete site visit
   */
  async completeSiteVisit(leadId, userId, visitData) {
    const lead = await Lead.findById(leadId);
    
    if (!lead) {
      throw new AppError('Lead not found', 404, 'LEAD_NOT_FOUND');
    }
    
    if (lead.owner.toString() !== userId) {
      throw new AppError('You do not have permission to complete site visits', 403, 'FORBIDDEN');
    }
    
    lead.siteVisit = {
      ...lead.siteVisit,
      completed: true,
      completedAt: new Date(),
      feedback: visitData.feedback,
      rating: visitData.rating
    };
    
    lead.status = 'site_visit_done';
    lead.statusHistory.push({
      status: 'site_visit_done',
      changedAt: new Date(),
      changedBy: userId,
      notes: visitData.feedback
    });
    
    await lead.save();
    
    return lead.siteVisit;
  }

  /**
   * Make an offer
   */
  async makeOffer(leadId, userId, offerData) {
    const lead = await Lead.findById(leadId);
    
    if (!lead) {
      throw new AppError('Lead not found', 404, 'LEAD_NOT_FOUND');
    }
    
    // Both buyer and owner can make offers
    const isOwner = lead.owner.toString() === userId;
    const isBuyer = lead.buyer.toString() === userId;
    
    if (!isOwner && !isBuyer) {
      throw new AppError('You do not have permission to make offers', 403, 'FORBIDDEN');
    }
    
    lead.offer = {
      amount: offerData.amount,
      isNegotiable: offerData.isNegotiable !== false,
      offeredAt: new Date(),
      offeredBy: userId,
      status: 'pending',
      notes: offerData.notes
    };
    
    lead.status = 'offer_made';
    lead.statusHistory.push({
      status: 'offer_made',
      changedAt: new Date(),
      changedBy: userId,
      notes: `Offer of ₹${offerData.amount} made`
    });
    
    await lead.save();
    
    return lead.offer;
  }

  /**
   * Respond to offer
   */
  async respondToOffer(leadId, userId, response) {
    const lead = await Lead.findById(leadId);
    
    if (!lead) {
      throw new AppError('Lead not found', 404, 'LEAD_NOT_FOUND');
    }
    
    // Only the recipient of the offer can respond
    const isOwner = lead.owner.toString() === userId;
    const isBuyer = lead.buyer.toString() === userId;
    const offeredByOwner = lead.offer?.offeredBy?.toString() === lead.owner?.toString();
    
    if ((offeredByOwner && !isBuyer) || (!offeredByOwner && !isOwner)) {
      throw new AppError('You do not have permission to respond to this offer', 403, 'FORBIDDEN');
    }
    
    lead.offer.status = response.status;
    
    if (response.status === 'countered') {
      lead.offer.counterOffer = response.counterOffer;
      lead.offer.notes = response.notes;
    }
    
    if (response.status === 'accepted') {
      lead.status = 'closed_won';
      lead.closedDetails = {
        closedAt: new Date(),
        finalAmount: lead.offer.amount,
        notes: 'Offer accepted'
      };
    }
    
    if (response.status === 'rejected') {
      lead.offer.notes = response.notes;
    }
    
    lead.statusHistory.push({
      status: lead.status,
      changedAt: new Date(),
      changedBy: userId,
      notes: `Offer ${response.status}`
    });
    
    await lead.save();
    
    return lead.offer;
  }

  /**
   * Mark lead as spam
   */
  async markAsSpam(leadId, userId) {
    const lead = await Lead.findById(leadId);
    
    if (!lead) {
      throw new AppError('Lead not found', 404, 'LEAD_NOT_FOUND');
    }
    
    if (lead.owner.toString() !== userId) {
      throw new AppError('Only the owner can mark leads as spam', 403, 'FORBIDDEN');
    }
    
    lead.isSpam = true;
    lead.status = 'spam';
    lead.statusHistory.push({
      status: 'spam',
      changedAt: new Date(),
      changedBy: userId,
      notes: 'Marked as spam by owner'
    });
    
    await lead.save();
    
    return lead;
  }

  /**
   * Unmark lead as spam
   */
  async unmarkAsSpam(leadId, userId) {
    const lead = await Lead.findById(leadId);
    
    if (!lead) {
      throw new AppError('Lead not found', 404, 'LEAD_NOT_FOUND');
    }
    
    if (lead.owner.toString() !== userId) {
      throw new AppError('Only the owner can unmark leads as spam', 403, 'FORBIDDEN');
    }
    
    lead.isSpam = false;
    lead.status = 'viewed';
    lead.statusHistory.push({
      status: 'viewed',
      changedAt: new Date(),
      changedBy: userId,
      notes: 'Unmarked as spam by owner'
    });
    
    await lead.save();
    
    return lead;
  }

  /**
   * Get lead statistics for admin dashboard
   */
  async getAdminLeadStats() {
    const totalLeads = await Lead.countDocuments();
    
    const leadsByStatus = await Lead.aggregate([
      { $group: {
        _id: '$status',
        count: { $sum: 1 }
      }}
    ]);
    
    const leadsByDay = await Lead.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);
    
    const spamLeads = await Lead.countDocuments({ isSpam: true });
    
    const conversionRate = totalLeads > 0 
      ? ((await Lead.countDocuments({ status: 'closed_won' })) / totalLeads * 100).toFixed(2)
      : 0;
    
    return {
      totalLeads,
      spamLeads,
      spamPercentage: totalLeads > 0 ? ((spamLeads / totalLeads) * 100).toFixed(2) : 0,
      conversionRate,
      leadsByStatus,
      leadsByDay
    };
  }

  /**
   * Delete lead (admin only)
   */
  async deleteLead(leadId) {
    const lead = await Lead.findById(leadId);
    
    if (!lead) {
      throw new AppError('Lead not found', 404, 'LEAD_NOT_FOUND');
    }
    
    await Lead.findByIdAndDelete(leadId);
    
    return true;
  }

  /**
   * Export leads (for owner)
   */
  async exportLeads(userId, format = 'csv', filters = {}) {
    const query = { owner: userId };
    
    if (filters.status) {
      query.status = filters.status;
    }
    
    if (filters.dateFrom) {
      query.createdAt = { $gte: new Date(filters.dateFrom) };
    }
    
    if (filters.dateTo) {
      query.createdAt = { ...query.createdAt, $lte: new Date(filters.dateTo) };
    }
    
    const leads = await Lead.find(query)
      .populate('property', 'title propertyCode')
      .populate('buyer', 'name email phone')
      .sort({ createdAt: -1 });
    
    // Format for export
    const exportData = leads.map(lead => ({
      'Lead ID': lead._id,
      'Date': lead.createdAt.toISOString().split('T')[0],
      'Property': lead.propertySnapshot?.title || lead.property?.title || 'N/A',
      'Property Code': lead.property?.propertyCode || 'N/A',
      'Buyer Name': lead.buyerSnapshot?.name || lead.buyer?.name || 'N/A',
      'Buyer Email': lead.buyerSnapshot?.email || lead.buyer?.email || 'N/A',
      'Buyer Phone': lead.buyerSnapshot?.phone || lead.buyer?.phone || 'N/A',
      'Message': lead.message || 'N/A',
      'Status': lead.status,
      'Contact Shared': lead.contactShared ? 'Yes' : 'No'
    }));
    
    return exportData;
  }
}

module.exports = new LeadService();