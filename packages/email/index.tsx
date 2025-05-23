export { VerifyEmail } from "./emails/verify-email";
import { render } from "@react-email/render";
import { ResetPassword } from "./emails/reset-password";
import type { ResetPasswordProps } from "./emails/reset-password";
import { VerifyEmail, type VerifyEmailProps } from "./emails/verify-email";

export async function renderVerifyEmail(props: VerifyEmailProps) {
  const html = await render(<VerifyEmail {...props} />);
  const text = await render(<VerifyEmail {...props} />, {
    plainText: true,
  });

  return { html, text };
}

export async function renderResetPassword(props: ResetPasswordProps) {
  const html = await render(<ResetPassword {...props} />);
  const text = await render(<ResetPassword {...props} />, {
    plainText: true,
  });

  return { html, text };
}
