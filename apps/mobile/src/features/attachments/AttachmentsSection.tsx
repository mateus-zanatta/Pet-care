import { type AttachmentRef, MAX_ATTACHMENTS } from '@petcare/shared';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { reportError } from '@/core/errors/report';
import { PermissionDeniedError, pickFromGallery, takePhoto } from '@/features/pets/usePhotoPicker';
import {
  AttachmentError,
  type AttachmentSource,
  type AttachmentTarget,
  addAttachment,
  openAttachment,
  pickPdf,
  removeAttachment,
} from './attachments.service';

type Props = {
  target: AttachmentTarget;
  attachments: readonly AttachmentRef[];
  /** Dono e cuidador podem anexar e remover; visualizador só abre. */
  canEdit: boolean;
  /** Título da seção (ex.: "Foto da receita e anexos"). */
  title?: string;
};

/** "1.2 MB" / "340 KB". */
export function formatFileSize(bytes: number, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (bytes >= 1024 * 1024) return t('attachments.mb', { size: (bytes / (1024 * 1024)).toFixed(1) });
  return t('attachments.kb', { size: Math.max(1, Math.round(bytes / 1024)) });
}

/**
 * Anexos de um registro: fotos (câmera/galeria, sem recorte) e PDFs. Fotos são recodificadas (sem localização).
 * A lista vem do documento em tempo real; esta tela só envia, abre e remove.
 */
export function AttachmentsSection({ target, attachments, canEdit, title }: Props) {
  const { t } = useTranslation('health');
  const { t: te } = useTranslation('errors');
  const { t: tc } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const run = async (source: () => Promise<AttachmentSource | null>) => {
    setError(undefined);
    setBusy(true);
    try {
      const picked = await source();
      if (picked) await addAttachment(target, picked, attachments);
    } catch (e) {
      if (e instanceof PermissionDeniedError) setError(te('permissions.cameraDenied'));
      else if (e instanceof AttachmentError) setError(t(`attachments.${e.code === 'too_large' ? 'tooLarge' : e.code}`));
      else {
        reportError('attachments.add', e);
        setError(t('attachments.failed'));
      }
    } finally {
      setBusy(false);
    }
  };

  const asPhoto = async (pick: () => Promise<{ uri: string; width: number; height: number } | null>): Promise<AttachmentSource | null> => {
    const photo = await pick();
    return photo ? { kind: 'photo', photo } : null;
  };

  const open = async (attachment: AttachmentRef) => {
    try {
      await openAttachment(attachment);
    } catch (e) {
      reportError('attachments.open', e);
      setError(t('attachments.openFailed'));
    }
  };

  const remove = (attachment: AttachmentRef) =>
    Alert.alert(t('attachments.removeTitle'), t('attachments.removeBody'), [
      { text: tc('actions.cancel'), style: 'cancel' },
      {
        text: t('attachments.remove', { name: attachment.name }),
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          setError(undefined);
          removeAttachment(target, attachment)
            .catch((e) => {
              reportError('attachments.remove', e);
              setError(t('attachments.removeFailed'));
            })
            .finally(() => setBusy(false));
        },
      },
    ]);

  const full = attachments.length >= MAX_ATTACHMENTS;

  return (
    <View style={{ gap: 12 }} testID="attachments-section">
      <AppText variant="title">{title ?? t('attachments.title')}</AppText>
      {error ? <Banner tone="error">{error}</Banner> : null}

      {attachments.length === 0 ? (
        <AppText color="textMuted">{t('attachments.empty')}</AppText>
      ) : (
        attachments.map((attachment) => (
          <Card key={attachment.id} testID={`attachment-${attachment.id}`}>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Icon name={attachment.contentType === 'application/pdf' ? 'document-text' : 'image'} color="primary" size={32} />
                <View style={{ flex: 1 }}>
                  <AppText variant="heading">{attachment.name}</AppText>
                  <AppText variant="caption" color="textMuted">
                    {formatFileSize(attachment.size, t as never)}
                  </AppText>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Button variant="secondary" icon="open" label={t('attachments.open', { name: attachment.name })} onPress={() => void open(attachment)} />
                </View>
                {canEdit ? (
                  <View style={{ flex: 1 }}>
                    <Button variant="secondary" icon="trash" label={t('attachments.remove', { name: attachment.name })} disabled={busy} onPress={() => remove(attachment)} />
                  </View>
                ) : null}
              </View>
            </View>
          </Card>
        ))
      )}

      {canEdit ? (
        <View style={{ gap: 8 }}>
          {full ? <Banner tone="warning">{t('attachments.limit')}</Banner> : null}
          <Button
            icon="camera"
            variant="secondary"
            label={busy ? t('attachments.adding') : t('attachments.takePhoto')}
            disabled={busy || full}
            onPress={() => void run(() => asPhoto(() => takePhoto({ crop: false })))}
          />
          <Button
            icon="image"
            variant="secondary"
            label={t('attachments.pickPhoto')}
            disabled={busy || full}
            onPress={() => void run(() => asPhoto(() => pickFromGallery({ crop: false })))}
          />
          <Button
            icon="document-text"
            variant="secondary"
            label={t('attachments.pickPdf')}
            disabled={busy || full}
            onPress={() => void run(async () => {
              const pdf = await pickPdf();
              return pdf ? { kind: 'pdf', ...pdf } : null;
            })}
          />
          <AppText variant="caption" color="textMuted">
            {t('attachments.hint')}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
