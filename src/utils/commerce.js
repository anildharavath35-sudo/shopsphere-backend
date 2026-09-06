/**
 * Shared commerce helpers. Kept in one place so cart and orders
 * always compute money the same way.
 */

export const FREE_DELIVERY_THRESHOLD = () =>
  Number(process.env.FREE_DELIVERY_THRESHOLD) || 999;
export const DELIVERY_CHARGE = () => Number(process.env.DELIVERY_CHARGE) || 49;

export const itemTotals = (item) => {
  const subtotal = item.price * item.quantity;
  const mrpTotal = item.mrp * item.quantity;
  const discount = Math.max(0, mrpTotal - subtotal);
  return { subtotal, discount };
};

export const computeOrderTotals = (items) => {
  let subtotal = 0;
  let discount = 0;

  for (const it of items) {
    const t = itemTotals(it);
    subtotal += t.subtotal;
    discount += t.discount;
  }

  const deliveryCharge = subtotal >= FREE_DELIVERY_THRESHOLD() || subtotal === 0 ? 0 : DELIVERY_CHARGE();
  const total = subtotal + deliveryCharge;

  return { subtotal, discount, deliveryCharge, total };
};