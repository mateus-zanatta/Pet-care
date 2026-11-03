import React from 'react';
import { type Control, Controller, type FieldValues, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { type DateOrder } from '@/core/dates';
import { ChoiceChips } from '../ui/ChoiceChips';
import type { FieldBadgeInfo } from '../ui/FieldBadge';
import { DateField } from '../ui/DateField';
import { TextField } from '../ui/TextField';

/** Mensagens dos schemas Zod são chaves de tradução ("validation.required"). */
export function useErrorText() {
  const { t, i18n } = useTranslation();
  return (message?: string): string | undefined => {
    if (!message) return undefined;
    return i18n.exists(message) ? t(message as never) : message;
  };
}

type TextProps = React.ComponentProps<typeof TextField>;

type FieldProps<T extends FieldValues> = { control: Control<T>; name: Path<T> };

export function FormTextField<T extends FieldValues>({
  control,
  name,
  ...rest
}: FieldProps<T> & Omit<TextProps, 'value' | 'onChangeText' | 'onBlur' | 'error'>) {
  const errorText = useErrorText();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...rest}
          value={field.value as string}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={errorText(fieldState.error?.message)}
        />
      )}
    />
  );
}

export function FormChoice<T extends FieldValues, V extends string>({
  control,
  name,
  label,
  options,
  badge,
}: FieldProps<T> & { label: string; options: readonly { value: V; label: string }[]; badge?: FieldBadgeInfo }) {
  const errorText = useErrorText();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <ChoiceChips
          label={label}
          options={options}
          value={field.value as V}
          onChange={field.onChange}
          error={errorText(fieldState.error?.message)}
          badge={badge}
        />
      )}
    />
  );
}

export function FormDate<T extends FieldValues>({
  control,
  name,
  label,
  order,
  placeholder,
  badge,
}: FieldProps<T> & { label: string; order: DateOrder; placeholder: string; badge?: FieldBadgeInfo }) {
  const errorText = useErrorText();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <DateField
          label={label}
          value={field.value as string}
          onChange={field.onChange}
          order={order}
          placeholder={placeholder}
          error={errorText(fieldState.error?.message)}
          badge={badge}
        />
      )}
    />
  );
}
