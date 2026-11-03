import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/core/theme/ThemeProvider';
import { MIN_TOUCH } from '@/core/theme/tokens';
import { AppText } from './AppText';
import { FieldBadge, type FieldBadgeInfo } from './FieldBadge';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  error?: string;
  badge?: FieldBadgeInfo;
};

/** Escolha única em formato de "chips" (leitor de tela: grupo de opções com selecionada). */
export function ChoiceChips<T extends string>({ label, options, value, onChange, error, badge }: Props<T>) {
  const { colors, radius } = useTheme();
  return (
    <View style={styles.wrapper} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <AppText variant="label">{label}</AppText>
        {badge ? <FieldBadge {...badge} /> : null}
      </View>
      <View style={styles.row}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected, checked: selected }}
              style={[
                styles.chip,
                {
                  borderRadius: radius.pill,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primary : colors.surface,
                },
              ]}
            >
              <AppText variant="label" style={{ color: selected ? colors.onPrimary : colors.text }}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <AppText variant="caption" color="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderWidth: 1.5,
  },
});
