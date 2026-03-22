const repositories = require('../db/repositories');
const { uploadFileToCloudinary } = require('../utils/uploadHelpers');
const { logger } = require('../config/logger');

const PRICING = {
  'Home Top Banner': 50,
  'Search Highlight': 30,
  'Category Featured': 20,
};

exports.createCampaign = async (req, res, next) => {
  try {
    const { title, placement, duration } = req.body;
    const store_id = req.store.id;

    if (!title || !placement || !duration) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Banner image is required' });
    }

    const durationDays = parseInt(duration);
    const costPerDay = PRICING[placement] || 20;
    const totalCost = costPerDay * durationDays;

    // Upload banner to cloudinary
    const uploadResult = await uploadFileToCloudinary(req.file, 'shopyos/banner-campaigns');

    const campaign = await repositories.bannerCampaigns.createCampaign({
      store_id,
      title,
      placement,
      duration_days: durationDays,
      paid_amount: totalCost,
      status: 'Pending',
      banner_url: uploadResult.url
    });

    res.status(201).json({ success: true, campaign });
  } catch (error) {
    next(error);
  }
};

exports.getMyCampaigns = async (req, res, next) => {
  try {
    const store_id = req.store.id;
    const campaigns = await repositories.bannerCampaigns.getMyCampaigns(store_id);
    res.status(200).json({ success: true, campaigns });
  } catch (error) {
    next(error);
  }
};

exports.getAllCampaigns = async (req, res, next) => {
  try {
    const campaigns = await repositories.bannerCampaigns.getAllCampaigns();
    res.status(200).json({ success: true, campaigns });
  } catch (error) {
    next(error);
  }
};

exports.updateCampaignStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body; // 'Active' or 'Rejected'

    let updateData = { status };
    if (status === 'Rejected') {
      updateData.rejection_reason = reason;
    } else if (status === 'Active') {
      updateData.start_date = new Date().toISOString();
      const end = new Date();
      // Needs fetching the campaign duration first
      const campaign = await repositories.bannerCampaigns.supabase.from('banner_campaigns').select('duration_days').eq('id', id).single();
      end.setDate(end.getDate() + (campaign.data.duration_days || 0));
      updateData.end_date = end.toISOString();
    }

    const updated = await repositories.bannerCampaigns.updateCampaign(id, updateData);

    // If rejected, process refund (Simulated)
    if (status === 'Rejected' && updated.paid_amount > 0) {
      // Add logic to refund to wallet
      logger.info(`Simulated Refund: Returning ${updated.paid_amount} to store ${updated.store_id}`);
    }

    res.status(200).json({ success: true, campaign: updated });
  } catch (error) {
    next(error);
  }
};

exports.getActiveBanners = async (req, res, next) => {
  try {
    const activeAds = await repositories.bannerCampaigns.getActiveBanners();
    res.status(200).json({ success: true, banners: activeAds });
  } catch (error) {
    next(error);
  }
};
