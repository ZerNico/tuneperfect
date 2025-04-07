import nodemailer from "nodemailer";
import { env } from "./env";

export const mailer = nodemailer.createTransport(env.EMAIL_SMTP_URI);

export async function sendEmail(to: string, subject: string, html: string, text?: string) {
  await mailer.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });
}
