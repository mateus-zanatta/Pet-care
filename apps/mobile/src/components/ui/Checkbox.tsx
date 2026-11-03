import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/core/theme/ThemeProvider';
import { MIN_TOUCH } from '@/core/theme/tokens';
import { AppText } from './AppText';
import { Icon } from './Icon';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Texto lido pelo leitor de tela (a versão visual pode ter links). */
  accessibilityLabel: string;
  children: React.ReactNode;
  error?: string;
};

export function Checkbox({ checked, onChange, accessibilityLabel, children, error }: Props) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.row}>
        <Pressable
          onPress={() => onChange(!checked)}
          accessibilityRole="checkbox"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ checked }}
          hitSlop={8}
          style={[
            styles.box,
            {
              borderRadius: radius.sm,
              borderColor: error ? colors.danger : checked ? colors.primary : colors.border,
              backgroundColor: checked ? colors.primary : colors.surface,
            },
          ]}
        >
          {checked ? <Icon name="checkmark" size={20} color="onPrimary" /> : null}
        </Pressable>
        <View style={{ flex: 1 }}>{children}</View>
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
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  box: { width: MIN_TOUCH - 8, height: MIN_TOUCH - 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
