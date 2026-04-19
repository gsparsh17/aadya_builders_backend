const leadService = require('./lead.service');
const { successResponse, paginatedResponse, errorResponse } = require('../../utils/responseHandler');
const { AppError } = require('../../middlewares/errorHandler');
const logger = require('../../utils/logger');
const { validationResult } = require('express-validator');

/**
 * Lead Controller - Handles HTTP requests for lead operations
 */
class LeadController {
  
  /**
   * Create a new lead (contact owner)
   * @route POST /api/v1/leads
   */
  async createLead(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors.array());
      }
      
      const { propertyId, message, contactPreference, preferredTimeToContact } = req.body;
      
      const lead = await leadService.createLead(propertyId, req.user.id, {
        message,
        contactPreference,
        preferredTimeToContact
      });
      
      return successResponse(res, lead, 'Your inquiry has been sent successfully. The owner will contact you soon.', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get lead by ID
   * @route GET /api/v1/leads/:id
   */
  async getLeadById(req, res, next) {
    try {
      const { id } = req.params;
      
      const lead = await leadService.getLeadById(id, req.user.id, req.user.role);
      
      return successResponse(res, lead, 'Lead retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get leads for current user (as owner)
   * @route GET /api/v1/leads
   */
  async getMyLeads(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filters = {
        status: req.query.status,
        propertyId: req.query.propertyId,
        isSpam: req.query.isSpam,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo
      };
      
      const result = await leadService.getOwnerLeads(req.user.id, filters, page, limit);
      
      return paginatedResponse(res, result.leads, page, limit, result.total, 'Leads retrieved successfully', {
        stats: result.stats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get leads for current user (as buyer)
   * @route GET /api/v1/leads/buyer
   */
  async getBuyerLeads(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      
      const result = await leadService.getBuyerLeads(req.user.id, page, limit);
      
      return paginatedResponse(res, result.leads, page, limit, result.total, 'Your inquiries retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get leads for a specific property
   * @route GET /api/v1/leads/property/:propertyId
   */
  async getLeadsByProperty(req, res, next) {
    try {
      const { propertyId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filters = {
        status: req.query.status,
        isSpam: req.query.isSpam
      };
      
      const result = await leadService.getLeadsByProperty(propertyId, req.user.id, filters, page, limit);
      
      return paginatedResponse(res, result.leads, page, limit, result.total, 'Property leads retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get lead statistics
   * @route GET /api/v1/leads/stats
   */
  async getLeadStats(req, res, next) {
    try {
      const filters = {
        propertyId: req.query.propertyId,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo
      };
      
      const stats = await leadService.getOwnerLeadStats(req.user.id, filters);
      
      return successResponse(res, stats, 'Lead statistics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update lead status
   * @route PATCH /api/v1/leads/:id/status
   */
  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      
      if (!status) {
        throw new AppError('Status is required', 400, 'STATUS_REQUIRED');
      }
      
      const lead = await leadService.updateLeadStatus(id, req.user.id, status, notes);
      
      return successResponse(res, lead, `Lead status updated to ${status}`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add note to lead
   * @route POST /api/v1/leads/:id/notes
   */
  async addNote(req, res, next) {
    try {
      const { id } = req.params;
      const { text, isPrivate } = req.body;
      
      if (!text) {
        throw new AppError('Note text is required', 400, 'NOTE_REQUIRED');
      }
      
      const notes = await leadService.addLeadNote(id, req.user.id, text, isPrivate);
      
      return successResponse(res, notes, 'Note added successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add communication record
   * @route POST /api/v1/leads/:id/communications
   */
  async addCommunication(req, res, next) {
    try {
      const { id } = req.params;
      const { type, direction, content, duration, outcome } = req.body;
      
      if (!type || !direction) {
        throw new AppError('Communication type and direction are required', 400, 'INVALID_COMMUNICATION');
      }
      
      const communications = await leadService.addCommunication(id, req.user.id, {
        type,
        direction,
        content,
        duration,
        outcome
      });
      
      return successResponse(res, communications, 'Communication added successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Schedule follow-up
   * @route POST /api/v1/leads/:id/follow-up
   */
  async scheduleFollowUp(req, res, next) {
    try {
      const { id } = req.params;
      const { scheduledDate, reminder, notes } = req.body;
      
      if (!scheduledDate) {
        throw new AppError('Scheduled date is required', 400, 'SCHEDULED_DATE_REQUIRED');
      }
      
      const followUp = await leadService.scheduleFollowUp(id, req.user.id, {
        scheduledDate: new Date(scheduledDate),
        reminder,
        notes
      });
      
      return successResponse(res, followUp, 'Follow-up scheduled successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Complete follow-up
   * @route PATCH /api/v1/leads/:id/follow-up/complete
   */
  async completeFollowUp(req, res, next) {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      
      const followUp = await leadService.completeFollowUp(id, req.user.id, notes);
      
      return successResponse(res, followUp, 'Follow-up completed successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Schedule site visit
   * @route POST /api/v1/leads/:id/site-visit
   */
  async scheduleSiteVisit(req, res, next) {
    try {
      const { id } = req.params;
      const { scheduledDate, notes } = req.body;
      
      if (!scheduledDate) {
        throw new AppError('Scheduled date is required', 400, 'SCHEDULED_DATE_REQUIRED');
      }
      
      const siteVisit = await leadService.scheduleSiteVisit(id, req.user.id, {
        scheduledDate: new Date(scheduledDate),
        notes
      });
      
      return successResponse(res, siteVisit, 'Site visit scheduled successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Complete site visit
   * @route PATCH /api/v1/leads/:id/site-visit/complete
   */
  async completeSiteVisit(req, res, next) {
    try {
      const { id } = req.params;
      const { feedback, rating } = req.body;
      
      const siteVisit = await leadService.completeSiteVisit(id, req.user.id, {
        feedback,
        rating
      });
      
      return successResponse(res, siteVisit, 'Site visit completed successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Make an offer
   * @route POST /api/v1/leads/:id/offer
   */
  async makeOffer(req, res, next) {
    try {
      const { id } = req.params;
      const { amount, isNegotiable, notes } = req.body;
      
      if (!amount || amount <= 0) {
        throw new AppError('Valid offer amount is required', 400, 'INVALID_AMOUNT');
      }
      
      const offer = await leadService.makeOffer(id, req.user.id, {
        amount,
        isNegotiable,
        notes
      });
      
      return successResponse(res, offer, 'Offer made successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Respond to offer
   * @route PATCH /api/v1/leads/:id/offer/respond
   */
  async respondToOffer(req, res, next) {
    try {
      const { id } = req.params;
      const { status, counterOffer, notes } = req.body;
      
      if (!status || !['accepted', 'rejected', 'countered'].includes(status)) {
        throw new AppError('Valid status (accepted, rejected, or countered) is required', 400, 'INVALID_STATUS');
      }
      
      if (status === 'countered' && (!counterOffer || counterOffer <= 0)) {
        throw new AppError('Counter offer amount is required', 400, 'COUNTER_OFFER_REQUIRED');
      }
      
      const offer = await leadService.respondToOffer(id, req.user.id, {
        status,
        counterOffer,
        notes
      });
      
      return successResponse(res, offer, `Offer ${status} successfully`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark lead as spam
   * @route PATCH /api/v1/leads/:id/spam
   */
  async markAsSpam(req, res, next) {
    try {
      const { id } = req.params;
      
      const lead = await leadService.markAsSpam(id, req.user.id);
      
      return successResponse(res, lead, 'Lead marked as spam');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Unmark lead as spam
   * @route PATCH /api/v1/leads/:id/unspam
   */
  async unmarkAsSpam(req, res, next) {
    try {
      const { id } = req.params;
      
      const lead = await leadService.unmarkAsSpam(id, req.user.id);
      
      return successResponse(res, lead, 'Lead unmarked as spam');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export leads
   * @route GET /api/v1/leads/export
   */
  async exportLeads(req, res, next) {
    try {
      const { format = 'csv', status, dateFrom, dateTo } = req.query;
      
      const exportData = await leadService.exportLeads(req.user.id, format, {
        status,
        dateFrom,
        dateTo
      });
      
      if (format === 'csv') {
        // Convert to CSV
        const createCsvWriter = require('csv-writer').createObjectCsvStringifier;
        const csvWriter = createCsvWriter({
          header: Object.keys(exportData[0] || {}).map(key => ({ id: key, title: key }))
        });
        
        const csvString = csvWriter.getHeaderString() + csvWriter.stringifyRecords(exportData);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
        return res.send(csvString);
      }
      
      return successResponse(res, exportData, 'Leads exported successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==================== Admin Controllers ====================

  /**
   * Admin: Get all leads
   * @route GET /api/v1/leads/admin/all
   */
  async adminGetAllLeads(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      
      const Lead = require('./lead.model');
      
      const query = {};
      if (req.query.status) query.status = req.query.status;
      if (req.query.isSpam !== undefined) query.isSpam = req.query.isSpam === 'true';
      
      const [leads, total] = await Promise.all([
        Lead.find(query)
          .populate('property', 'title propertyCode')
          .populate('buyer', 'name email')
          .populate('owner', 'name email')
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        Lead.countDocuments(query)
      ]);
      
      return paginatedResponse(res, leads, page, limit, total, 'All leads retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Get lead statistics
   * @route GET /api/v1/leads/admin/stats
   */
  async adminGetLeadStats(req, res, next) {
    try {
      const stats = await leadService.getAdminLeadStats();
      
      return successResponse(res, stats, 'Lead statistics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Delete lead
   * @route DELETE /api/v1/leads/admin/:id
   */
  async adminDeleteLead(req, res, next) {
    try {
      const { id } = req.params;
      
      await leadService.deleteLead(id);
      
      return successResponse(res, null, 'Lead deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new LeadController();