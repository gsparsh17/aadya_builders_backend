const nodemailer = require('nodemailer');
const logger = require('./logger');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false // Allow self-signed certificates
    }
  });
};

/**
 * Send email
 */
const sendEmail = async (options) => {
  // Skip sending if email credentials are not configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.warn('Email credentials not configured. Skipping email: ' + options.subject);
    return null;
  }

  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"AadyaBuilders" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: options.email,
      subject: options.subject,
      text: options.text || '',
      html: options.html || options.text || ''
    };
    
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error('Email sending failed:', error);
    throw error;
  }
};

/**
 * Send verification email
 */
const sendVerificationEmail = async (email, name, verificationToken) => {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email/${verificationToken}`;
  
  const subject = 'Verify Your Email - AadyaBuilders';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #e03a3a; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .button { 
          display: inline-block; 
          background: #e03a3a; 
          color: white !important; 
          padding: 12px 30px; 
          text-decoration: none; 
          border-radius: 5px; 
          margin: 20px 0;
        }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>AadyaBuilders</h1>
        </div>
        <div class="content">
          <h2>Welcome, ${name}!</h2>
          <p>Thank you for registering with AadyaBuilders. Please verify your email address to complete your registration.</p>
          <p>Click the button below to verify your email:</p>
          <div style="text-align: center;">
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
          </div>
          <p>Or copy and paste this link in your browser:</p>
          <p><small>${verificationUrl}</small></p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account with AadyaBuilders, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} AadyaBuilders. All rights reserved.</p>
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
    Welcome to AadyaBuilders, ${name}!
    
    Thank you for registering with AadyaBuilders. Please verify your email address by clicking the link below:
    
    ${verificationUrl}
    
    This link will expire in 24 hours.
    
    If you didn't create an account, please ignore this email.
  `;
  
  return await sendEmail({ email, subject, html, text });
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (email, name, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
  
  const subject = 'Password Reset Request - AadyaBuilders';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #e03a3a; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .button { 
          display: inline-block; 
          background: #e03a3a; 
          color: white !important; 
          padding: 12px 30px; 
          text-decoration: none; 
          border-radius: 5px; 
          margin: 20px 0;
        }
        .warning { 
          background: #fff3cd; 
          border: 1px solid #ffeeba; 
          color: #856404; 
          padding: 15px; 
          border-radius: 5px;
        }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>AadyaBuilders</h1>
        </div>
        <div class="content">
          <h2>Password Reset Request</h2>
          <p>Hello ${name},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </div>
          <p>Or copy and paste this link in your browser:</p>
          <p><small>${resetUrl}</small></p>
          <div class="warning">
            <strong>⚠️ Security Notice:</strong>
            <p>This link will expire in 30 minutes. If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
          </div>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} AadyaBuilders. All rights reserved.</p>
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
    Password Reset Request - AadyaBuilders
    
    Hello ${name},
    
    We received a request to reset your password. Click the link below to create a new password:
    
    ${resetUrl}
    
    This link will expire in 30 minutes.
    
    If you didn't request a password reset, please ignore this email.
  `;
  
  return await sendEmail({ email, subject, html, text });
};

/**
 * Send lead notification email to owner
 */
const sendLeadNotificationEmail = async (ownerEmail, ownerName, buyerName, propertyTitle, message) => {
  const subject = `New Lead: ${propertyTitle} - AadyaBuilders`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #28a745; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .property-box { 
          background: white; 
          border: 1px solid #ddd; 
          padding: 15px; 
          border-radius: 5px;
          margin: 20px 0;
        }
        .button { 
          display: inline-block; 
          background: #e03a3a; 
          color: white !important; 
          padding: 12px 30px; 
          text-decoration: none; 
          border-radius: 5px; 
        }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 New Lead Received!</h1>
        </div>
        <div class="content">
          <p>Hello ${ownerName},</p>
          <p>Great news! You have received a new lead for your property.</p>
          
          <div class="property-box">
            <h3>${propertyTitle}</h3>
            <p><strong>Interested Buyer:</strong> ${buyerName}</p>
            <p><strong>Message:</strong> ${message || 'Interested in this property'}</p>
          </div>
          
          <p>Log in to your dashboard to view full details and respond to this lead.</p>
          <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/leads" class="button">View Lead Details</a>
          </div>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} AadyaBuilders. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
    New Lead Received - AadyaBuilders
    
    Hello ${ownerName},
    
    You have received a new lead for your property "${propertyTitle}".
    
    Buyer: ${buyerName}
    Message: ${message || 'Interested in this property'}
    
    Log in to your dashboard to view full details.
  `;
  
  return await sendEmail({ email: ownerEmail, subject, html, text });
};

/**
 * Send property verification status email
 */
const sendVerificationStatusEmail = async (email, name, propertyTitle, isVerified, reason = '') => {
  const subject = isVerified 
    ? `✅ Your Property Has Been Verified - AadyaBuilders`
    : `⚠️ Property Verification Update - AadyaBuilders`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { 
          background: ${isVerified ? '#28a745' : '#ffc107'}; 
          color: ${isVerified ? 'white' : '#333'}; 
          padding: 20px; 
          text-align: center; 
        }
        .content { background: #f9f9f9; padding: 30px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${isVerified ? '✅ Property Verified!' : '⚠️ Verification Update'}</h1>
        </div>
        <div class="content">
          <p>Hello ${name},</p>
          <h3>Property: ${propertyTitle}</h3>
          ${isVerified ? `
            <p>Congratulations! Your property has been verified and is now live on AadyaBuilders.</p>
            <p>Buyers can now see and inquire about your property.</p>
          ` : `
            <p>We were unable to verify your property at this time.</p>
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
            <p>Please review your listing and make necessary corrections, or contact our support team for assistance.</p>
          `}
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} AadyaBuilders. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
    ${isVerified ? 'Property Verified' : 'Verification Update'} - AadyaBuilders
    
    Hello ${name},
    
    Property: ${propertyTitle}
    
    ${isVerified 
      ? 'Congratulations! Your property has been verified and is now live on AadyaBuilders.' 
      : `We were unable to verify your property. ${reason ? 'Reason: ' + reason : ''}`
    }
  `;
  
  return await sendEmail({ email, subject, html, text });
};

/**
 * Send welcome email after registration
 */
const sendWelcomeEmail = async (email, name) => {
  const subject = 'Welcome to AadyaBuilders - India\'s No.1 Property Portal';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #e03a3a; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .features { display: flex; flex-wrap: wrap; margin: 20px 0; }
        .feature { flex: 1; min-width: 200px; padding: 10px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to AadyaBuilders!</h1>
        </div>
        <div class="content">
          <h2>Hello ${name},</h2>
          <p>Thank you for joining AadyaBuilders, India's leading real estate portal.</p>
          
          <div class="features">
            <div class="feature">
              <h3>🏠 Search Properties</h3>
              <p>Find your dream home from thousands of verified listings.</p>
            </div>
            <div class="feature">
              <h3>📊 Price Trends</h3>
              <p>Access real-time market insights and price trends.</p>
            </div>
            <div class="feature">
              <h3>💰 Home Loans</h3>
              <p>Get the best home loan offers from leading banks.</p>
            </div>
          </div>
          
          <p>Start exploring properties now!</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} AadyaBuilders. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return await sendEmail({ email, subject, html });
};

/**
 * Verify email connection
 */
const verifyConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    logger.info('Email service is ready');
    return true;
  } catch (error) {
    logger.error('Email service connection failed:', error);
    return false;
  }
};

/**
 * Send property created confirmation email
 */
const sendPropertyCreatedEmail = async (email, name, propertyTitle, propertyCode) => {
  const subject = 'Your Property Has Been Listed - AadyaBuilders';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #28a745; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .property-box { 
          background: white; 
          border: 1px solid #ddd; 
          padding: 15px; 
          border-radius: 5px;
          margin: 20px 0;
        }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏠 Property Listed Successfully!</h1>
        </div>
        <div class="content">
          <p>Hello ${name},</p>
          <p>Your property has been successfully listed on AadyaBuilders and is pending verification.</p>
          
          <div class="property-box">
            <h3>${propertyTitle}</h3>
            <p><strong>Property Code:</strong> ${propertyCode}</p>
          </div>
          
          <p>Our team will verify your listing within 24-48 hours. Once verified, your property will be visible to potential buyers.</p>
          <p>You can track the status of your listing in your dashboard.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} AadyaBuilders. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
    Property Listed Successfully - AadyaBuilders
    
    Hello ${name},
    
    Your property "${propertyTitle}" has been successfully listed and is pending verification.
    
    Property Code: ${propertyCode}
    
    Our team will verify your listing within 24-48 hours.
  `;
  
  return await sendEmail({ email, subject, html, text });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendLeadNotificationEmail,
  sendVerificationStatusEmail,
  sendWelcomeEmail,
  verifyConnection,
  sendPropertyCreatedEmail
};