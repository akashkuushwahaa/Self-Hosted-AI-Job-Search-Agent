import nodemailer, { type Transporter } from "nodemailer";

// Email is optional: only password reset uses it. SMTP_URL is any SMTP server you already have,
// e.g. smtp://user:pass@smtp.example.com:587 (or smtps:// for port 465). SMTP_URL=log prints the
// message to the server console instead: enough to reset your own password on a local install.
const SMTP_URL = process.env.SMTP_URL;
const FROM = process.env.MAIL_FROM ?? "Shortlist <shortlist@localhost>";

export const mailEnabled = Boolean(SMTP_URL);

let transport: Transporter | undefined;

export async function sendMail({ to, subject, text }: { to: string; subject: string; text: string }) {
  if (!SMTP_URL) throw new Error("SMTP_URL is not set");
  if (SMTP_URL === "log") {
    console.log(`\n[mail] to ${to}: ${subject}\n${text}\n`);
    return;
  }
  transport ??= nodemailer.createTransport(SMTP_URL);
  await transport.sendMail({ from: FROM, to, subject, text });
}
