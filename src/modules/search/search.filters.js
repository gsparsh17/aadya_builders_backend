/**
 * Search Filters Builder - Builds MongoDB queries from search parameters
 */

class SearchFiltersBuilder {
  
  /**
   * Build MongoDB query from search parameters
   */
  buildQuery(params) {
    const query = { status: 'active' };
    
    // Purpose filter
    if (params.purpose) {
      query.purpose = params.purpose;
    }
    
    // Property type filter (supports comma-separated values)
    if (params.propertyType) {
      const types = params.propertyType.split(',').map(t => t.trim());
      query.propertyType = { $in: types };
    }
    
    // Category filter
    if (params.category) {
      query.category = params.category;
    }
    
    // City filter (case-insensitive)
    if (params.city) {
      query['location.city'] = { $regex: params.city, $options: 'i' };
    }
    
    // Multiple cities
    if (params.cities) {
      const cities = params.cities.split(',').map(c => c.trim());
      query['location.city'] = { $in: cities.map(c => new RegExp(c, 'i')) };
    }
    
    // Locality filter
    if (params.locality) {
      const localities = params.locality.split(',').map(l => l.trim());
      query['location.locality'] = { $in: localities.map(l => new RegExp(l, 'i')) };
    }
    
    // State filter
    if (params.state) {
      query['location.state'] = { $regex: params.state, $options: 'i' };
    }
    
    // Price range
    if (params.minPrice || params.maxPrice) {
      query.price = {};
      if (params.minPrice) query.price.$gte = parseFloat(params.minPrice);
      if (params.maxPrice) query.price.$lte = parseFloat(params.maxPrice);
    }
    
    // Price per sqft range
    if (params.minPricePerSqft || params.maxPricePerSqft) {
      query.pricePerSqft = {};
      if (params.minPricePerSqft) query.pricePerSqft.$gte = parseFloat(params.minPricePerSqft);
      if (params.maxPricePerSqft) query.pricePerSqft.$lte = parseFloat(params.maxPricePerSqft);
    }
    
    // Area range
    if (params.minArea || params.maxArea) {
      query['area.value'] = {};
      if (params.minArea) query['area.value'].$gte = parseFloat(params.minArea);
      if (params.maxArea) query['area.value'].$lte = parseFloat(params.maxArea);
    }
    
    // Bedrooms (BHK)
    if (params.bhk) {
      const bhkValues = this.parseBhkValues(params.bhk);
      
      if (bhkValues.length === 1) {
        query.bedrooms = bhkValues[0];
      } else {
        query.bedrooms = { $in: bhkValues };
      }
    }
    
    // Bathrooms
    if (params.bathrooms) {
      const bathValues = params.bathrooms.split(',').map(b => parseInt(b));
      query.bathrooms = bathValues.length === 1 ? bathValues[0] : { $in: bathValues };
    }
    
    // Furnishing status
    if (params.furnishing) {
      const furnishingValues = params.furnishing.split(',').map(f => f.trim());
      query.furnishing = furnishingValues.length === 1 ? furnishingValues[0] : { $in: furnishingValues };
    }
    
    // Construction status
    if (params.constructionStatus) {
      query.constructionStatus = params.constructionStatus;
    }
    
    // Possession status
    if (params.possessionStatus) {
      query.possessionStatus = params.possessionStatus;
    }
    
    // Age of property
    if (params.maxAge) {
      query.ageOfProperty = { $lte: parseInt(params.maxAge) };
    }
    
    // Floor preference
    if (params.floorNumber) {
      query.floorNumber = parseInt(params.floorNumber);
    }
    
    if (params.minFloor) {
      query.floorNumber = { ...query.floorNumber, $gte: parseInt(params.minFloor) };
    }
    
    if (params.maxFloor) {
      query.floorNumber = { ...query.floorNumber, $lte: parseInt(params.maxFloor) };
    }
    
    // Amenities filter (must have all specified amenities)
    if (params.amenities) {
      const amenities = params.amenities.split(',').map(a => a.trim());
      query.amenities = { $all: amenities };
    }
    
    // Posted by filter
    if (params.postedBy) {
      query.ownerType = params.postedBy;
    }
    
    // Owner type filter
    if (params.ownerType) {
      query.ownerType = params.ownerType;
    }
    
    // Verification filter
    if (params.verified === 'true') {
      query.isVerified = true;
    }
    
    // Featured filter
    if (params.featured === 'true') {
      query.isFeatured = true;
      query.featuredUntil = { $gt: new Date() };
    }
    
    // Premium filter
    if (params.premium === 'true') {
      query.isPremium = true;
    }
    
    // RERA approved
    if (params.reraApproved === 'true') {
      query['reraDetails.reraId'] = { $exists: true, $ne: null, $ne: '' };
    }
    
    // Availability date
    if (params.availableFrom) {
      query.availableFrom = { $lte: new Date(params.availableFrom) };
    }
    
    // Listing date range
    if (params.postedAfter) {
      query.createdAt = { $gte: new Date(params.postedAfter) };
    }
    
    if (params.postedBefore) {
      query.createdAt = { ...query.createdAt, $lte: new Date(params.postedBefore) };
    }
    
    // Text search (title, description, locality)
    if (params.q || params.query || params.search) {
      const searchTerm = params.q || params.query || params.search;
      query.$or = [
        { title: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { 'location.locality': { $regex: searchTerm, $options: 'i' } },
        { 'location.city': { $regex: searchTerm, $options: 'i' } },
        { propertyCode: { $regex: searchTerm, $options: 'i' } }
      ];
    }
    
    // Geospatial search
    if (params.latitude && params.longitude) {
      const radius = parseFloat(params.radius) || 5; // Default 5km
      query['location.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(params.longitude), parseFloat(params.latitude)]
          },
          $maxDistance: radius * 1000 // Convert km to meters
        }
      };
    }
    
    // Project association
    if (params.projectId) {
      query.project = params.projectId;
    }
    
    // Exclude specific properties
    if (params.excludeIds) {
      const excludeIds = params.excludeIds.split(',').map(id => id.trim());
      query._id = { $nin: excludeIds };
    }
    
    return query;
  }

  /**
   * Parse BHK values (handles '1', '2', '3', '4+', etc.)
   */
  parseBhkValues(bhkParam) {
    const values = bhkParam.split(',').map(v => v.trim());
    const result = [];
    
    values.forEach(v => {
      if (v === '4+' || v === '5+') {
        const minValue = parseInt(v);
        for (let i = minValue; i <= 10; i++) {
          result.push(i);
        }
      } else if (v.includes('-')) {
        const [min, max] = v.split('-').map(n => parseInt(n));
        for (let i = min; i <= max; i++) {
          result.push(i);
        }
      } else {
        result.push(parseInt(v));
      }
    });
    
    return [...new Set(result)]; // Remove duplicates
  }

  /**
   * Build sort options
   */
  buildSortOptions(sortParam) {
    const sortOptions = {};
    
    switch (sortParam) {
      case 'price_asc':
        sortOptions.price = 1;
        break;
      case 'price_desc':
        sortOptions.price = -1;
        break;
      case 'area_asc':
        sortOptions['area.value'] = 1;
        break;
      case 'area_desc':
        sortOptions['area.value'] = -1;
        break;
      case 'newest':
        sortOptions.createdAt = -1;
        break;
      case 'oldest':
        sortOptions.createdAt = 1;
        break;
      case 'views_desc':
        sortOptions.views = -1;
        break;
      case 'popularity':
        sortOptions.leads = -1;
        break;
      case 'price_per_sqft_asc':
        sortOptions.pricePerSqft = 1;
        break;
      case 'price_per_sqft_desc':
        sortOptions.pricePerSqft = -1;
        break;
      case 'relevance':
      default:
        sortOptions.rankingScore = -1;
        sortOptions.createdAt = -1;
        break;
    }
    
    return sortOptions;
  }

  /**
   * Build aggregation pipeline for advanced search
   */
  buildAggregationPipeline(params, page = 1, limit = 20) {
    const pipeline = [];
    
    // Match stage
    const matchQuery = this.buildQuery(params);
    pipeline.push({ $match: matchQuery });
    
    // Lookup owner details
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'owner',
        foreignField: '_id',
        as: 'owner'
      }
    });
    pipeline.push({ $unwind: { path: '$owner', preserveNullAndEmptyArrays: true } });
    
    // Lookup project details (for builder properties)
    pipeline.push({
      $lookup: {
        from: 'projects',
        localField: 'project',
        foreignField: '_id',
        as: 'project'
      }
    });
    pipeline.push({ $unwind: { path: '$project', preserveNullAndEmptyArrays: true } });
    
    // Add computed fields
    pipeline.push({
      $addFields: {
        pricePerSqftCalculated: {
          $cond: [
            { $and: [{ $gt: ['$price', 0] }, { $gt: ['$area.value', 0] }] },
            { $divide: ['$price', '$area.value'] },
            0
          ]
        }
      }
    });
    
    // Filter by computed price per sqft if specified
    if (params.minPricePerSqft || params.maxPricePerSqft) {
      const pricePerSqftFilter = {};
      if (params.minPricePerSqft) pricePerSqftFilter.$gte = parseFloat(params.minPricePerSqft);
      if (params.maxPricePerSqft) pricePerSqftFilter.$lte = parseFloat(params.maxPricePerSqft);
      pipeline.push({ $match: { pricePerSqftCalculated: pricePerSqftFilter } });
    }
    
    // Sort stage
    const sortOptions = this.buildSortOptions(params.sort);
    pipeline.push({ $sort: sortOptions });
    
    // Pagination
    pipeline.push({ $skip: (page - 1) * limit });
    pipeline.push({ $limit: limit });
    
    // Project stage (select fields to return)
    pipeline.push({
      $project: {
        title: 1,
        description: 1,
        propertyCode: 1,
        purpose: 1,
        propertyType: 1,
        category: 1,
        price: 1,
        pricePerSqft: 1,
        area: 1,
        bedrooms: 1,
        bathrooms: 1,
        furnishing: 1,
        location: 1,
        amenities: 1,
        images: 1,
        status: 1,
        isVerified: 1,
        isFeatured: 1,
        isPremium: 1,
        views: 1,
        leads: 1,
        rankingScore: 1,
        createdAt: 1,
        'owner._id': 1,
        'owner.name': 1,
        'owner.profilePicture': 1,
        'owner.role': 1,
        'owner.isVerified': 1,
        'owner.companyDetails': 1,
        'project._id': 1,
        'project.name': 1,
        'project.builder': 1,
        primaryImage: { $arrayElemAt: ['$images.url', 0] }
      }
    });
    
    return pipeline;
  }

  /**
   * Build aggregation pipeline for price trends
   */
  buildPriceTrendsPipeline(params) {
    const pipeline = [];
    
    // Match stage
    const matchQuery = { status: 'active' };
    
    if (params.city) {
      matchQuery['location.city'] = { $regex: params.city, $options: 'i' };
    }
    
    if (params.locality) {
      matchQuery['location.locality'] = { $regex: params.locality, $options: 'i' };
    }
    
    if (params.purpose) {
      matchQuery.purpose = params.purpose;
    }
    
    if (params.propertyType) {
      matchQuery.propertyType = params.propertyType;
    }
    
    // Date range (last 12 months)
    if (params.months) {
      const monthsAgo = new Date();
      monthsAgo.setMonth(monthsAgo.getMonth() - parseInt(params.months));
      matchQuery.createdAt = { $gte: monthsAgo };
    }
    
    pipeline.push({ $match: matchQuery });
    
    // Group by month
    pipeline.push({
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        avgPrice: { $avg: '$price' },
        avgPricePerSqft: { $avg: '$pricePerSqft' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
        count: { $sum: 1 }
      }
    });
    
    // Sort by date
    pipeline.push({
      $sort: {
        '_id.year': 1,
        '_id.month': 1
      }
    });
    
    return pipeline;
  }

  /**
   * Build aggregation pipeline for locality analytics
   */
  buildLocalityAnalyticsPipeline(city, locality) {
    const pipeline = [];
    
    const matchQuery = {
      status: 'active',
      'location.city': { $regex: city, $options: 'i' }
    };
    
    if (locality) {
      matchQuery['location.locality'] = { $regex: locality, $options: 'i' };
    }
    
    pipeline.push({ $match: matchQuery });
    
    // Group by purpose and property type
    pipeline.push({
      $group: {
        _id: {
          purpose: '$purpose',
          propertyType: '$propertyType'
        },
        avgPrice: { $avg: '$price' },
        avgPricePerSqft: { $avg: '$pricePerSqft' },
        avgArea: { $avg: '$area.value' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
        totalListings: { $sum: 1 },
        avgBedrooms: { $avg: '$bedrooms' }
      }
    });
    
    // Sort by total listings
    pipeline.push({ $sort: { totalListings: -1 } });
    
    return pipeline;
  }
}

module.exports = new SearchFiltersBuilder();