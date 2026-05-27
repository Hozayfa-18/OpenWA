export const extractPhoneNumber = (waId: string): string | null => {
  if (waId.endsWith('@c.us') || waId.endsWith('@lid')) {
    return waId.slice(0, waId.lastIndexOf('@'));
  }
  return null;
};
