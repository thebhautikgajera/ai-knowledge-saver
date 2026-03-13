import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create and cache a single transporter instance
let transporter;

const getTransporter = () => {
  if (transporter) return transporter;

  const {
    MAIL_HOST,
    MAIL_PORT,
    MAIL_USERNAME,
    MAIL_PASSWORD,
    MAIL_MAILER,
  } = process.env;

  transporter = nodemailer.createTransport({
    host: MAIL_HOST,
    port: MAIL_PORT ? Number(MAIL_PORT) : 587,
    secure: MAIL_PORT === '465', // true for 465, false for other ports
    auth: {
      user: MAIL_USERNAME,
      pass: MAIL_PASSWORD,
    },
  });

  return transporter;
};

export const sendMail = async ({ to, subject, html }) => {
  const mailer = getTransporter();

  const fromAddress =
    process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME;
  const fromName = process.env.MAIL_FROM_NAME || 'CineScope';

  await mailer.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject,
    html,
  });
};


