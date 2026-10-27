const LocalityReview = require('./review.model');
const { successResponse } = require('../../utils/responseHandler');

const key = (v) => String(v || '').trim().toLowerCase();

class ReviewController {
  /**
   * Rating summary and latest reviews for a locality
   * @route GET /api/v1/reviews/locality?city=&locality=&limit=
   */
  async getLocality(req, res, next) {
    try {
      const match = { cityKey: key(req.query.city), localityKey: key(req.query.locality), status: 'published' };
      const limit = Math.min(parseInt(req.query.limit) || 10, 50);

      const [stats] = await LocalityReview.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            rating: { $avg: '$rating' },
            connectivity: { $avg: '$aspects.connectivity' },
            safety: { $avg: '$aspects.safety' },
            amenities: { $avg: '$aspects.amenities' },
            cleanliness: { $avg: '$aspects.cleanliness' },
            r5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
            r4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
            r3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
            r2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
            r1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
          },
        },
      ]);

      const reviews = await LocalityReview.find(match)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('user', 'name profilePicture');

      const round = (n) => (n == null ? null : Math.round(n * 10) / 10);
      let mine = null;
      if (req.user) {
        mine = await LocalityReview.findOne({ cityKey: match.cityKey, localityKey: match.localityKey, user: req.user.id });
      }

      return successResponse(res, {
        summary: {
          count: stats?.count || 0,
          rating: round(stats?.rating),
          aspects: {
            connectivity: round(stats?.connectivity),
            safety: round(stats?.safety),
            amenities: round(stats?.amenities),
            cleanliness: round(stats?.cleanliness),
          },
          distribution: stats ? { 5: stats.r5, 4: stats.r4, 3: stats.r3, 2: stats.r2, 1: stats.r1 } : {},
        },
        reviews,
        mine,
      }, 'Locality reviews retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create or update the current user's review of a locality
   * @route POST /api/v1/reviews/locality
   */
  async upsertLocality(req, res, next) {
    try {
      const { city, locality, rating, aspects, likes, dislikes, relation } = req.body;
      const review = await LocalityReview.findOneAndUpdate(
        { cityKey: key(city), localityKey: key(locality), user: req.user.id },
        {
          city: city.trim(),
          locality: locality.trim(),
          cityKey: key(city),
          localityKey: key(locality),
          rating,
          aspects: aspects || {},
          likes,
          dislikes,
          relation,
          status: 'published',
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
      );
      return successResponse(res, review, 'Thanks for reviewing your locality', 201);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReviewController();
