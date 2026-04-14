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
    
    // Get user's store
    const storeResults = await repositories.stores.findByOwner(req.user.id);
    const store = Array.isArray(storeResults) ? storeResults[0] : (storeResults?.data?.[0] || storeResults.data);
    
    if (!store) {
      return res.status(404).json({ error: 'No store found for this account. Please create a store first.' });
    }
    
    const store_id = store.id;

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
    // Get user's store
    const storeResults = await repositories.stores.findByOwner(req.user.id);
    const store = Array.isArray(storeResults) ? storeResults[0] : (storeResults?.data?.[0] || storeResults.data);
    
    if (!store) {
      return res.status(200).json({ success: true, campaigns: [] });
    }

    const store_id = store.id;
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
    const { status, reason } = req.body; // 'Approved' or 'Rejected'

    let updateData = { status };
    if (status === 'Rejected') {
      updateData.rejection_reason = reason;
    } 
    // Admin approving only moves it to 'Approved' (Waiting for Payment)
    // It becomes 'Active' only after verifyPayment

    const updated = await repositories.bannerCampaigns.updateCampaign(id, updateData);

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

const axios = require('axios');
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

/**
 * Initialize Campaign Payment
 * @route   POST /api/advertising/banners/pay-initialize
 */
exports.initializeCampaignPayment = async (req, res, next) => {
  try {
    const { campaignId, email } = req.body;
    
    if (!campaignId || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Fetch campaign details
    const { data: campaign, error: fetchErr } = await repositories.bannerCampaigns.db
      .from('banner_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (fetchErr || !campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (campaign.status !== 'Approved') {
      return res.status(400).json({ error: 'Campaign must be approved by admin before payment' });
    }

    const amountInPesewas = Math.round(campaign.paid_amount * 100);

    const payload = {
      email,
      amount: amountInPesewas,
      currency: 'GHS',
      callback_url: `${process.env.FRONTEND_URL}/business/promotions?reference=${campaign.id}`,
      metadata: {
        type: 'BANNER_AD',
        campaignId: campaign.id,
        userId: req.user.id
      }
    };

    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.data.status) {
      return res.status(400).json({ success: false, error: response.data.message });
    }

    // Update campaign with reference
    await repositories.bannerCampaigns.updateCampaign(campaignId, {
      paystack_reference: response.data.data.reference
    });

    res.status(200).json({
      success: true,
      data: response.data.data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Campaign Payment
 * @route   GET /api/advertising/banners/verify/:reference
 */
exports.verifyCampaignPayment = async (req, res, next) => {
  try {
    const { reference } = req.params;
    
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
      }
    );

    const txn = response.data.data;
    if (response.data.status && txn.status === 'success') {
      const campaignId = txn.metadata?.campaignId;
      
      // Update campaign to Active
      const duration = txn.metadata?.duration || 0;
      const start = new Date();
      const end = new Date();
      
      // Fetch duration if not in metadata
      const { data: existing } = await repositories.bannerCampaigns.db
        .from('banner_campaigns')
        .select('duration_days')
        .eq('id', campaignId)
        .single();
      
      const days = duration || existing?.duration_days || 0;
      end.setDate(start.getDate() + days);

      await repositories.bannerCampaigns.updateCampaign(campaignId, {
        status: 'Active',
        start_date: start.toISOString(),
        end_date: end.toISOString()
      });

      res.status(200).json({ success: true, message: 'Payment verified and Ad is now Active' });
    } else {
      res.status(400).json({ success: false, error: 'Payment not successful' });
    }
  } catch (error) {
    next(error);
  }
};
