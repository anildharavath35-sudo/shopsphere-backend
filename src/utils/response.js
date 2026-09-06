import { toClient } from './serialize.js';

export const success = (res, statusCode, data, message = 'OK') =>
  res.status(statusCode).json({ success: true, message, data: toClient(data) });

export const fail = (res, statusCode, message, code = 'BAD_REQUEST', details = null) =>
  res.status(statusCode).json({ success: false, message, code, details });