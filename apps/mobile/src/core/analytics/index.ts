import PostHog from 'posthog-react-native';
import type { AnalyticsEvent } from './events';

let client: PostHog | null = null;

/** PostHog só liga com chave configurada, sem autocaptura, sem identificar a pessoa. */
export function initAnalytics(): void {
  const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (!key || client) return;
  client = new PostHog(key, {
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    captureAppLifecycleEvents: false,
    enableSessionReplay: false,
    // Sem identify(): os eventos ficam ligados a um ID anônimo do aparelho.
  });
}

export function track(event: AnalyticsEvent): void {
  const { name, ...properties } = event;
  if (__DEV__) console.log(`[analytics] ${name}`, properties);
  client?.capture(name, properties);
}
