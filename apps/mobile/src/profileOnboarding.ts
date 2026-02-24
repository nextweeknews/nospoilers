type UsernameProfile = {
  username?: string | null;
};

export const profileNeedsOnboarding = (profile?: UsernameProfile | null): boolean => !profile || !profile.username || !profile.username.trim();
