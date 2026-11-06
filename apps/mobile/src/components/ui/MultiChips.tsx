import React from 'react';
import { View } from 'react-native';
import { PressableScale } from '@/components/motion/PressableScale';
import { useTheme } from '@/core/theme/ThemeProvider';
import { MIN_TOUCH } from '@/core/theme/tokens';
import { AppText } from './AppText';
import { Icon } from './Icon';

type Props<T extends string> = {
  label: string;
  options: readonly { value: T; label: string }[];
  value: readonly T[];
  onChange: (value: T[]) => void;
  error?: string;
  max?: number;
};

/** Seleção de VÁRIAS opções (ex.: condições do animal, cores). Cada chip é uma caixa de seleção para o leitor de tela. */
export function MultiChips<T extends string>({ label, options, value, onChange, error, max }: Props<T>) {
  const { colors, radius } = useTheme();
  const toggle = (v: T) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else if (!max || value.length < max) onChange([...value, v]);
  };
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="label">{label}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((option) => {
          const selected = value.includes(option.value);
          return (
            <PressableScale
              key={option.value}
              onPress={() => toggle(option.value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={option.label}
              style={{
                minHeight: MIN_TOUCH - 4,
                paddingHorizontal: 14,
                borderRadius: radius.pill,
                borderWidth: 1.5,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.primaryContainer : colors.surface,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {selected ? <Icon name="checkmark" size={18} color="onPrimaryContainer" /> : null}
              <AppText variant="label" color={selected ? 'onPrimaryContainer' : 'text'}>
                {option.label}
              </AppText>
            </PressableScale>
          );
        })}
      </View>
      {error ? (
        <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
