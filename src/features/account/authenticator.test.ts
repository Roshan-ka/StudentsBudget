import { describe, expect, it } from 'vitest';
import { groupedSecret, qrImageSource } from './authenticator';

describe('qrImageSource', () => {
  it('encodes the SVG supabase-js hands over, so a # in it can’t end the URL', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#000"/></svg>';
    const source = qrImageSource(`data:image/svg+xml;utf-8,${svg}`);
    expect(source).toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    expect(source).not.toContain('#');
    expect(decodeURIComponent(source.slice('data:image/svg+xml;charset=utf-8,'.length))).toBe(svg);
  });

  it('passes anything else on as it is', () => {
    expect(qrImageSource('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
  });
});

describe('groupedSecret', () => {
  it('writes the key in groups of four, with no space at the end', () => {
    expect(groupedSecret('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP');
    expect(groupedSecret('JBSWY3DPE')).toBe('JBSW Y3DP E');
    expect(groupedSecret('')).toBe('');
  });
});
