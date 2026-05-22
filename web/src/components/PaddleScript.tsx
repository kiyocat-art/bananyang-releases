'use client';
import Script from 'next/script';

declare global {
  interface Window {
    Paddle?: {
      Environment: { set: (env: 'production' | 'sandbox') => void };
      Initialize: (config: { token: string; eventCallback?: (event: unknown) => void }) => void;
      Checkout: {
        open: (options: { items?: Array<{ priceId: string; quantity: number }>; checkoutId?: string; customer?: { email?: string } }) => void;
        close: () => void;
      };
    };
  }
}

export function PaddleScript() {
  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;

  return (
    <Script
      src="https://cdn.paddle.com/paddle/v2/paddle.js"
      strategy="afterInteractive"
      onLoad={() => {
        if (!window.Paddle) return;
        const env = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';
        window.Paddle.Environment.set(env as 'production' | 'sandbox');
        if (clientToken) {
          window.Paddle.Initialize({ token: clientToken });
        }
      }}
    />
  );
}
