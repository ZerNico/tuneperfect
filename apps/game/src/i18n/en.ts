const en = {
  sign_in: {
    title: "Sign in",
    email: "Email",
    password: "Password",
    sign_in: "Sign in",
    forgot_password: "Forgot password?",
    email_invalid: "Invalid email",
    password_min_length: "Password must be at least 6 characters",
    invalid_email_or_password: "Invalid email or password",
    or: "Or",
    no_account: "Don't have an account?",
    sign_up: "Sign up",
  },
  sign_up: {
    title: "Sign up",
    email: "Email",
    password: "Password",
    confirm_password: "Confirm password",
    sign_up: "Sign up",
    email_invalid: "Invalid email",
    password_min_length: "Password must be at least 6 characters",
    passwords_dont_match: "Passwords do not match",
    email_already_exists: "Email already exists",
    success: "Account created successfully",
    or: "Or",
    have_account: "Already have an account?",
    sign_in: "Sign in",
  },
  verify_email: {
    title: "Verify your email",
    description: "Please check your email for a verification link. If you haven't received it, you can request a new one below.",
    email: "Email",
    email_invalid: "Invalid email",
    resend: "Resend verification email",
    success: "Verification email sent successfully",
    error: "Failed to send verification email",
  },
  error: {
    unknown: "An unknown error occurred",
  },
  toast: {
    success: "Success",
    error: "Error",
    info: "Info",
    warning: "Warning",
  },
  header: {
    app_name: "Tune Perfect",
    edit_profile: "Edit profile",
    leave_lobby: "Leave lobby",
    sign_out: "Sign out",
  },
  nav: {
    profile: "Profile",
  },
};

export type Dict = typeof en;
export type DictEn = typeof en;
export const dict = en;
