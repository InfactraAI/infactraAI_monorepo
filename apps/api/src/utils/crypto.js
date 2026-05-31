const crypto = require('crypto');

const KEY = crypto
  .createHash('sha256')
  .update(process.env.CRYPTO_SECRET || 'default_secret_key')
  .digest();

exports.encrypt = (text) => {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
};

exports.decrypt = (text) => {
  if (!text) return null;
  const [ivHex, encrypted] = text.split(':');
  if (!ivHex || !encrypted) throw new Error('Invalid encrypted format');
  const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, Buffer.from(ivHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};
