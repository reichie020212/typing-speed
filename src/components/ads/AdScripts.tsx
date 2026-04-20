import Script from 'next/script';
import { env } from '@/env';

export function AdScripts() {
  const pub = env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID;
  const enabled = env.NEXT_PUBLIC_ADSENSE_ENABLED === 'true';
  if (!pub || !enabled) return null;
  return (
    <>
      <Script
        id="funding-choices"
        async
        strategy="afterInteractive"
        src={`https://fundingchoicesmessages.google.com/i/${pub}?ers=1`}
      />
      <Script
        id="adsense"
        async
        crossOrigin="anonymous"
        strategy="afterInteractive"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${pub}`}
      />
    </>
  );
}
