import React, { useState } from 'react';
import { z } from 'zod';
import { Field } from './Field';

export interface SchemaFormProps<T extends z.ZodObject<any>> {
  schema: T;
  initialValues?: Partial<z.infer<T>>;
  onSubmit: (data: z.infer<T>) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  customLabels?: Record<string, string>;
  customHints?: Record<string, string>;
  disabledFields?: string[];
  hiddenFields?: string[];
  className?: string;
}

export function SchemaForm<T extends z.ZodObject<any>>({
  schema,
  initialValues = {},
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  customLabels = {},
  customHints = {},
  disabledFields = [],
  hiddenFields = [],
  className = '',
}: SchemaFormProps<T>) {
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const defaults: Record<string, any> = {};
    const shape = schema.shape;
    for (const key in shape) {
      if (initialValues[key] !== undefined) {
        defaults[key] = initialValues[key];
      } else {
        defaults[key] = '';
      }
    }
    return defaults;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (fieldKey: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldKey]: value }));
    if (errors[fieldKey]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const result = schema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const fieldName = issue.path[0]?.toString();
        if (fieldName && !fieldErrors[fieldName]) {
          fieldErrors[fieldName] = issue.message;
        }
      }
      setErrors(fieldErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      await onSubmit(result.data);
    } catch (err: any) {
      setErrors({ _form: err.message || 'An error occurred during submission' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const shape = schema.shape;

  const renderControl = (key: string, zodType: z.ZodTypeAny) => {
    let currentType: z.ZodTypeAny = zodType;
    let isOptional = false;

    if (currentType instanceof z.ZodOptional || currentType instanceof z.ZodNullable) {
      isOptional = true;
      currentType = (currentType as any)._def.innerType;
    }

    const value = formData[key] ?? '';
    const error = errors[key];
    const isDisabled = disabledFields.includes(key);

    if (currentType instanceof z.ZodEnum) {
      const options = (currentType.options || (currentType as any)._def?.values || []) as readonly string[];
      return (
        <select
          value={value}
          disabled={isDisabled}
          onChange={e => handleChange(key, e.target.value)}
          className="w-full bg-[var(--bg-input,#ffffff)] border border-[var(--border,#d4d4d4)] text-[var(--text,#171717)] text-xs rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
        >
          <option value="">-- Select {customLabels[key] || key} --</option>
          {options.map(opt => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    if (currentType instanceof z.ZodBoolean) {
      return (
        <label className="flex items-center gap-2 text-xs font-medium text-[var(--text,#171717)] cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            disabled={isDisabled}
            onChange={e => handleChange(key, e.target.checked)}
            className="rounded-sm border-[var(--border,#d4d4d4)] text-primary-600 focus:ring-primary-500"
          />
          {customLabels[key] || key}
        </label>
      );
    }

    if (currentType instanceof z.ZodNumber) {
      return (
        <input
          type="number"
          value={value}
          disabled={isDisabled}
          onChange={e => handleChange(key, e.target.value === '' ? '' : Number(e.target.value))}
          className="w-full bg-[var(--bg-input,#ffffff)] border border-[var(--border,#d4d4d4)] text-[var(--text,#171717)] text-xs rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
        />
      );
    }

    return (
      <input
        type="text"
        value={value}
        disabled={isDisabled}
        onChange={e => handleChange(key, e.target.value)}
        className="w-full bg-[var(--bg-input,#ffffff)] border border-[var(--border,#d4d4d4)] text-[var(--text,#171717)] text-xs rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
      />
    );
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`} noValidate>
      {errors._form && (
        <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
          {errors._form}
        </div>
      )}

      {Object.keys(shape).map(key => {
        if (hiddenFields.includes(key)) return null;

        const fieldDef = shape[key];
        let isRequired = true;
        if (fieldDef instanceof z.ZodOptional || fieldDef instanceof z.ZodNullable) {
          isRequired = false;
        }

        const label = customLabels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

        return (
          <Field
            key={key}
            label={label}
            error={errors[key]}
            hint={customHints[key]}
            required={isRequired}
          >
            {renderControl(key, fieldDef)}
          </Field>
        );
      })}

      <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--border,#e5e5e5)]">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-[var(--text-muted,#525252)] hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-xs font-semibold bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors shadow-xs disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
