import enAccount from '@/locales/en/account.json';
import enAdoption from '@/locales/en/adoption.json';
import enAuth from '@/locales/en/auth.json';
import enCentrals from '@/locales/en/centrals.json';
import enCommon from '@/locales/en/common.json';
import enErrors from '@/locales/en/errors.json';
import enHealth from '@/locales/en/health.json';
import enHome from '@/locales/en/home.json';
import enLegal from '@/locales/en/legal.json';
import enMeds from '@/locales/en/meds.json';
import enNearby from '@/locales/en/nearby.json';
import enPets from '@/locales/en/pets.json';
import enReport from '@/locales/en/report.json';
import enRescue from '@/locales/en/rescue.json';
import enRga from '@/locales/en/rga.json';
import ptAccount from '@/locales/pt-BR/account.json';
import ptAdoption from '@/locales/pt-BR/adoption.json';
import ptAuth from '@/locales/pt-BR/auth.json';
import ptCentrals from '@/locales/pt-BR/centrals.json';
import ptCommon from '@/locales/pt-BR/common.json';
import ptErrors from '@/locales/pt-BR/errors.json';
import ptHealth from '@/locales/pt-BR/health.json';
import ptHome from '@/locales/pt-BR/home.json';
import ptLegal from '@/locales/pt-BR/legal.json';
import ptMeds from '@/locales/pt-BR/meds.json';
import ptNearby from '@/locales/pt-BR/nearby.json';
import ptPets from '@/locales/pt-BR/pets.json';
import ptReport from '@/locales/pt-BR/report.json';
import ptRescue from '@/locales/pt-BR/rescue.json';
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
    nearby: ptNearby,
    centrals: ptCentrals,
    adoption: ptAdoption,
    rescue: ptRescue,
    report: ptReport,
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
    nearby: enNearby,
    centrals: enCentrals,
    adoption: enAdoption,
    rescue: enRescue,
    report: enReport,
  },
} as const;

export const NAMESPACES = Object.keys(resources[DEFAULT_LOCALE]) as (keyof (typeof resources)['pt-BR'])[];
