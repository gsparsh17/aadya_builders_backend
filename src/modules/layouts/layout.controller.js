const Layout = require('./layout.model');
const Plot = require('./plot.model');
const Project = require('../projects/project.model');
const { validationResult } = require('express-validator');
const { uploadToCloudinary } = require('../../config/cloudinary');

exports.getLayoutsForProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const layouts = await Layout.find({ projectId });
    res.status(200).json({ success: true, data: layouts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.getLayoutDetails = async (req, res) => {
  try {
    const { layoutId } = req.params;
    const layout = await Layout.findById(layoutId);
    if (!layout) return res.status(404).json({ success: false, message: 'Layout not found' });
    
    // Fetch all plots associated with this layout
    const plots = await Plot.find({ layoutId });
    res.status(200).json({ success: true, data: { layout, plots } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Internal helper for socket emission
const emitPlotUpdate = (req, plotId, status, lockedBy) => {
  const io = req.app.get('io');
  if (io) {
    io.emit('plotStatusChanged', {
      plotId,
      status,
      lockedBy
    });
  }
};

exports.lockPlot = async (req, res) => {
  try {
    const { plotId } = req.params;
    const userId = req.user.id; // Assumes auth middleware
    
    // Check if plot is already locked or booked
    const plot = await Plot.findById(plotId);
    if (!plot) return res.status(404).json({ success: false, message: 'Plot not found' });
    
    if (plot.status === 'booked') {
      return res.status(400).json({ success: false, message: 'Plot is already booked' });
    }
    
    if (plot.status === 'locked' && plot.lockedBy.toString() !== userId.toString()) {
      return res.status(400).json({ success: false, message: 'Plot is currently held by someone else. Please try again later.' });
    }
    
    // Lock it for 10 minutes (configurable hold duration)
    const holdDurationMinutes = 10;
    const lockedUntil = new Date(Date.now() + holdDurationMinutes * 60000);
    
    plot.status = 'locked';
    plot.lockedBy = userId;
    plot.lockedUntil = lockedUntil;
    
    await plot.save();
    
    // Emit socket event
    emitPlotUpdate(req, plotId, 'locked', userId);
    
    res.status(200).json({ success: true, message: 'Plot locked successfully', data: plot });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.releasePlot = async (req, res) => {
  try {
    const { plotId } = req.params;
    const userId = req.user.id;
    
    const plot = await Plot.findById(plotId);
    if (!plot) return res.status(404).json({ success: false, message: 'Plot not found' });
    
    // Can only release if not booked and if you are the one who locked it
    if (plot.status === 'booked') {
      return res.status(400).json({ success: false, message: 'Plot is already booked' });
    }
    
    if (plot.status === 'locked' && plot.lockedBy && plot.lockedBy.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to release this plot' });
    }
    
    plot.status = 'available';
    plot.lockedBy = null;
    plot.lockedUntil = null;
    
    await plot.save();
    
    // Emit socket event
    emitPlotUpdate(req, plotId, 'available', null);
    
    res.status(200).json({ success: true, message: 'Plot released successfully', data: plot });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Admin route to create a layout mapping
exports.createLayoutWithPlots = async (req, res) => {
  try {
    const { projectId, title, backgroundImageUrl, imageWidth, imageHeight, plots } = req.body;
    
    const layout = new Layout({
      projectId,
      title,
      backgroundImageUrl,
      imageWidth,
      imageHeight
    });
    await layout.save();
    
    // Create plots
    const plotDocs = plots.map(p => ({
      layoutId: layout._id,
      plotNumber: p.plotNumber,
      coordinates: p.coordinates,
      price: p.price,
      area: p.area
    }));
    
    await Plot.insertMany(plotDocs);
    
    res.status(201).json({ success: true, message: 'Layout created successfully', data: layout });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Admin route to update an existing layout mapping
exports.updateLayoutWithPlots = async (req, res) => {
  try {
    const { layoutId } = req.params;
    const { title, backgroundImageUrl, imageWidth, imageHeight, plots } = req.body;
    
    const layout = await Layout.findById(layoutId);
    if (!layout) return res.status(404).json({ success: false, message: 'Layout not found' });
    
    // Update layout metadata
    if (title) layout.title = title;
    if (backgroundImageUrl) layout.backgroundImageUrl = backgroundImageUrl;
    if (imageWidth) layout.imageWidth = imageWidth;
    if (imageHeight) layout.imageHeight = imageHeight;
    await layout.save();
    
    // Get existing plots for reconciliation
    const existingPlots = await Plot.find({ layoutId });
    
    const incomingIds = plots.map(p => p.id).filter(id => id != null);
    
    // 1. Delete plots that were removed (only if they are available)
    for (const existingPlot of existingPlots) {
      if (!incomingIds.includes(existingPlot._id.toString())) {
        if (existingPlot.status === 'available') {
          await Plot.findByIdAndDelete(existingPlot._id);
        }
        // If it's booked/locked, we silently ignore the deletion request to protect the user's booking
      }
    }
    
    // 2. Update existing plots & Create new ones
    for (const p of plots) {
      if (p.id) {
        // Update existing
        await Plot.findByIdAndUpdate(p.id, {
          plotNumber: p.plotNumber,
          coordinates: p.coordinates,
          price: p.price,
          area: p.area
        });
      } else {
        // Create new
        const newPlot = new Plot({
          layoutId: layout._id,
          plotNumber: p.plotNumber,
          coordinates: p.coordinates,
          price: p.price,
          area: p.area,
          status: 'available'
        });
        await newPlot.save();
      }
    }
    
    res.status(200).json({ success: true, message: 'Layout updated successfully', data: layout });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Upload Layout Image
exports.uploadLayoutImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: 'aadya/layouts',
      resourceType: 'image'
    });

    res.status(200).json({
      success: true,
      message: 'Layout image uploaded successfully',
      data: { url: result.secure_url }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to upload image', error: error.message });
  }
};
