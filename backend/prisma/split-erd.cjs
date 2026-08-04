const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');

const docs = join(__dirname, '..', 'docs');
const source = readFileSync(join(docs, 'database-erd.mmd'), 'utf8');
const output = join(docs, 'erd');
const reportTheme = `%%{init: {"theme":"base","themeVariables":{"background":"#ffffff","primaryColor":"#ecfdf5","primaryTextColor":"#0f172a","primaryBorderColor":"#166534","lineColor":"#334155","secondaryColor":"#f8fafc","tertiaryColor":"#ffffff","fontFamily":"Arial, sans-serif"},"themeCSS":".er.relationshipLine{stroke:#334155!important;stroke-width:2.5px!important}.er.entityBox{fill:#ecfdf5!important;stroke:#166534!important;stroke-width:2px!important}.er.attributeBoxOdd,.er.attributeBoxEven{fill:#fff!important}.er.relationshipLabelBox{fill:#fff!important;opacity:1!important}"}}%%`;

const groups = {
  '01-identity-access': [
    'users', 'user_profiles', 'addresses', 'roles', 'permissions',
    'user_roles', 'role_permissions', 'refresh_tokens', 'otp_codes',
  ],
  '02-store-inventory': [
    'users', 'stores', 'store_staff', 'store_service_areas', 'product_variants',
    'store_inventories', 'inventory_batches', 'inventory_transactions',
  ],
  '03-catalog-pricing': [
    'stores', 'categories', 'products', 'product_variants', 'product_images',
    'product_attributes', 'price_histories', 'store_inventories',
    'inventory_batches', 'campaigns', 'campaign_items', 'combos', 'combo_items',
    'coupons', 'coupon_redemptions', 'product_barcodes',
  ],
  '04-cart-orders-returns': [
    'users', 'stores', 'product_variants', 'inventory_batches', 'carts',
    'cart_items', 'orders', 'order_items', 'order_item_batch_allocations',
    'order_status_history', 'return_requests', 'return_items', 'coupons',
    'coupon_redemptions',
  ],
  '05-payment-delivery': [
    'users', 'stores', 'orders', 'payments', 'payment_transactions', 'refunds',
    'deliveries', 'delivery_events',
  ],
  '06-pos': [
    'users', 'stores', 'product_variants', 'inventory_batches',
    'product_barcodes', 'cashier_shifts', 'pos_sales', 'pos_sale_items',
    'pos_sale_item_batch_allocations', 'pos_payments', 'pos_returns',
    'pos_return_items',
  ],
  '07-customer-care': [
    'users', 'products', 'orders', 'order_items', 'reviews', 'review_images',
    'notifications', 'notification_templates', 'support_tickets',
    'ticket_messages',
  ],
  '08-ai-audit': [
    'users', 'products', 'knowledge_sources', 'ai_vector_index',
    'product_co_purchases', 'audit_logs',
  ],
};

const tables = new Map(
  [...source.matchAll(/^  "([^"]+)" \{\r?\n[\s\S]*?^    \}/gm)]
    .map((match) => [match[1], match[0]]),
);
const relations = source.split(/\r?\n/).filter((line) => {
  const match = line.match(/^\s+"([^"]+)"\s+\S+\s+(?:"([^"]+)"|([\w]+))\s+:/);
  if (!match) return false;
  line.tables = [match[1], match[2] ?? match[3]];
  return true;
});
const relationTables = (line) => {
  const match = line.match(/^\s+"([^"]+)"\s+\S+\s+(?:"([^"]+)"|([\w]+))\s+:/);
  return [match[1], match[2] ?? match[3]];
};

mkdirSync(output, { recursive: true });
const covered = new Set();
for (const [name, tableNames] of Object.entries(groups)) {
  const selected = new Set(tableNames);
  tableNames.forEach((table) => {
    assert(tables.has(table), `${name}: unknown table ${table}`);
    covered.add(table);
  });
  const body = tableNames.map((table) => tables.get(table)).join('\n\n');
  const edges = relations
    .filter((line) => relationTables(line).every((table) => selected.has(table)))
    .join('\n');
  writeFileSync(
    join(output, `${name}.mmd`),
    `${reportTheme}\n%% ${name}\nerDiagram\n\n${body}\n\n${edges}\n`,
  );
}

assert.deepEqual(
  [...tables.keys()].filter((table) => !covered.has(table)),
  [],
  'Every table must appear in at least one domain ERD',
);
console.log(`Generated ${Object.keys(groups).length} domain ERDs for ${tables.size} tables.`);
