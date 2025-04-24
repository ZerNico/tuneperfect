export { VerifyEmail } from "./emails/verify-email";
import { type Options, render } from "@react-email/render";
import { ResetPassword } from "./emails/reset-password";
import type { ResetPasswordProps } from "./emails/reset-password";
import { VerifyEmail, type VerifyEmailProps } from "./emails/verify-email";

export async function renderVerifyEmail(props: VerifyEmailProps) {
  return { html: await render(<VerifyEmail {...props} />), text: await render(<VerifyEmail {...props} />) };
}

export async function renderResetPassword(props: ResetPasswordProps) {
  return { html: await render(<ResetPassword {...props} />), text: await render(<ResetPassword {...props} />) };
}
