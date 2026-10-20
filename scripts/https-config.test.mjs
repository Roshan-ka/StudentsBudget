import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { certHosts, certPaths, httpsPort, phoneUrls, privateIPv4s } from './https-config.mjs';

/** One row of what `os.networkInterfaces()` returns. */
const ipv4 = (address, internal = false) => ({ address, family: 'IPv4', internal });

describe('privateIPv4s', () => {
  it('keeps 10/8, 172.16/12 and 192.168/16', () => {
    const found = privateIPv4s({
      Ethernet: [ipv4('10.1.2.3')],
      'vEthernet (WSL)': [ipv4('172.16.0.5'), ipv4('172.31.255.1')],
      'Wi-Fi': [ipv4('192.168.0.137')],
    });
    expect(found).toEqual(['10.1.2.3', '172.16.0.5', '172.31.255.1', '192.168.0.137']);
  });

  it('skips addresses that are not private, including the edges of 172.16/12', () => {
    expect(
      privateIPv4s({
        Ethernet: [ipv4('8.8.8.8'), ipv4('172.15.0.1'), ipv4('172.32.0.1'), ipv4('169.254.10.20'), ipv4('192.169.0.1')],
      }),
    ).toEqual([]);
  });

  it('skips internal interfaces and anything that is not IPv4', () => {
    expect(
      privateIPv4s({
        Loopback: [ipv4('127.0.0.1', true), ipv4('10.0.0.1', true)],
        'Wi-Fi': [{ address: 'fe80::1', family: 'IPv6', internal: false }, ipv4('192.168.1.20')],
      }),
    ).toEqual(['192.168.1.20']);
  });

  it('lists an address once, and copes with an interface that has no addresses', () => {
    expect(privateIPv4s({ a: [ipv4('192.168.1.20')], b: [ipv4('192.168.1.20')], c: undefined })).toEqual([
      '192.168.1.20',
    ]);
  });

  it('accepts the numeric family that older Node versions report', () => {
    expect(privateIPv4s({ Ethernet: [{ address: '10.0.0.7', family: 4, internal: false }] })).toEqual(['10.0.0.7']);
  });
});

describe('phoneUrls', () => {
  it('gives an https address for every IP, then the .local name', () => {
    expect(phoneUrls(['192.168.0.137', '10.0.0.2'], 'JOKU-PC', 3443)).toEqual([
      'https://192.168.0.137:3443',
      'https://10.0.0.2:3443',
      'https://JOKU-PC.local:3443',
    ]);
  });

  it('gives just the .local name when no private address was found', () => {
    expect(phoneUrls([], 'laptop', 4000)).toEqual(['https://laptop.local:4000']);
  });

  it('does not double a .local suffix or keep a domain', () => {
    expect(phoneUrls([], 'Mac.local', 3443)).toEqual(['https://Mac.local:3443']);
    expect(phoneUrls([], 'pc.corp.example.com', 3443)).toEqual(['https://pc.local:3443']);
  });
});

describe('certPaths', () => {
  it('defaults to certs/ in the given folder', () => {
    const cwd = path.resolve('project');
    expect(certPaths({}, cwd)).toEqual({
      cert: path.join(cwd, 'certs', 'studentsbudget.pem'),
      key: path.join(cwd, 'certs', 'studentsbudget-key.pem'),
    });
  });

  it('takes HTTPS_CERT and HTTPS_KEY when set, and treats empty values as unset', () => {
    const cwd = path.resolve('project');
    const elsewhere = path.resolve('elsewhere');
    expect(certPaths({ HTTPS_CERT: path.join(elsewhere, 'c.pem'), HTTPS_KEY: path.join(elsewhere, 'k.pem') }, cwd)).toEqual({
      cert: path.join(elsewhere, 'c.pem'),
      key: path.join(elsewhere, 'k.pem'),
    });
    expect(certPaths({ HTTPS_CERT: '', HTTPS_KEY: '' }, cwd).cert).toBe(path.join(cwd, 'certs', 'studentsbudget.pem'));
  });

  it('resolves a relative override against the given folder', () => {
    const cwd = path.resolve('project');
    expect(certPaths({ HTTPS_CERT: 'my.pem', HTTPS_KEY: 'my-key.pem' }, cwd)).toEqual({
      cert: path.join(cwd, 'my.pem'),
      key: path.join(cwd, 'my-key.pem'),
    });
  });
});

describe('certHosts', () => {
  it('names localhost, 127.0.0.1, every private IP and the .local name', () => {
    expect(certHosts(['192.168.0.137', '10.0.0.2'], 'JOKU-PC')).toEqual([
      'localhost',
      '127.0.0.1',
      '192.168.0.137',
      '10.0.0.2',
      'JOKU-PC.local',
    ]);
  });

  it('still names localhost and the .local name without any private IP', () => {
    expect(certHosts([], 'laptop')).toEqual(['localhost', '127.0.0.1', 'laptop.local']);
  });
});

describe('httpsPort', () => {
  it('defaults to 3443, never 3000', () => {
    expect(httpsPort({})).toBe(3443);
    expect(httpsPort({ HTTPS_PORT: '' })).toBe(3443);
  });

  it('takes HTTPS_PORT', () => {
    expect(httpsPort({ HTTPS_PORT: '3444' })).toBe(3444);
  });

  it('rejects a value that is not a port number', () => {
    for (const bad of ['abc', '0', '70000', '34.5', '-1']) {
      expect(() => httpsPort({ HTTPS_PORT: bad })).toThrow(/HTTPS_PORT/);
    }
  });
});
