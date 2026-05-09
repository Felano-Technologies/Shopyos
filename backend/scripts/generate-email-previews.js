const fs = require('fs');
const path = require('path');
const {
  getWelcomeTemplates,
  getOrderCreatedTemplates,
  getRoleSelectedTemplates,
  getBusinessVerificationSubmittedTemplates,
  getBusinessVerificationResultTemplates,
  getDriverVerificationSubmittedTemplates,
  getDriverVerificationResultTemplates,
  getOrderDeliveredTemplates,
  getEmailTemplateByEvent,
} = require('../templates');

const outDir = path.resolve(__dirname, '../tmp/email-previews');
fs.mkdirSync(outDir, { recursive: true });

const examples = [
  ['welcome_buyer.html', getWelcomeTemplates('buyer', 'Felix', '+233240000000').email],
  ['welcome_seller.html', getWelcomeTemplates('seller', 'Ama', '+233240000000').email],
  ['role_selected_driver.html', getRoleSelectedTemplates('driver', 'Kwame').email],
  ['order_created_buyer.html', getOrderCreatedTemplates('buyer', { orderId: 'SO-10241', amount: '245.50', customerName: 'Felix', itemsCount: 3 }).email],
  ['order_created_seller.html', getOrderCreatedTemplates('seller', { orderId: 'SO-10241', amount: '245.50', itemsCount: 3 }).email],
  ['biz_verification_submitted_owner.html', getBusinessVerificationSubmittedTemplates({ businessName: 'Felix Mart', ownerName: 'Felix' }).email],
  ['biz_verification_submitted_admin.html', getBusinessVerificationSubmittedTemplates({ businessName: 'Felix Mart', audience: 'admin' }).email],
  ['biz_verification_result_approved.html', getBusinessVerificationResultTemplates({ businessName: 'Felix Mart', status: 'approved' }).email],
  ['biz_verification_result_rejected.html', getBusinessVerificationResultTemplates({ businessName: 'Felix Mart', status: 'rejected', reason: 'Store front image was blurry' }).email],
  ['driver_verification_submitted_driver.html', getDriverVerificationSubmittedTemplates({ driverName: 'Kojo Mensah' }).email],
  ['driver_verification_submitted_admin.html', getDriverVerificationSubmittedTemplates({ driverName: 'Kojo Mensah', audience: 'admin' }).email],
  ['driver_verification_result_approved.html', getDriverVerificationResultTemplates({ driverName: 'Kojo Mensah', status: 'approved' }).email],
  ['driver_verification_result_rejected.html', getDriverVerificationResultTemplates({ driverName: 'Kojo Mensah', status: 'rejected', reason: 'License document expired' }).email],
  ['order_delivered.html', getOrderDeliveredTemplates({ orderId: 'SO-99812', amount: '89.99' }).email],
  ['router_order_created.html', getEmailTemplateByEvent('ORDER_CREATED', 'buyer', { orderId: 'SO-76543', amount: '120.00', customerName: 'Felix', itemsCount: 2 })],
];

for (const [filename, template] of examples) {
  if (!template?.html) continue;
  fs.writeFileSync(path.join(outDir, filename), template.html, 'utf8');
}

const index = `<!doctype html><html><head><meta charset="utf-8"/><title>Email Previews</title><style>body{font-family:Arial,sans-serif;padding:24px}li{margin:8px 0}</style></head><body><h1>Email Previews</h1><ul>${examples.map(([name])=>`<li><a href="./${name}">${name}</a></li>`).join('')}</ul></body></html>`;
fs.writeFileSync(path.join(outDir, 'index.html'), index, 'utf8');
console.log(`Generated ${examples.length} previews in ${outDir}`);
