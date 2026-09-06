import crypto from 'crypto';
import Razorpay from 'razorpay';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { success } from '../utils/response.js';
import prisma from '../config/prisma.js';

const ORDER_INCLUDE = {
  items: true,
  statusHistory: { orderBy: { at: 'asc' } },
};

export const isRazorpayConfigured = () =>
  Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

export const isPaymentDevMode = () => process.env.PAYMENT_DEV_MODE === 'true';

const getRazorpay = () => {
  if (!isRazorpayConfigured()) {
    throw new AppError('Payments are not configured. Contact support.', 500, 'PAYMENT_CONFIG_ERROR');
  }
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
};

const recordPayment = async (order, data) => {
  await prisma.payment.upsert({
    where: { orderId: order.id },
    create: {
      orderId: order.id,
      amount: order.total,
      currency: 'INR',
      method: order.paymentMethod,
      status: data.status,
      razorpayOrderId: data.razorpayOrderId || '',
      razorpayPaymentId: data.razorpayPaymentId || '',
      razorpaySignature: data.razorpaySignature || '',
      paidAt: data.paidAt || null,
    },
    update: {
      status: data.status,
      razorpayOrderId: data.razorpayOrderId || '',
      razorpayPaymentId: data.razorpayPaymentId || '',
      razorpaySignature: data.razorpaySignature || '',
      paidAt: data.paidAt || null,
    },
  });
};

/**
 * POST /api/payment/create-order  { orderId }
 * Creates a Razorpay order for the total of a pending ShopSphere order.
 * Amount is computed on the server - never from the client.
 */
export const createPaymentOrder = asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.body.orderId } });
  if (!order) throw new AppError('Order not found.', 404, 'NOT_FOUND');
  if (order.userId !== req.user._id) {
    throw new AppError('You are not allowed to pay for this order.', 403, 'FORBIDDEN');
  }
  if (order.orderStatus === 'cancelled') {
    throw new AppError('This order is cancelled and cannot be paid.', 400, 'ORDER_CANCELLED');
  }
  if (order.paymentStatus === 'paid') {
    throw new AppError('This order is already paid.', 400, 'ALREADY_PAID');
  }

  const amountPaise = Math.round(order.total * 100);

  // --- Dev mode: no real gateway, but the contract (order) is created. ---
  if (!isRazorpayConfigured() && isPaymentDevMode()) {
    await recordPayment(order, { status: 'pending', razorpayOrderId: 'order_dev_' + order.id.slice(-16) });
    return success(res, 200, {
      devMode: true,
      razorpayOrderId: 'order_dev_' + order.id.slice(-16),
      amount: amountPaise,
      currency: 'INR',
      keyId: null,
      orderId: order.orderId,
    });
  }

  if (!isRazorpayConfigured()) {
    throw new AppError(
      'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, or enable PAYMENT_DEV_MODE.',
      500,
      'PAYMENT_CONFIG_ERROR'
    );
  }

  const razorpay = getRazorpay();
  const rzp = await razorpay.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: order.orderId,
    notes: { shopsphereOrderId: order.orderId },
  });

  // remember the gateway order id on our order + payment record
  await prisma.order.update({
    where: { id: order.id },
    data: { paymentDetails: { ...(order.paymentDetails || {}), razorpayOrderId: rzp.id } },
  });
  await recordPayment(order, { status: 'pending', razorpayOrderId: rzp.id });

  success(res, 200, {
    devMode: false,
    razorpayOrderId: rzp.id,
    amount: amountPaise,
    currency: 'INR',
    keyId: process.env.RAZORPAY_KEY_ID,
    orderId: order.orderId,
  });
});

const markOrderPaid = async (order, details, note) => {
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: 'paid',
      orderStatus: 'confirmed',
      paymentDetails: details,
      statusHistory: { create: [{ status: 'confirmed', note }] },
    },
    include: ORDER_INCLUDE,
  });

  await recordPayment(order, {
    status: 'paid',
    razorpayOrderId: details.razorpayOrderId,
    razorpayPaymentId: details.razorpayPaymentId,
    razorpaySignature: details.razorpaySignature,
    paidAt: details.paidAt,
  });

  for (const it of order.items) {
    if (!it.productId) continue;
    await prisma.product.update({
      where: { id: it.productId },
      data: { soldCount: { increment: it.quantity } },
    });
  }

  return updated;
};

/**
 * POST /api/payment/verify  { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature, devSimulate }
 * Verifies the Razorpay signature (HMAC SHA-256) on the backend.
 * Order is marked paid + confirmed only after successful verification.
 */
export const verifyPayment = asyncHandler(async (req, res) => {
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature, devSimulate } = req.body;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: ORDER_INCLUDE,
  });
  if (!order) throw new AppError('Order not found.', 404, 'NOT_FOUND');
  if (order.userId !== req.user._id) {
    throw new AppError('You are not allowed to verify this payment.', 403, 'FORBIDDEN');
  }
  if (order.paymentStatus === 'paid') {
    return success(res, 200, { order }, 'Order is already paid');
  }

  // --- Dev-mode simulation (explicitly enabled via env) ---
  if (devSimulate && isPaymentDevMode() && !isRazorpayConfigured()) {
    const details = {
      razorpayOrderId: order.paymentDetails?.razorpayOrderId || razorpayOrderId || 'order_dev',
      razorpayPaymentId: razorpayPaymentId || 'pay_dev_' + Date.now(),
      razorpaySignature: 'dev-simulated',
      paidAt: new Date(),
    };
    const updated = await markOrderPaid(order, details, 'Payment received (dev mode)');
    return success(res, 200, { order: updated }, 'Payment verified');
  }

  // --- Real signature verification ---
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!isRazorpayConfigured() || !secret || !razorpaySignature) {
    throw new AppError('Payment verification failed.', 400, 'VERIFY_FAILED');
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (expected !== razorpaySignature) {
    throw new AppError('Payment verification failed. Please contact support.', 400, 'VERIFY_FAILED');
  }

  const details = {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    paidAt: new Date(),
  };
  const updated = await markOrderPaid(order, details, 'Payment received');
  success(res, 200, { order: updated }, 'Payment verified successfully');
});