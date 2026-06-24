-- New disclaimer types covering registration, content, reviews, and advertising

INSERT INTO platform_disclaimers (type, version, title, content) VALUES
(
  'terms_of_service',
  '1.0',
  'Terms of Service',
  'Welcome to Shopyos. By creating an account, you agree to use the platform lawfully and in good faith. You are responsible for maintaining the security of your account credentials. Shopyos reserves the right to suspend or terminate accounts that violate platform rules, engage in fraud, or breach these terms. Disputes arising from platform use are subject to Ghanaian law.'
),
(
  'privacy_policy',
  '1.0',
  'Privacy Policy',
  'Shopyos collects your name, contact details, device information, and location data to operate the marketplace and improve your experience. Your data is stored securely and is not sold to third parties. We may share data with logistics partners and payment processors strictly to fulfil your orders. You have the right to request access to, correction of, or deletion of your personal data in accordance with the Ghana Data Protection Act, 2012 (Act 843).'
),
(
  'review_terms',
  '1.0',
  'Review & Ratings Policy',
  'By submitting a review, you confirm that your review is based on your genuine experience and is truthful. You must not post reviews that are defamatory, offensive, or that you have been compensated to write. Shopyos reserves the right to remove reviews that violate community guidelines. You grant Shopyos a non-exclusive licence to display your review on the platform.'
),
(
  'content_terms',
  '1.0',
  'Seller Content & Media Policy',
  'By uploading photos, videos, or other media to the platform, you confirm that you own or have the right to use this content and that it does not infringe any third-party intellectual property rights. You grant Shopyos a non-exclusive, royalty-free licence to display your content on the platform for the purpose of marketing your store and products. You must not upload content that is misleading, offensive, or violates Ghanaian law.'
),
(
  'advertising_terms',
  '1.0',
  'Advertising & Promotions Terms',
  'By creating an advertising campaign or banner, you agree that your ad content is truthful, compliant with Ghanaian advertising standards, and does not mislead buyers. Campaign fees are charged based on the budget and duration selected and are non-refundable once the campaign is active. Shopyos reserves the right to review and reject any campaign that does not meet platform standards.'
)
ON CONFLICT (type) DO NOTHING;
