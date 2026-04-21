const User = require('./user.model');
const { AppError } = require('../../middlewares/errorHandler');
const logger = require('../../utils/logger');
const crypto = require('crypto');

class UserService {
  
  async getUserById(userId, populateFields = []) {
    let query = User.findById(userId).select('-password -resetPasswordToken -resetPasswordExpire -emailVerificationToken -phoneOtp');
    
    if (populateFields.length > 0) {
      populateFields.forEach(field => {
        query = query.populate(field);
      });
    }
    
    const user = await query;
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    return user;
  }

  async getUserByEmail(email, includePassword = false) {
    let query = User.findOne({ email: email.toLowerCase() });
    if (includePassword) query = query.select('+password');
    return await query;
  }

  async getUserByPhone(phone, includePassword = false) {
    let query = User.findOne({ phone });
    if (includePassword) query = query.select('+password');
    return await query;
  }

  async updateProfile(userId, updateData) {
    const allowedFields = ['name', 'alternatePhone', 'address', 'preferences', 'companyDetails', 'reraDetails'];
    
    const filteredData = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredData[key] = updateData[key];
      }
    });
    
    if (filteredData.address) {
      const user = await User.findById(userId);
      filteredData.address = { ...user.address?.toObject(), ...filteredData.address };
    }
    
    if (filteredData.preferences) {
      const user = await User.findById(userId);
      filteredData.preferences = {
        ...user.preferences?.toObject(),
        ...filteredData.preferences,
        notificationPreferences: {
          ...user.preferences?.notificationPreferences?.toObject(),
          ...filteredData.preferences?.notificationPreferences
        }
      };
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: filteredData },
      { new: true, runValidators: true }
    ).select('-password');
    
    return user;
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+password');
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    const isPasswordCorrect = await user.comparePassword(currentPassword);
    if (!isPasswordCorrect) {
      throw new AppError('Current password is incorrect', 401, 'INVALID_PASSWORD');
    }
    
    user.password = newPassword;
    await user.save();
    
    return true;
  }

  async updateProfilePicture(userId, imageUrl) {
    const user = await User.findByIdAndUpdate(
      userId,
      { profilePicture: imageUrl },
      { new: true }
    ).select('-password');
    
    return user;
  }

  async saveProperty(userId, propertyId) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    const alreadySaved = user.savedProperties.includes(propertyId);
    
    if (!alreadySaved) {
      user.savedProperties.push(propertyId);
      await user.save();
      
      try {
        const Property = require('../properties/property.model');
        await Property.findByIdAndUpdate(propertyId, { $inc: { favorites: 1 } });
      } catch (e) {
        logger.warn('Failed to update property favorites count');
      }
    }
    
    return user.savedProperties;
  }

  async removeSavedProperty(userId, propertyId) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    user.savedProperties = user.savedProperties.filter(
      id => id.toString() !== propertyId.toString()
    );
    await user.save();
    
    try {
      const Property = require('../properties/property.model');
      await Property.findByIdAndUpdate(propertyId, { $inc: { favorites: -1 } });
    } catch (e) {
      logger.warn('Failed to update property favorites count');
    }
    
    return user.savedProperties;
  }

  async getSavedProperties(userId, page = 1, limit = 20) {
    const user = await User.findById(userId).populate({
      path: 'savedProperties',
      match: { status: 'active' },
      options: {
        sort: { createdAt: -1 },
        skip: (page - 1) * limit,
        limit: limit
      }
    });
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    const total = await User.aggregate([
      { $match: { _id: user._id } },
      { $project: { count: { $size: '$savedProperties' } } }
    ]);
    
    return {
      properties: user.savedProperties || [],
      total: total[0]?.count || 0,
      page,
      limit,
      totalPages: Math.ceil((total[0]?.count || 0) / limit)
    };
  }

  async trackPropertyView(userId, propertyId) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    user.recentViews = user.recentViews.filter(
      view => view.property.toString() !== propertyId.toString()
    );
    
    user.recentViews.unshift({
      property: propertyId,
      viewedAt: new Date()
    });
    
    user.recentViews = user.recentViews.slice(0, 50);
    await user.save();
    
    return user.recentViews;
  }

  async getRecentViews(userId, page = 1, limit = 20) {
    const user = await User.findById(userId).populate({
      path: 'recentViews.property',
      match: { status: 'active' },
      options: { limit: limit, skip: (page - 1) * limit }
    });
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    return {
      views: user.recentViews.filter(v => v.property !== null),
      total: user.recentViews.length,
      page,
      limit
    };
  }

  async updatePreferences(userId, preferences) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    user.preferences = {
      ...user.preferences?.toObject(),
      ...preferences,
      notificationPreferences: {
        ...user.preferences?.notificationPreferences?.toObject(),
        ...preferences.notificationPreferences
      }
    };
    
    await user.save();
    return user.preferences;
  }

  async saveSearch(userId, searchName, filters) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    if (user.savedSearches.length >= 20) {
      user.savedSearches.pop();
    }
    
    user.savedSearches.unshift({
      name: searchName,
      filters: filters,
      createdAt: new Date()
    });
    
    await user.save();
    return user.savedSearches;
  }

  async getSavedSearches(userId) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    return user.savedSearches || [];
  }

  async deleteSavedSearch(userId, searchId) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    user.savedSearches = user.savedSearches.filter(
      s => s._id.toString() !== searchId
    );
    
    await user.save();
    return user.savedSearches;
  }

  async addDeviceToken(userId, token) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    if (!user.deviceTokens.includes(token)) {
      user.deviceTokens.push(token);
      await user.save();
    }
    
    return user.deviceTokens;
  }

  async removeDeviceToken(userId, token) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    user.deviceTokens = user.deviceTokens.filter(t => t !== token);
    await user.save();
    
    return user.deviceTokens;
  }

  async getUserStats(userId) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    
  const Property = require('../properties/property.model');
    const Lead = require('../leads/lead.model');
    
    const [propertyStats, leadStats] = await Promise.all([
      Property.aggregate([
        { $match: { owner: user._id } },
        { $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          sold: { $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] } },
          rented: { $sum: { $cond: [{ $eq: ['$status', 'rented'] }, 1, 0] } },
          totalViews: { $sum: '$views' },
          totalLeads: { $sum: '$leads' }
        }}
      ]),
      Lead.aggregate([
        { $match: { 
          $or: [
            { owner: user._id },
            { buyer: user._id }
          ]
        }},
        { $group: {
          _id: null,
          received: { $sum: { $cond: [{ $eq: ['$owner', user._id] }, 1, 0] } },
          sent: { $sum: { $cond: [{ $eq: ['$buyer', user._id] }, 1, 0] } },
          closed: { $sum: { $cond: [{ $eq: ['$status', 'closed_won'] }, 1, 0] } }
        }}
      ])
    ]);
    
    return {
      properties: propertyStats[0] || { total: 0, active: 0, sold: 0, rented: 0, totalViews: 0, totalLeads: 0 },
      leads: leadStats[0] || { received: 0, sent: 0, closed: 0 },
      savedProperties: user.savedProperties.length,
      savedSearches: user.savedSearches.length
    };
  }

  async verifyEmail(userId, token) {
    const user = await User.findById(userId).select('+emailVerificationToken +emailVerificationExpire');
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    if (user.emailVerified) {
      throw new AppError('Email already verified', 400, 'ALREADY_VERIFIED');
    }
    
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    if (user.emailVerificationToken !== hashedToken) {
      throw new AppError('Invalid verification token', 400, 'INVALID_TOKEN');
    }
    
    if (user.emailVerificationExpire < Date.now()) {
      throw new AppError('Verification token expired', 400, 'TOKEN_EXPIRED');
    }
    
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    
    if (user.phoneVerified) {
      user.isVerified = true;
    }
    
    await user.save();
    return true;
  }

  async verifyPhone(userId, otp) {
    const user = await User.findById(userId).select('+phoneOtp +phoneOtpExpire');
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    if (user.phoneVerified) {
      throw new AppError('Phone already verified', 400, 'ALREADY_VERIFIED');
    }
    
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    
    if (user.phoneOtp !== hashedOtp) {
      throw new AppError('Invalid OTP', 400, 'INVALID_OTP');
    }
    
    if (user.phoneOtpExpire < Date.now()) {
      throw new AppError('OTP expired', 400, 'OTP_EXPIRED');
    }
    
    user.phoneVerified = true;
    user.phoneOtp = undefined;
    user.phoneOtpExpire = undefined;
    
    if (user.emailVerified) {
      user.isVerified = true;
    }
    
    await user.save();
    return true;
  }

  async submitVerificationDocuments(userId, documents) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    documents.forEach(doc => {
      user.verificationDocuments.push({
        type: doc.type,
        documentUrl: doc.url,
        uploadedAt: new Date(),
        verified: false
      });
    });
    
    await user.save();
    return user.verificationDocuments;
  }

  async deactivateAccount(userId, reason) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    user.isActive = false;
    user.deactivationReason = reason;
    user.deactivatedAt = new Date();
    
    await user.save();
    return true;
  }

  async searchUsers(filters = {}, page = 1, limit = 20) {
    const query = {};
    
    if (filters.role) query.role = filters.role;
    if (filters.isVerified !== undefined) query.isVerified = filters.isVerified;
    if (filters.isActive !== undefined) query.isActive = filters.isActive;
    
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } },
        { phone: { $regex: filters.search, $options: 'i' } }
      ];
    }
    
    if (filters.city) {
      query['address.city'] = { $regex: filters.city, $options: 'i' };
    }
    
    const [users, total] = await Promise.all([
      User.find(query).select('-password').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(query)
    ]);
    
    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}

// ✅ CRITICAL: Export as singleton instance
module.exports = new UserService();