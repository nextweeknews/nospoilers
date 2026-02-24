export const normalizeUsername = (input: string): string => input.trim().toLowerCase();

export const isUsernameFormatValid = (input: string): boolean => /^[a-z0-9_]{3,16}$/.test(normalizeUsername(input));
