import nodemailer from 'nodemailer';

export type Delivery = 'email' | 'console';

const smtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transport: nodemailer.Transporter | null = null;

const getTransport = () => {
  if (transport) return transport;
  const port = Number(process.env.SMTP_PORT || 587);
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 is implicit TLS; 587 upgrades with STARTTLS.
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transport;
};

const body = (name: string, code: string) => ({
  subject: `${code} is your Can Ai verification code`,
  text: [
    `Hi ${name},`,
    '',
    `Your Can Ai verification code is: ${code}`,
    '',
    'It expires in 15 minutes. If you didn\'t sign up, you can ignore this email.',
  ].join('\n'),
  html: `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:420px;color:#0b1512">
      <p>Hi ${escapeHtml(name)},</p>
      <p>Your Can Ai verification code is:</p>
      <p style="font:700 30px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.18em;
                background:#f1f4f3;border:1px solid #dde3e1;border-radius:8px;
                padding:14px 18px;text-align:center;margin:18px 0">${code}</p>
      <p style="color:#5f6d69;font-size:14px">
        It expires in 15 minutes. If you didn't sign up, you can ignore this email.
      </p>
    </div>`,
});

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );

/**
 * True only when there is no mail server AND we're running in development.
 * In that case the code is echoed to the browser so verification is usable
 * out of the box; a deployed instance with NODE_ENV=production never does.
 */
export const canRevealCode = (): boolean =>
  !smtpConfigured() && process.env.NODE_ENV !== 'production';

/**
 * Send the code. With SMTP configured it goes to the real inbox; without it the
 * code is printed to the terminal running the app, and echoed back in dev so
 * the UI can show it. The caller is told which happened, so it never claims an
 * email that did not leave.
 */
export const sendVerificationCode = async (
  to: string,
  name: string,
  code: string
): Promise<{ delivery: Delivery; error?: string; devCode?: string }> => {
  const message = body(name, code);

  if (!smtpConfigured()) {
    printToConsole(to, code);
    return { delivery: 'console', devCode: canRevealCode() ? code : undefined };
  }

  try {
    await getTransport().sendMail({
      from: process.env.SMTP_FROM || `Can Ai <${process.env.SMTP_USER}>`,
      to,
      ...message,
    });
    return { delivery: 'email' };
  } catch (error) {
    // A failed send must not strand the user with no way to get the code.
    printToConsole(to, code);
    return {
      delivery: 'console',
      error: error instanceof Error ? error.message : 'SMTP send failed',
      devCode: canRevealCode() ? code : undefined,
    };
  }
};

const printToConsole = (to: string, code: string) => {
  const line = '─'.repeat(46);
  console.log(
    `\n${line}\n  Verification code for ${to}\n\n      ${code}\n\n` +
      `  Expires in 15 minutes.\n  Set SMTP_* in .env.local to email these instead.\n${line}\n`
  );
};

export const mailerStatus = () => ({
  configured: smtpConfigured(),
  host: process.env.SMTP_HOST ?? null,
});
