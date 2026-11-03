import React, { useState } from 'react';
import { type DateOrder, isoToInput, maskDateInput, parseDateInput } from '@/core/dates';
import type { FieldBadgeInfo } from './FieldBadge';
import { TextField } from './TextField';

type Props = {
  label: string;
  /** ISO `YYYY-MM-DD`, '' (vazio) ou 'invalid'. */
  value: string;
  onChange: (iso: string) => void;
  order: DateOrder;
  placeholder: string;
  error?: string;
  badge?: FieldBadgeInfo;
};

/**
 * Campo de data com máscara (dd/mm/aaaa ou mm/dd/yyyy conforme o idioma).
 * O texto digitado fica no componente; para fora sai sempre ISO, '' ou 'invalid'.
 */
export function DateField({ label, value, onChange, order, placeholder, error, badge }: Props) {
  const [text, setText] = useState(() => isoToInput(value, order));

  return (
    <TextField
      label={label}
      value={text}
      placeholder={placeholder}
      keyboardType="number-pad"
      maxLength={10}
      error={error}
      badge={badge}
      onChangeText={(raw) => {
        const masked = maskDateInput(raw);
        setText(masked);
        onChange(parseDateInput(masked, order));
      }}
    />
  );
}
