import { extractPhoneNumber } from './phone';

describe('extractPhoneNumber', () => {
  it('extracts number from @c.us chatId', () => {
    expect(extractPhoneNumber('201234567890@c.us')).toBe('201234567890');
  });

  it('extracts number from @lid chatId', () => {
    expect(extractPhoneNumber('20255233581184@lid')).toBe('20255233581184');
  });

  it('returns null for group @g.us chatId', () => {
    expect(extractPhoneNumber('120363000000000001@g.us')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractPhoneNumber('')).toBeNull();
  });

  it('returns null for plain string with no @ suffix', () => {
    expect(extractPhoneNumber('something')).toBeNull();
  });
});
