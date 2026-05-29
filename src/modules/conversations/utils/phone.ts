export const extractPhoneNumber = (waId: string): string | null => {
  if (waId.endsWith('@c.us')) {
    return waId.slice(0, waId.lastIndexOf('@'));
  }
  if (/^\+?\d+$/.test(waId)) {
    return waId;
  }
  return null;
};
