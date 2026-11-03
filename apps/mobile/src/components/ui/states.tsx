import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/core/theme/ThemeProvider';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

export function LoadingView() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}
      accessibilityRole="progressbar"
      accessibilityLabel={t('loading')}
    >
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  icon: IconName;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <View style={{ alignItems: 'center', gap: 12, paddingVertical: 32, paddingHorizontal: 8 }}>
      <Icon name={icon} size={56} color="primary" />
      <AppText variant="title" align="center">
        {title}
      </AppText>
      <AppText color="textMuted" align="center">
        {body}
      </AppText>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
      {secondaryLabel && onSecondary ? <Button variant="secondary" label={secondaryLabel} onPress={onSecondary} /> : null}
    </View>
  );
}
