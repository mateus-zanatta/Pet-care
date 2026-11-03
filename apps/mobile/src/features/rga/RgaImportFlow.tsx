import {
  PET_FORM_DEFAULTS,
  type Pet,
  type PetFormValues,
  type RgaImportResult,
  type Sex,
  type Species,
  type TriState,
  petFormToData,
  petToFormValues,
} from '@petcare/shared';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { LoadingView } from '@/components/ui/states';
import { track } from '@/core/analytics';
import { formatIsoDate } from '@/core/dates';
import { reportError, reportRgaImportFailure } from '@/core/errors/report';
import { useUser } from '@/features/auth/AuthProvider';
import { PetForm, type PhotoChange } from '@/features/pets/PetForm';
import { usePetPhotoUrl } from '@/features/pets/hooks';
import {
  type PetExtra,
  createPet,
  findPetByRga,
  removePetPhoto,
  updatePet,
} from '@/features/pets/pets.repo';
import { uploadPhotoAfterSave } from '@/features/pets/photoUpload';
import { type FieldChange, diffFormValues, mergePlaceChanges } from './rga.diff';
import { type RgaPrefill, rgaResultToPrefill } from './rga.mapper';
import { RgaFileError, classifyImportError, importRgaFile, pickRgaFile, rgaPhotoDataUri } from './rga.service';

type Props = {
  /** Se informado, os dados do RG ATUALIZAM este pet (em vez de criar um novo). */
  existingPet?: Pet;
};

type Review = { prefill: RgaPrefill; result: RgaImportResult; photo?: RgaPhoto; target?: Pet };
type RgaPhoto = { uri: string; base64: string };
type Phase =
  | { name: 'start'; error?: string }
  | { name: 'reading' }
  | { name: 'duplicate'; duplicate: Pet; result: RgaImportResult; photo?: RgaPhoto; changes: FieldChange[] }
  | { name: 'review'; review: Review };

export function RgaImportFlow({ existingPet }: Props) {
  const { t, i18n } = useTranslation('rga');
  const { t: tp } = useTranslation('pets');
  const { t: te } = useTranslation('errors');
  const router = useRouter();
  const user = useUser();
  const locale = i18n.language === 'en' ? 'en' : 'pt-BR';

  const [phase, setPhase] = useState<Phase>({ name: 'start' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const targetPet = phase.name === 'review' ? phase.review.target : undefined;
  const targetPhotoUrl = usePetPhotoUrl(targetPet);

  /* ------------------------------ Escolher e ler ------------------------------ */

  const choose = async () => {
    let file;
    try {
      file = await pickRgaFile();
    } catch (error) {
      const message = error instanceof RgaFileError ? t(error.code === 'too_large' ? 'errors.tooLarge' : 'errors.unsupported') : t('errors.generic');
      setPhase({ name: 'start', error: message });
      return;
    }
    if (!file) return; // cancelou o seletor

    setPhase({ name: 'reading' });
    let result: RgaImportResult;
    try {
      result = await importRgaFile(file);
    } catch (error) {
      reportError('rga.import', error);
      setPhase({ name: 'start', error: t(`errors.${classifyImportError(error)}`) });
      return;
    }

    // Só o motivo e o "Creator" vão para análise; nunca valores do documento.
    if (result.recognized) {
      track({ name: 'rga_import_ok' });
    } else {
      track({ name: 'rga_import_falhou', reason: result.reason ?? 'unknown' });
      reportRgaImportFailure(result.reason ?? 'unknown', result.creator);
    }

    const base = existingPet ? petToFormValues(existingPet) : PET_FORM_DEFAULTS;
    const prefill = rgaResultToPrefill(result, new Date().toISOString(), base);
    const photo: RgaPhoto | undefined = result.photoJpegBase64
      ? { uri: rgaPhotoDataUri(result.photoJpegBase64), base64: result.photoJpegBase64 }
      : undefined;

    // Nada aproveitável: volta ao início explicando o motivo.
    if (!result.recognized && prefill.filled.length === 0) {
      setPhase({ name: 'start', error: `${t('notRecognized')} ${t(`reasons.${result.reason ?? 'unreadable'}`)}` });
      return;
    }

    // Já existe um pet com este RGA na conta? Oferece atualizar em vez de criar outro.
    if (!existingPet && prefill.values.rga) {
      try {
        const duplicate = await findPetByRga(user.uid, prefill.values.rga);
        if (duplicate) {
          const existingValues = petToFormValues(duplicate);
          const merged = rgaResultToPrefill(result, new Date().toISOString(), existingValues);
          setPhase({
            name: 'duplicate',
            duplicate,
            result,
            photo,
            changes: mergePlaceChanges(diffFormValues(existingValues, merged.values, merged.filled)),
          });
          return;
        }
      } catch (error) {
        reportError('rga.duplicateLookup', error); // sem a checagem, segue para a revisão
      }
    }

    setPhase({ name: 'review', review: { prefill, result, photo, target: existingPet } });
  };

  const acceptUpdate = (duplicate: Pet, result: RgaImportResult, photo?: RgaPhoto) => {
    const prefill = rgaResultToPrefill(result, new Date().toISOString(), petToFormValues(duplicate));
    setPhase({ name: 'review', review: { prefill, result, photo, target: duplicate } });
  };

  /* --------------------------------- Salvar --------------------------------- */

  const save = async (review: Review, values: PetFormValues, photo: PhotoChange, saveTutor: boolean) => {
    setSaving(true);
    setSaveError(undefined);
    try {
      const data = petFormToData(values);
      // O responsável (nome/telefone) só é gravado se a pessoa marcou a caixa. CPF/CNPJ nunca existe aqui.
      const extra: PetExtra = {
        sinpatinhas: review.prefill.sinpatinhas,
        ...(saveTutor && review.prefill.tutor ? { tutor: review.prefill.tutor } : {}),
      };

      let petId: string;
      let status: 'committed' | 'pending';
      if (review.target) {
        petId = review.target.id;
        status = await updatePet(petId, data, extra);
      } else {
        const created = await createPet({
          uid: user.uid,
          displayName: user.displayName,
          data,
          origin: 'rga_import',
          extra,
        });
        petId = created.petId;
        status = created.status;
        track({ name: 'pet_created', origin: 'rga_import' });
      }

      if (photo.kind === 'picked') {
        // Sem a confirmação do servidor a foto não é enviada, mas a pessoa é avisada (nada de falha silenciosa).
        const outcome = await uploadPhotoAfterSave(petId, photo.photo, status, 'rga.photoUpload');
        if (outcome === 'failed') Alert.alert(te('pets.photoFailed'));
        else if (outcome === 'deferred') Alert.alert(te('pets.photoPending'));
      } else if (photo.kind === 'removed' && review.target) {
        try {
          await removePetPhoto(petId);
        } catch (error) {
          reportError('rga.photoUpload', error);
          Alert.alert(te('pets.photoFailed'));
        }
      }
      router.replace({ pathname: '/pet/[id]', params: { id: petId } });
    } catch (error) {
      reportError('rga.save', error);
      setSaveError(te('pets.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  /* ---------------------------------- Telas ---------------------------------- */

  if (phase.name === 'reading') {
    return (
      <Screen scroll={false}>
        <LoadingView />
        <AppText align="center" color="textMuted">
          {t('reading')}
        </AppText>
      </Screen>
    );
  }

  if (phase.name === 'duplicate') {
    const { duplicate, result, photo, changes } = phase;
    return (
      <Screen>
        <Banner tone="info">{t('duplicate.title')}</Banner>
        <AppText>{t('duplicate.body', { name: duplicate.name })}</AppText>
        <Card>
          <View style={{ gap: 8 }} testID="rga-changes">
            {changes.length === 0 ? (
              <AppText color="textMuted">{t('duplicate.noChanges')}</AppText>
            ) : (
              changes.map((change) => (
                <AppText key={change.field}>
                  {t('duplicate.change', {
                    field: fieldLabel(change.field, t),
                    from: displayValue(change.field, change.before, t, tp, locale),
                    to: displayValue(change.field, change.after, t, tp, locale),
                  })}
                </AppText>
              ))
            )}
          </View>
        </Card>
        <Button icon="refresh" label={t('duplicate.update')} onPress={() => acceptUpdate(duplicate, result, photo)} />
        <Button variant="secondary" label={t('duplicate.cancel')} onPress={() => router.back()} />
      </Screen>
    );
  }

  if (phase.name === 'review') {
    const { review } = phase;
    const { result, prefill } = review;
    return (
      <PetForm
        key={review.target?.id ?? 'new'}
        initialValues={prefill.values}
        currentPhotoUrl={review.target ? targetPhotoUrl : null}
        submitting={saving}
        submitError={saveError}
        badges={prefill.badges}
        rgaPhoto={review.photo}
        rgaTutor={prefill.tutor}
        submitLabel={review.target ? t('review.saveUpdate') : t('review.save')}
        submittingLabel={t('review.saving')}
        headerSlot={<ReviewBanners result={result} prefill={prefill} />}
        onSubmit={(values, photo, extras) => void save(review, values, photo, extras.saveTutor)}
      />
    );
  }

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Icon name="document-text" size={56} color="primary" />
        <AppText variant="title" align="center">
          {existingPet ? t('titleUpdate') : t('title')}
        </AppText>
      </View>
      {phase.error ? <Banner tone="error">{phase.error}</Banner> : null}
      <AppText>{t('intro')}</AppText>
      <AppText color="textMuted">{t('accepted')}</AppText>
      <Banner tone="info">{t('privacy')}</Banner>
      <Button icon="folder-open" label={t('pick')} onPress={() => void choose()} />
      {!existingPet ? (
        <Button variant="secondary" label={t('fillManually')} onPress={() => router.replace('/pet/new')} />
      ) : null}
    </Screen>
  );
}

/* ------------------------------ Partes da tela ------------------------------ */

function ReviewBanners({ result, prefill }: { result: RgaImportResult; prefill: RgaPrefill }) {
  const { t } = useTranslation('rga');
  return (
    <View style={{ gap: 8 }}>
      {!result.recognized ? (
        <>
          <Banner tone="error">{t('notRecognized')}</Banner>
          {result.reason ? <Banner tone="warning">{t(`reasons.${result.reason}`)}</Banner> : null}
          <AppText color="textMuted">{t('partial')}</AppText>
        </>
      ) : null}
      {prefill.warnings
        .filter((code) => code !== 'rga_format') // este aviso já aparece junto do campo RGA
        .map((code) => (
          <Banner key={code} tone={code === 'qr_mismatch' ? 'error' : 'warning'}>
            {t(`warnings.${code}`)}
          </Banner>
        ))}
    </View>
  );
}

/** Nome do campo, no idioma da pessoa. */
function fieldLabel(field: string, t: (key: never) => string): string {
  const key = field === 'naturalCity' || field === 'naturalUf' ? 'naturalidade' : field;
  const known = ['name', 'species', 'sex', 'neutered', 'birthDate', 'microchip', 'rga', 'cor', 'naturalidade'];
  return known.includes(key) ? t(`fields.${key}` as never) : key;
}

/** Valor legível: enums viram texto no idioma da pessoa, datas seguem o idioma. */
function displayValue(
  field: string,
  value: string,
  t: (key: never) => string,
  tp: (key: never) => string,
  locale: 'pt-BR' | 'en',
): string {
  if (value === '') return t('duplicate.empty' as never);
  if (field === 'species') return tp(`species.${value as Species}` as never);
  if (field === 'sex') return tp(`sex.${value as Sex}` as never);
  if (field === 'neutered') return tp(`tristate.${value as TriState}` as never);
  if (field === 'birthDate') return formatIsoDate(value, locale);
  return value;
}
