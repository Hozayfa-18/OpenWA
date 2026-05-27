export const extractPhoneNumber = (waId: string): string | null => {
  if (waId.endsWith('@c.us')) {
    return waId.slice(0, waId.lastIndexOf('@'));
  }
  return null;
};
