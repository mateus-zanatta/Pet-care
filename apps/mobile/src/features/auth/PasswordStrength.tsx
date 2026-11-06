import { PASSWORD_MIN_LENGTH, type PasswordRule, passwordScore, unmetPasswordRules } from '@petcare/shared';
import React from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { CSS_EASE_OUT, DURATION } from '@/components/motion/motion';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/core/theme/ThemeProvider';

const SHOWN: readonly PasswordRule[] = ['length', 'upper', 'lower', 'digit', 'symbol', 'noRepeat', 'notPersonal', 'notCommon'];

/**
 * Medidor de força da senha + lista do que falta, ao vivo. As cores da barra mudam com uma transição curta
 * (180 ms); o texto diz o nível (cor nunca é a única informação).
 */
export function PasswordStrength({ password, email, name }: { password: string; email?: string; name?: string }) {
  const { t } = useTranslation('auth');
  const { colors, radius } = useTheme();
  const unmet = unmetPasswordRules(password, { email, name });
  const score = passwordScore(password, { email, name });
  const tone = [colors.border, colors.danger, colors.onWarningContainer, colors.primary, colors.success][score];

  if (!password) return null;
  return (
    <View style={{ gap: 8 }} accessibilityLiveRegion="polite">
      <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={t('password.level', { level: t(`password.levels.${score}`) })}>
        {[1, 2, 3, 4].map((step) => (
          <Animated.View
            key={step}
            style={{
              flex: 1,
              height: 6,
              borderRadius: radius.pill,
              backgroundColor: step <= score ? tone : colors.surfaceAlt,
              transitionProperty: 'backgroundColor',
              transitionDuration: DURATION.state,
              transitionTimingFunction: CSS_EASE_OUT,
            }}
          />
        ))}
      </View>
      <AppText variant="label">{t('password.level', { level: t(`password.levels.${score}`) })}</AppText>
      {SHOWN.map((rule) => {
        const ok = !unmet.includes(rule);
        return (
          <View key={rule} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Icon name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={ok ? 'success' : 'textMuted'} />
            <AppText variant="caption" color={ok ? 'text' : 'textMuted'}>
              {t(`password.rules.${rule}`, { min: PASSWORD_MIN_LENGTH })}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}
