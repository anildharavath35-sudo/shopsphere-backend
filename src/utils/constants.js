/** App-level enum constants (kept in sync with the DB's string columns). */
export const ROLES = ['customer', 'admin'];

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
];

export const PAYMENT_METHODS = ['razorpay', 'cod'];

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

export const ORDER_CANCELABLE_STATUSES = ['pending', 'confirmed', 'processing'];