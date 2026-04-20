import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('AdSlot', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('renders null when env vars are unset', async () => {
    delete process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID;
    delete process.env.NEXT_PUBLIC_ADSENSE_ENABLED;
    const { AdSlot } = await import('@/components/ads/AdSlot');
    const { container } = render(<AdSlot slotId="1234567890" />);
    expect(container.querySelector('ins')).toBeNull();
  });

  it('renders null when only publisher ID is set', async () => {
    process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID = 'ca-pub-1234567890123456';
    process.env.NEXT_PUBLIC_ADSENSE_ENABLED = 'false';
    const { AdSlot } = await import('@/components/ads/AdSlot');
    const { container } = render(<AdSlot slotId="1234567890" />);
    expect(container.querySelector('ins')).toBeNull();
  });

  it('renders an ins with correct data attributes when enabled', async () => {
    process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID = 'ca-pub-1234567890123456';
    process.env.NEXT_PUBLIC_ADSENSE_ENABLED = 'true';
    vi.stubGlobal('adsbygoogle', []);
    const { AdSlot } = await import('@/components/ads/AdSlot');
    render(<AdSlot slotId="1234567890" format="horizontal" className="my-4" />);
    const ins = document.querySelector('ins.adsbygoogle');
    expect(ins).not.toBeNull();
    expect(ins?.getAttribute('data-ad-client')).toBe('ca-pub-1234567890123456');
    expect(ins?.getAttribute('data-ad-slot')).toBe('1234567890');
    expect(ins?.getAttribute('data-ad-format')).toBe('horizontal');
    expect(ins?.getAttribute('data-full-width-responsive')).toBe('true');
  });

  it('pushes to adsbygoogle queue on mount when enabled', async () => {
    process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID = 'ca-pub-1234567890123456';
    process.env.NEXT_PUBLIC_ADSENSE_ENABLED = 'true';
    const queue: unknown[] = [];
    vi.stubGlobal('adsbygoogle', queue);
    const { AdSlot } = await import('@/components/ads/AdSlot');
    render(<AdSlot slotId="9876543210" />);
    expect(queue.length).toBe(1);
  });
});
