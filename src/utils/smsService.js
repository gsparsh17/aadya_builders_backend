const https = require('https');
const logger = require('./logger');

/**
 * SMS Service — powered by 2Factor.in
 * Sends OTP SMS to Indian mobile numbers.
 */
class SmsService {
  constructor() {
    this.apiKey = process.env.TWO_FACTOR_API_KEY;
    this.baseUrl = 'https://2factor.in/API/V1';
  }

  /**
   * Send OTP via 2Factor SMS API
   * @param {string} phone - 10-digit Indian mobile number
   * @param {string} otp   - 6-digit OTP string
   * @returns {Promise<object>}
   */
  sendOtp(phone, otp) {
    return new Promise((resolve, reject) => {
      if (!this.apiKey) {
        logger.error('TWO_FACTOR_API_KEY not set in environment');
        return reject(new Error('SMS service not configured'));
      }

      // Sanitize phone — strip country code if present
      const sanitizedPhone = phone.replace(/^\+91/, '').replace(/^91/, '').trim();

      const url = `${this.baseUrl}/${this.apiKey}/SMS/${sanitizedPhone}/${otp}/OTP1`;

      logger.info(`Sending OTP via 2Factor to +91${sanitizedPhone}`);

      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.Status === 'Success') {
              logger.info(`OTP sent successfully to +91${sanitizedPhone} | Session: ${parsed.Details}`);
              resolve({ success: true, session: parsed.Details });
            } else {
              logger.error(`2Factor API error: ${parsed.Details}`);
              reject(new Error(parsed.Details || 'Failed to send OTP'));
            }
          } catch (e) {
            logger.error('Failed to parse 2Factor response:', data);
            reject(new Error('Invalid SMS service response'));
          }
        });
      }).on('error', (err) => {
        logger.error('2Factor HTTPS request error:', err);
        reject(err);
      });
    });
  }
}

module.exports = new SmsService();
