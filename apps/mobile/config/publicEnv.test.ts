import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * "ESCONDER AS VARIÁVEIS DO FRONT": num app, tudo que vai junto (código e variáveis EXPO_PUBLIC_*) pode ser
 * extraído do aparelho. Então a regra não é esconder, é NUNCA colocar segredo no app. Segredos (chave do Resend,
 * do RevenueCat, conta de serviço...) ficam só nas Cloud Functions (Secret Manager). Este teste quebra o build
 * se alguém tentar colocar um segredo no app por engano.
 */
const APP = resolve(__dirname, '..');

/** Variáveis públicas permitidas, e por que cada uma pode ser pública. */
const ALLOWED_PUBLIC: Record<string, string> = {
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'ID do cliente OAuth: identifica o app no Google, não dá acesso a nada sozinho.',
  EXPO_PUBLIC_SENTRY_DSN: 'DSN do Sentry é feito para ficar no app (só permite ENVIAR erros).',
  EXPO_PUBLIC_POSTHOG_KEY: 'Chave de projeto do PostHog é pública por definição (só envia eventos).',
  EXPO_PUBLIC_POSTHOG_HOST: 'Endereço do servidor do PostHog.',
  EXPO_PUBLIC_USE_EMULATORS: 'Liga os emuladores locais em desenvolvimento.',
  EXPO_PUBLIC_EMULATOR_HOST: 'IP do computador dos emuladores em desenvolvimento.',
};

const SECRET_NAME = /SECRET|PRIVATE|PASSWORD|PASSWD|SERVICE_ACCOUNT|RESEND|REVENUECAT_(SECRET|API_KEY_SECRET)|STRIPE|ADMIN/i;
/** Formatos de chaves secretas conhecidas (não podem aparecer no código do app). */
const SECRET_VALUE = [
  /-----BEGIN (RSA )?PRIVATE KEY-----/,
  /\bsk_(live|test)_[A-Za-z0-9]{10,}/, // Stripe/RevenueCat secret
  /\bre_[A-Za-z0-9]{20,}/, // Resend
  /"private_key_id"\s*:/, // conta de serviço do Google
  /\bAIza[0-9A-Za-z_-]{35}\b/, // chave de API do Google escrita no código (use variável de ambiente)
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|json)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const files = [...walk(join(APP, 'src')), join(APP, 'app.config.ts'), join(APP, '.env.example')];
const contents = files.map((f) => ({ file: f.replace(APP, ''), text: readFileSync(f, 'utf8') }));

describe('variáveis do app (front-end)', () => {
  const used = new Set(contents.flatMap(({ text }) => text.match(/EXPO_PUBLIC_[A-Z0-9_]+/g) ?? []));

  it('só usa variáveis públicas conhecidas e justificadas', () => {
    expect([...used].filter((name) => !(name in ALLOWED_PUBLIC))).toEqual([]);
  });

  it('nenhuma variável pública tem nome de segredo', () => {
    expect([...used].filter((name) => SECRET_NAME.test(name))).toEqual([]);
  });

  it('nenhum arquivo do app contém uma chave secreta', () => {
    const leaks = contents.flatMap(({ file, text }) => SECRET_VALUE.filter((re) => re.test(text)).map((re) => `${file}: ${re}`));
    expect(leaks).toEqual([]);
  });
});
