import React, { useState, KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export default function TagInput({ tags, onChange, disabled, placeholder = "Add tag...", className }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = inputValue.trim();
      if (newTag && !tags.includes(newTag)) {
        onChange([...tags, newTag]);
      }
      setInputValue('');
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (indexToRemove: number) => {
    if (disabled) return;
    onChange(tags.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 p-1.5 bg-[var(--surface)] border border-[var(--line)] rounded-xl focus-within:border-zinc-400 transition-colors", className, disabled && "opacity-50 bg-[var(--ink)] cursor-not-allowed")}>
      {tags.map((tag, index) => (
        <span key={index} className="flex items-center gap-1 px-2 py-0.5 bg-zinc-100 text-zinc-700 text-xs rounded-md">
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="text-zinc-400 hover:text-zinc-600 focus:outline-none"
            >
              <X size={12} />
            </button>
          )}
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[60px] bg-transparent text-xs text-zinc-700 outline-none px-1 py-0.5 placeholder:text-zinc-400"
      />
    </div>
  );
}
