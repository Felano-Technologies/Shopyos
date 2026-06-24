const repositories = require('../db/repositories');
const { uploadFileToCloudinary } = require('../utils/uploadHelpers');
const { transformImageUrlsAsync } = require('../config/storage');
const feeConfigService = require('../services/feeConfigService');

// Placements randomly assigned by the system at approval time
const PLACEMENTS = ['Home Top Banner', 'Search Highlight', 'Category Featured'];

const calcCost = async (days) => {
  const dailyFee = await feeConfigService.get('banner_campaign_daily_fee');
  const weeklyFee = await feeConfigService.get('banner_campaign_weekly_fee');
  const monthlyFee = await feeConfigService.get('banner_campaign_monthly_fee');

  if (days === 1) return dailyFee;
  if (days === 7) return weeklyFee;
  if (days === 30) return monthlyFee;

  if (days <= 7) {
    return Math.round(days * (weeklyFee / 7) * 100) / 100;
  }
  return Math.round(days * (monthlyFee / 30) * 100) / 100;
};

exports.createCampaign = async (req, res, next) => {
  try {
    const { title, duration, productId } = req.body;

    const storeResults = await repositories.stores.findByOwner(req.user.id);
    const store = Array.isArray(storeResults) ? storeResults[0] : (storeResults?.data?.[0] || storeResults.data);

    if (!store) {
      return res.status(404).json({ error: 'No store found for this account. Please create a store first.' });
    }

    const store_id = store.id;

    if (!title || !duration) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Banner image is required' });
    }

    const durationDays = Number.parseInt(duration);
    const totalCost = await calcCost(durationDays);

    const uploadResult = await uploadFileToCloudinary(req.file, 'shopyos/banner-campaigns');

    const campaign = await repositories.bannerCampaigns.createCampaign({
      store_id,
      title,
      product_id: productId || null,
      placement: 'Pending Assignment',
      duration_days: durationDays,
      paid_amount: totalCost,
      status: 'Pending',
      banner_url: uploadResult.url,
    });

    res.status(201).json({ success: true, campaign: await transformImageUrlsAsync(campaign) });
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
    res.status(200).json({ success: true, campaigns: await transformImageUrlsAsync(campaigns) });
  } catch (error) {
    next(error);
  }
};

exports.getAllCampaigns = async (req, res, next) => {
  try {
    const campaigns = await repositories.bannerCampaigns.getAllCampaigns();
    res.status(200).json({ success: true, campaigns: await transformImageUrlsAsync(campaigns) });
  } catch (error) {
    next(error);
  }
};

exports.updateCampaignStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    let updateData = { status };

    if (status === 'Rejected') {
      updateData.rejection_reason = reason;
    } else if (status === 'Approved') {
      // Randomly assign the placement — sellers don't choose, the system does
      updateData.placement = PLACEMENTS[Math.floor(Math.random() * PLACEMENTS.length)];
    }

    const updated = await repositories.bannerCampaigns.updateCampaign(id, updateData);

    res.status(200).json({ success: true, campaign: await transformImageUrlsAsync(updated) });
  } catch (error) {
    next(error);
  }
};

exports.getActiveBanners = async (req, res, next) => {
  try {
    const activeAds = await repositories.bannerCampaigns.getActiveBanners();
    res.status(200).json({ success: true, banners: await transformImageUrlsAsync(activeAds) });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin-created campaign — skips Paystack, sets Active immediately
 * @route   POST /api/advertising/banners/admin-create
 */
exports.adminCreateCampaign = async (req, res, next) => {
  try {
    const { storeId, title, duration, productId } = req.body;
    if (!storeId || !title || !duration) {
      return res.status(400).json({ error: 'storeId, title and duration are required' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Banner image is required' });
    }

    const durationDays = Number.parseInt(duration);
    const totalCost = calcCost(durationDays);
    const placement = PLACEMENTS[Math.floor(Math.random() * PLACEMENTS.length)];
    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + durationDays);

    const uploadResult = await uploadFileToCloudinary(req.file, 'shopyos/banner-campaigns');

    const campaign = await repositories.bannerCampaigns.createCampaign({
      store_id: storeId,
      title,
      product_id: productId || null,
      placement,
      duration_days: durationDays,
      paid_amount: totalCost,
      status: 'Active',
      banner_url: uploadResult.url,
      admin_created: true,
      start_date: start.toISOString(),
      end_date: end.toISOString(),
    });

    // Notify store owner
    const { getPool } = require('../config/postgres');
    const db = getPool();
    const { rows } = await db.query(`SELECT owner_id FROM stores WHERE id = $1`, [storeId]);
    if (rows[0]) {
      const notificationService = require('../services/notificationService');
      await notificationService.sendNotification({
        userId: rows[0].owner_id,
        type: 'business_approved',
        title: 'Campaign Created',
        message: `An admin created a banner campaign "${title}" for your store. It is now live.`,
        relatedId: campaign.id,
        relatedType: 'campaign',
        data: { campaignId: campaign.id, storeId },
        push: { data: { screen: 'business/promotions' } },
      }).catch(() => {});
    }

    res.status(201).json({ success: true, campaign: await transformImageUrlsAsync(campaign) });
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
    const { campaignId, email, callbackUrl } = req.body;
    
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
      callback_url: callbackUrl ? `${callbackUrl}?reference=${campaign.id}` : `${process.env.FRONTEND_URL}/business/promotions?reference=${campaign.id}`,
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
