import { Body, Container, Head, Heading, Html, Preview, Tailwind, type TailwindConfig, Text } from "@react-email/components";
import type { ReactNode } from "react";

const tailwindConfig: TailwindConfig = {
  theme: {
    fontSize: {
      xs: ["12px", { lineHeight: "16px" }],
      sm: ["14px", { lineHeight: "20px" }],
      base: ["16px", { lineHeight: "24px" }],
      lg: ["18px", { lineHeight: "28px" }],
      xl: ["20px", { lineHeight: "28px" }],
      "2xl": ["24px", { lineHeight: "32px" }],
      "3xl": ["30px", { lineHeight: "36px" }],
      "4xl": ["36px", { lineHeight: "36px" }],
      "5xl": ["48px", { lineHeight: "1" }],
      "6xl": ["60px", { lineHeight: "1" }],
      "7xl": ["72px", { lineHeight: "1" }],
      "8xl": ["96px", { lineHeight: "1" }],
      "9xl": ["144px", { lineHeight: "1" }],
    },
    spacing: {
      px: "1px",
      0: "0",
      0.5: "2px",
      1: "4px",
      1.5: "6px",
      2: "8px",
      2.5: "10px",
      3: "12px",
      3.5: "14px",
      4: "16px",
      5: "20px",
      6: "24px",
      7: "28px",
      8: "32px",
      9: "36px",
      10: "40px",
      11: "44px",
      12: "48px",
      14: "56px",
      16: "64px",
      20: "80px",
      24: "96px",
      28: "112px",
      32: "128px",
      36: "144px",
      40: "160px",
      44: "176px",
      48: "192px",
      52: "208px",
      56: "224px",
      60: "240px",
      64: "256px",
      72: "288px",
      80: "320px",
      96: "384px",
    },
  },
};

export interface ResetPasswordProps {
  resetUrl: string;
  supportEmail: string;
}

export function ResetPassword(props: ResetPasswordProps): ReactNode {
  const currentYear = new Date().getFullYear();

  return (
    <Html>
      <Head />
      <Preview>Reset your Password</Preview>
      <Tailwind config={tailwindConfig}>
        <Body className="mx-auto my-auto bg-[#203141] px-2 py-10 font-sans text-slate-800">
          <Container className="mx-auto max-w-[465px] py-5 text-center">
            <Heading className="m-0 font-semibold text-[30px] text-white">Tune Perfect</Heading>
          </Container>
          <Container className="mx-auto w-full max-w-[465px] rounded-lg bg-white p-[32px]">
            <Heading className="m-0 font-semibold text-[20px]">Reset your Password</Heading>
            <Text className="m-0 text-slate-500">Click the button below to reset your password.</Text>

            <Text className="m-0 py-12 text-center">
              <a
                href={props.resetUrl}
                target="_blank"
                className="box-border inline-block w-full rounded-lg px-4 py-2 font-semibold text-[14px] text-white no-underline shadow-md"
                rel="noreferrer"
                style={{
                  background: "linear-gradient(to right, #36d1dc, #5b86e5)",
                }}
              >
                Reset Password
              </a>
            </Text>

            <Text className="m-0">If you didn't request this, you can safely ignore this email.</Text>
          </Container>
          <Container className="mx-auto max-w-[465px] py-5 text-center text-white">
            <Text className="m-0">
              Need help?{" "}
              <a href={`mailto:${props.supportEmail}`} target="_blank" className="text-white no-underline" rel="noreferrer">
                Contact Support
              </a>
            </Text>
            <Text className="m-0">© {currentYear} Tune Perfect.</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

ResetPassword.PreviewProps = {
  resetUrl: "https://tuneperfect.localhost/reset-password?token=example-token",
  supportEmail: "support@tuneperfect.localhost",
} satisfies ResetPasswordProps;

export default ResetPassword;
