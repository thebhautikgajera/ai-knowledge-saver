import mjml2html from 'mjml';
import { embedLogoInTemplate } from './logoUtils.js';

/**
 * Internal helper: builds the OTP MJML string for a given title/subtitle and otp.
 * Styled to match the app's Login/Register UI (slate background, white card, dark heading, emerald accents).
 * Uses font-family: "Poppins", sans-serif;
 */
const buildOtpMjml = (
  otp,
  title,
  subtitle,
  expiryText = 'This OTP will expire in 10 minutes.'
) => `
  <mjml>
    <mj-head>
      <mj-font name="Poppins" href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" />
      <mj-attributes>
        <mj-all font-family="'Poppins', sans-serif" />
        <mj-text font-weight="400" font-size="15px" color="#020617" line-height="1.6" />
        <mj-section padding="0px" />
      </mj-attributes>
      <mj-style inline="inline">
        .otp-code {
          letter-spacing: 8px;
          font-size: 30px;
          font-weight: 700;
        }
        .badge-pill {
          border-radius: 9999px;
        }
      </mj-style>
    </mj-head>

    <mj-body background-color="#f8fafc">
      <mj-section padding="32px 0">
        <mj-column>
          <mj-text align="center" font-size="18px" font-weight="600" color="#020617" padding-bottom="4px">
            CineScope
          </mj-text>
          <mj-text align="center" font-size="13px" color="#64748b" padding-bottom="12px">
            Discover movies beyond the screen
          </mj-text>
        </mj-column>
      </mj-section>

      <mj-section background-color="#ffffff" border-radius="20px" padding="24px" border="1px solid #e2e8f0">
        <mj-column>
          <mj-text align="center" padding-bottom="12px">
            <span class="badge-pill" style="display:inline-flex;align-items:center;gap:8px;border:1px solid #e2e8f0;background:#f8fafc;color:#0f172a;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;padding:6px 14px;">
              ${title}
            </span>
          </mj-text>

          <mj-text font-size="22px" color="#020617" font-weight="600" align="center" padding-bottom="8px">
            ${subtitle}
          </mj-text>

          <mj-text align="center" color="#64748b" font-size="14px" padding-bottom="20px">
            Use the one-time code below to continue. For your security, do not share this code with anyone.
          </mj-text>

          <mj-section background-color="#0f172a" border-radius="16px" padding="18px 16px">
            <mj-column>
              <mj-text css-class="otp-code" align="center" color="#ecfeff">
                ${otp}
              </mj-text>
            </mj-column>
          </mj-section>

          <mj-text align="center" font-size="13px" color="#0f172a" padding-top="16px">
            ${expiryText}
          </mj-text>

          <mj-text align="center" font-size="13px" color="#64748b" padding-top="10px">
            If you did not request this, you can safely ignore this email or contact your administrator.
          </mj-text>

          <mj-divider border-width="1px" border-color="#e2e8f0" padding="24px 0 16px" />

          <mj-text align="center" font-size="13px" color="#0f172a" font-weight="500">
            Thank you,<br />
            The CineScope Team
          </mj-text>
        </mj-column>
      </mj-section>

      <mj-section padding="20px 0 32px">
        <mj-column>
          <mj-text align="center" font-size="12px" color="#94a3b8">
            For security reasons, CineScope will never ask you to share OTPs or passwords over email or phone.
          </mj-text>
          <mj-text align="center" font-size="11px" color="#94a3b8" padding-top="8px">
            © ${new Date().getFullYear()} CineScope. All rights reserved.
          </mj-text>
        </mj-column>
      </mj-section>
    </mj-body>
  </mjml>
`;

/**
 * Email Verification OTP template
 * @param {string} otp
 * @returns {string} compiled HTML
 */
export const generateEmailVerificationOTPTemplate = (otp) => {
  const title = 'Email verification';
  const subtitle = 'Verify your email to complete your sign-up.';
  let mjmlTemplate = buildOtpMjml(otp, title, subtitle);
  mjmlTemplate = embedLogoInTemplate(mjmlTemplate);
  const { html } = mjml2html(mjmlTemplate);
  return html;
};

/**
 * Password Reset OTP template
 * @param {string} otp
 * @returns {string} compiled HTML
 */
export const generatePasswordResetOTPTemplate = (otp) => {
  const title = 'Password reset';
  const subtitle = 'Use this one-time code to reset your password.';
  const expiryText =
    'This OTP will expire in 10 minutes. If you did not request a password reset, ignore this email or contact your administrator.';
  let mjmlTemplate = buildOtpMjml(otp, title, subtitle, expiryText);
  mjmlTemplate = embedLogoInTemplate(mjmlTemplate);
  const { html } = mjml2html(mjmlTemplate);
  return html;
};

export default {
  generateEmailVerificationOTPTemplate,
  generatePasswordResetOTPTemplate,
};

