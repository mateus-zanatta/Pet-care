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
  | { name: 'vaccine_created' }
  | { name: 'health_event_created' }
  | { name: 'health_report_exported' }
  | { name: 'nearby_search'; source: 'gps' | 'address' }
  // Centrais: só o tipo (nunca texto, telefone, local ou tipo de denúncia).
  | { name: 'central_created'; central: 'adoption' | 'rescue' | 'report' }
  | { name: 'rescue_guide_step'; step: number }
  | { name: 'place_call' }
  | { name: 'place_directions'; app: 'google' | 'waze' | 'apple' }
  | { name: 'place_favorite' }
  | { name: 'place_suggestion'; kind: 'new' | 'fix' }
  | { name: 'rga_import_ok' }
  | { name: 'rga_import_falhou'; reason: string };
