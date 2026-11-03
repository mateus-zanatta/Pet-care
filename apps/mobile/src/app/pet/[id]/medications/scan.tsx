import { useRouter } from 'expo-router';
import React, { useRef } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { LoadingView } from '@/components/ui/states';
import { optionalModule } from '@/core/native/optionalModule';
import { setScannedCode } from '@/features/medications/scanInbox';

type CameraModule = typeof import('expo-camera');

// O módulo nativo da câmera é carregado com tolerância: um build antigo do app continua abrindo.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- carregamento tolerante, de propósito
const camera = optionalModule<CameraModule>(() => require('expo-camera'), 'expo-camera');

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'itf14', 'qr', 'datamatrix'] as const;

export default function ScanBarcodeScreen() {
  const { t } = useTranslation('meds');
  const router = useRouter();

  if (!camera) {
    return (
      <Screen>
        <Banner tone="warning">{t('scan.unavailable')}</Banner>
        <Button variant="secondary" label={t('scan.cancel')} onPress={() => router.back()} />
      </Screen>
    );
  }
  return <Scanner camera={camera} />;
}

function Scanner({ camera: { CameraView, useCameraPermissions } }: { camera: CameraModule }) {
  const { t } = useTranslation('meds');
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const done = useRef(false);

  if (!permission) return <LoadingView />;

  if (!permission.granted) {
    return (
      <Screen>
        <AppText variant="title">{t('scan.permissionTitle')}</AppText>
        <AppText>{t('scan.permissionBody')}</AppText>
        {permission.canAskAgain ? (
          <Button icon="camera" label={t('scan.allow')} onPress={() => void requestPermission()} />
        ) : (
          <Button icon="settings" label={t('scan.settings')} onPress={() => void Linking.openSettings()} />
        )}
        <Button variant="secondary" label={t('scan.cancel')} onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={({ data }) => {
          if (done.current || !data) return;
          done.current = true; // a câmera dispara várias leituras seguidas: só vale a primeira
          setScannedCode(data.trim().slice(0, 64));
          router.back();
        }}
      />
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 32, gap: 12 }}>
        <Banner tone="info">{t('scan.hint')}</Banner>
        <Button variant="secondary" label={t('scan.cancel')} onPress={() => router.back()} />
      </View>
    </View>
  );
}
