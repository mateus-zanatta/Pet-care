import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { bucket, db } from '../admin';
import { callableOptions } from '../config';
import { requireRegistered } from './common';
import * as h from './handlers';

/**
 * Centrais de adoção, resgate e denúncia. PRIVACIDADE: os logs registram só o tipo de ação, nunca texto,
 * telefone ou coordenadas. Todas exigem conta (não anônima) e as criações têm limite diário.
 */
type Handler = (uid: string, request: CallableRequest) => Promise<unknown>;

function central(event: string, handler: Handler) {
  return onCall({ ...callableOptions, memory: '256MiB' }, async (request) => {
    const uid = requireRegistered(request);
    const result = await handler(uid, request);
    logger.info(event);
    return result;
  });
}

const deps = () => ({ db: db(), bucket: bucket(), now: new Date() });

export const createAdoption = central('adoption_created', (uid, r) =>
  h.createAdoption(uid, (r.auth?.token.name as string | undefined) ?? undefined, r.data, deps()),
);
export const updateAdoption = central('adoption_updated', (uid, r) => h.updateAdoption(uid, r.data, deps()));
export const deleteAdoption = central('adoption_deleted', (uid, r) => h.deleteAdoption(uid, r.data, deps()));

export const createRescueAlert = central('rescue_alert_created', (uid, r) => h.createRescueAlert(uid, r.data, deps()));
export const updateRescueAlert = central('rescue_alert_updated', (uid, r) => h.updateRescueAlert(uid, r.data, deps()));
export const deleteRescueAlert = central('rescue_alert_deleted', (uid, r) => h.deleteRescueAlert(uid, r.data, deps()));

export const createReport = central('report_created', (uid, r) => h.createReport(uid, r.data, deps()));
export const attachReportPhotos = central('report_photos_attached', (uid, r) => h.attachReportPhotos(uid, r.data, deps()));
