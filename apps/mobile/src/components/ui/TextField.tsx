import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import { useTheme } from '@/core/theme/ThemeProvider';
import { MAX_FONT_SCALE, MIN_TOUCH } from '@/core/theme/tokens';
import { AppText } from './AppText';
import { Icon } from './Icon';

type Props = Omit<TextInputProps, 'style' | 'ref'> & {
  inputRef?: React.Ref<React.ComponentRef<typeof TextInput>>;
  label: string;
  error?: string;
  hint?: string;
  optional?: string;
  /** Mostra o botão de revelar/ocultar (campos de senha). */
  secureToggleLabels?: { show: string; hide: string };
};

/** Campo de texto com rótulo visível, dica e erro (o erro é lido pelo leitor de tela). */
export function TextField({
  label,
  error,
  hint,
  optional,
  secureToggleLabels,
  secureTextEntry,
  multiline,
  inputRef,
  ...rest
}: Props) {
  const { colors, radius } = useTheme();
  const [revealed, setRevealed] = useState(false);
  const hasToggle = Boolean(secureToggleLabels) && Boolean(secureTextEntry);

  return (
    <View style={styles.wrapper}>
      <AppText variant="label">
        {label}
        {optional ? <AppText variant="caption" color="textMuted">{`  (${optional})`}</AppText> : null}
      </AppText>
      <View
        style={[
          styles.inputBox,
          {
            borderColor: error ? colors.danger : colors.border,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          multiline={multiline}
          secureTextEntry={secureTextEntry && !revealed}
          style={[
            styles.input,
            { color: colors.text, minHeight: multiline ? 96 : MIN_TOUCH, textAlignVertical: multiline ? 'top' : 'center' },
          ]}
          {...rest}
        />
        {hasToggle && secureToggleLabels ? (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? secureToggleLabels.hide : secureToggleLabels.show}
            hitSlop={8}
            style={styles.toggle}
          >
            <Icon name={revealed ? 'eye-off' : 'eye'} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color="textMuted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  inputBox: { borderWidth: 1.5, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, fontSize: 16, paddingHorizontal: 14, paddingVertical: 10 },
  toggle: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
});
