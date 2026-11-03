import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/core/theme/ThemeProvider';

type Props = {
  children: React.ReactNode;
  /** Conteúdo rolável (padrão). Use false para telas com lista própria. */
  scroll?: boolean;
  /** Evita o teclado cobrir os campos. */
  keyboard?: boolean;
  edges?: Edge[];
  /** Rodapé fixo (ex.: botão Salvar). */
  footer?: React.ReactNode;
};

export function Screen({
  children,
  scroll = true,
  keyboard = false,
  edges = ['bottom', 'left', 'right'],
  footer,
}: Props) {
  const { colors, spacing } = useTheme();

  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, { padding: spacing.lg, gap: spacing.lg }]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, { padding: spacing.lg, gap: spacing.lg }]}>{children}</View>
  );

  const body = (
    <>
      {content}
      {footer ? (
        <View style={[styles.footer, { padding: spacing.lg, borderTopColor: colors.border, backgroundColor: colors.background }]}>
          {footer}
        </View>
      ) : null}
    </>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={edges}>
      {keyboard ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
});
