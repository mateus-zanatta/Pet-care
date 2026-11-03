/**
 * Eventos de analytics: lista FECHADA e sem propriedades livres.
 * Nada de conteúdo de denúncia, localização precisa, nomes ou valores do RG (LGPD).
 * Para adicionar um evento, inclua-o aqui — assim todo o time vê o que é medido.
 */
export type AnalyticsEvent =
  | { name: 'app_opened' }
  | { name: 'sign_up'; method: 'password' | 'google' | 'apple' }
  | { name: 'sign_in'; method: 'password' | 'google' | 'apple' | 'anonymous' }
  | { name: 'sign_out' }
  | { name: 'account_deleted' }
  | { name: 'pet_created'; origin: 'manual' | 'rescue' | 'rga_import' }
  | { name: 'pet_deleted' }
  | { name: 'medication_created' }
  | { name: 'dose_logged'; outcome: 'given' | 'skipped' }
  | { name: 'rga_import_ok' }
  | { name: 'rga_import_falhou'; reason: string };
