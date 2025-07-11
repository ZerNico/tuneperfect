const en = {
  signIn: {
    title: "Sign in",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    forgotPassword: "Forgot password?",
    emailInvalid: "Invalid email",
    passwordMinLength: "Password must be at least 6 characters",
    invalidEmailOrPassword: "Invalid email or password",
    or: "Or",
    noAccount: "Don't have an account?",
    signUp: "Sign up",
  },
  signUp: {
    title: "Sign up",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm password",
    signUp: "Sign up",
    emailInvalid: "Invalid email",
    passwordMinLength: "Password must be at least 6 characters",
    passwordsDontMatch: "Passwords do not match",
    emailAlreadyExists: "Email already exists",
    success: "Account created successfully",
    or: "Or",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
    privacyPolicy: "By signing up, you agree to our {{ privacyLink }} and {{ termsLink }}.",
    privacyPolicyPrefix: "By signing up, you agree to our",
    privacyPolicyMiddle: "and",
    privacyPolicySuffix: ".",
    privacyPolicyLink: "Privacy Policy",
    termsOfServiceLink: "Terms of Service",
  },
  forgotPassword: {
    title: "Forgot Password",
    description: "Enter your email and we'll send you a link to reset your password.",
    emailSent: "If an account exists with this email, a password reset link has been sent.",
    sendResetLink: "Send Reset Link",
    rememberedPassword: "Remembered your password?",
  },
  resetPassword: {
    title: "Reset Password",
    description: "Enter your new password below to complete the password reset process.",
    code: "Reset Code",
    codePlaceholder: "Enter the code from your email",
    token: "Reset Token",
    newPassword: "New Password",
    confirmPassword: "Confirm Password",
    resetPassword: "Reset Password",
    success: "Your password has been reset successfully. Redirecting to sign in...",
    rememberedPassword: "Remembered your password?",
    passwordsDontMatch: "Passwords do not match",
    invalidOrExpiredToken: "Invalid or expired reset link",
    passwordTooShort: "Password must be at least 8 characters",
    passwordMinLength: "Password must be at least 8 characters",
  },
  common: {
    backToSignIn: "Back to Sign In",
    loading: "Loading...",
    save: "Save",
    cancel: "Cancel",
    back: "Back",
  },
  verifyEmail: {
    title: "Verify your email",
    description:
      "Please check your email for a verification link. If you haven't received it, you can request a new one below.",
    email: "Email",
    emailInvalid: "Invalid email",
    resend: "Resend verification email",
    success: "Verification email sent if account exists",
    error: "Failed to send verification email",
  },
  completeProfile: {
    title: "Complete your profile",
    username: "Username",
    usernameMinLength: "Username must be at least 3 characters",
    usernameMaxLength: "Username must be at most 20 characters",
    usernameInvalid: "Username can only contain letters, numbers, and underscores",
    usernameAlreadyTaken: "Username is already taken",
    submit: "Complete profile",
  },
  editProfile: {
    title: "Edit Profile",
    username: "Username",
    usernameMinLength: "Username must be at least 3 characters",
    usernameMaxLength: "Username must be at most 20 characters",
    usernameInvalid: "Username can only contain letters, numbers, and underscores",
    usernameAlreadyTaken: "Username is already taken",
    save: "Save Changes",
    changePassword: "Change Password",
    success: "Profile updated successfully",
    invalidFileType: "Please select an image file",
    cropImage: "Crop Profile Picture",
  },
  imageCrop: {
    zoomOut: "Zoom Out",
    zoomIn: "Zoom In",
    confirm: "Confirm",
  },
  changePassword: {
    title: "Change Password",
    currentPassword: "Current Password",
    currentPasswordRequired: "Current password is required",
    newPassword: "New Password",
    confirmPassword: "Confirm Password",
    passwordMinLength: "Password must be at least 8 characters",
    passwordsDontMatch: "Passwords do not match",
    save: "Save Changes",
    success: "Password changed successfully",
  },
  join: {
    title: "Join Lobby",
    description: "Enter the code of the lobby you want to join",
    lobbyNotFound: "Lobby not found",
    lobbyCode: "Code",
    codeMinLength: "Lobby code must be 8 characters",
    codeMaxLength: "Lobby code must be 8 characters",
    lobbyJoined: "Successfully joined lobby",
    join: "Join",
  },
  clubs: {
    title: "Clubs",
    yourClubs: "Your Clubs",
    create: "Create Club",
    invites: "Invites",
    invitedBy: "Invited by {{ username }}",
    accept: "Accept",
    decline: "Decline",
    members: "{{ count }} members",
    membersOne: "{{ count }} member",
    membersOther: "{{ count }} members",
    noClubs: "You don't have any clubs yet",
    noClubsDescription: "Get started by creating a new club.",
    name: "Club Name",
    nameMinLength: "Name must be at least {{ minLength }} characters",
    nameMaxLength: "Name must be at most {{ maxLength }} characters",
    alreadyMember: "{{ username }} is already a member of this club",
    userNotFound: "User not found",
    detail: {
      delete: "Delete",
      leave: "Leave Club",
      leaveConfirmation: "Are you sure you want to leave this club?",
      invite: "Invite",
      inviteMember: "Invite Member",
      deleteConfirmation: "Are you sure you want to delete this club? This action cannot be undone.",
      removeMember: "Remove Member",
      removeMemberConfirmation:
        "Are you sure you want to remove {{ username }} from this club? This action cannot be undone.",
      transferOwnership: "Transfer Ownership",
      transferOwnershipConfirmation:
        "Are you sure you want to transfer ownership of this club to {{ username }}? This action cannot be undone.",
      inviteDescription: "Enter the username of the user you want to invite to this club.",
      inviteUsername: "Username",
      usernameRequired: "Username is required",
      username: "Username",
      changeRole: "Change Role",
      changeRoleConfirmation: "Are you sure you want to change {{ username }}'s role to {{ role }}?",
      makeAdmin: "Make Admin",
      removeAdmin: "Remove Admin",
      rename: "Rename Club",
      renameDescription: "Enter a new name for this club.",
      newName: "New Name",
      nameRequired: "Club name is required",
      backToClubs: "Back to clubs",
      roleMember: "Member",
      roleAdmin: "Admin",
      roleOwner: "Owner",
    },
  },
  error: {
    unknown: "An unknown error occurred",
    rateLimit: "Rate limit exceeded, retry in {{ retryAfter }} seconds",
  },
  toast: {
    success: "Success",
    error: "Error",
    info: "Info",
    warning: "Warning",
  },
  header: {
    appName: "Tune Perfect",
    editProfile: "Edit profile",
    leaveLobby: "Leave lobby",
    signOut: "Sign out",
  },
  nav: {
    profile: "Profile",
    lobby: "Lobby",
    join: "Join",
    clubs: "Clubs",
  },
  lobby: {
    title: "Lobby",
    inviteToClub: "Invite to Club",
    selectClub: "Select Club",
    selectClubDescription: "Choose which club to invite {{ username }} to:",
    invite: "Invite",
    inviteUser: "Invite {{ username }}",
    memberInvited: "Successfully invited {{ username }} to {{ clubName }}",
    noClubsToInvite: "You don't have permission to invite members to any clubs",
    noUsers: "No one else is here",
    noUsersDescription: "You are currently the only one in the lobby.",
  },
};

export type Dict = typeof en;
export type DictEn = typeof en;
export const dict = en;
