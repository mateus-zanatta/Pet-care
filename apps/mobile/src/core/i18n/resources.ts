import enAccount from '@/locales/en/account.json';
import enAuth from '@/locales/en/auth.json';
import enCommon from '@/locales/en/common.json';
import enErrors from '@/locales/en/errors.json';
import enHealth from '@/locales/en/health.json';
import enHome from '@/locales/en/home.json';
import enLegal from '@/locales/en/legal.json';
import enMeds from '@/locales/en/meds.json';
import enPets from '@/locales/en/pets.json';
import enRga from '@/locales/en/rga.json';
import ptAccount from '@/locales/pt-BR/account.json';
import ptAuth from '@/locales/pt-BR/auth.json';
import ptCommon from '@/locales/pt-BR/common.json';
import ptErrors from '@/locales/pt-BR/errors.json';
import ptHealth from '@/locales/pt-BR/health.json';
import ptHome from '@/locales/pt-BR/home.json';
import ptLegal from '@/locales/pt-BR/legal.json';
import ptMeds from '@/locales/pt-BR/meds.json';
import ptPets from '@/locales/pt-BR/pets.json';
import ptRga from '@/locales/pt-BR/rga.json';

/** Idioma padrão do app: português. */
export const DEFAULT_LOCALE = 'pt-BR' as const;

export const resources = {
  'pt-BR': {
    common: ptCommon,
    auth: ptAuth,
    errors: ptErrors,
    home: ptHome,
    pets: ptPets,
    account: ptAccount,
    legal: ptLegal,
    rga: ptRga,
    meds: ptMeds,
    health: ptHealth,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    errors: enErrors,
    home: enHome,
    pets: enPets,
    account: enAccount,
    legal: enLegal,
    rga: enRga,
    meds: enMeds,
    health: enHealth,
  },
} as const;

export const NAMESPACES = Object.keys(resources[DEFAULT_LOCALE]) as (keyof (typeof resources)['pt-BR'])[];
