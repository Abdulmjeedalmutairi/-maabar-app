/**
 * Tracking URL helper — used by the new Direct Purchase screens.
 *
 * Mirrors web src/pages/DashboardBuyer.jsx:36-44 (also duplicated at
 * src/pages/DashboardSupplier.jsx). Mobile already has the same helper
 * inlined in OrderDetailScreen.js and RequestsScreen.js for the RFQ flow —
 * those duplications are intentionally left in place; this helper is
 * scoped to the Direct Purchase screens only.
 */
export function getTrackingUrl(company, num) {
  const safeNum = encodeURIComponent(String(num || ''));
  const urls = {
    'DHL':    `https://www.dhl.com/track?tracking-id=${safeNum}`,
    'FedEx':  `https://www.fedex.com/tracking?tracknumbers=${safeNum}`,
    'Aramex': `https://www.aramex.com/track/${safeNum}`,
    'UPS':    `https://www.ups.com/track?tracknum=${safeNum}`,
    'SMSA':   `https://www.smsaexpress.com/track?awbno=${safeNum}`,
  };
  return urls[company] || `https://t.17track.net/en#nums=${safeNum}`;
}

export const CARRIERS = ['DHL', 'FedEx', 'Aramex', 'UPS', 'SMSA', 'Other'];
