import React from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';

interface PhoneInputProps extends Omit<React.ComponentProps<"input">, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const formatPhoneNumber = (input: string) => {
      // Remove tudo que não é número
      const numbers = input.replace(/\D/g, '');
      
      // Se começar com 55, mantém. Se não, adiciona 55
      let formatted = numbers;
      if (!formatted.startsWith('55')) {
        formatted = '55' + formatted;
      }
      
      // Limita a 13 dígitos (55 + 11 dígitos)
      formatted = formatted.substring(0, 13);
      
      // Aplica a formatação +55 (11) 99999-9999
      if (formatted.length <= 2) {
        return `+${formatted}`;
      } else if (formatted.length <= 4) {
        return `+${formatted.substring(0, 2)} (${formatted.substring(2)})`;
      } else if (formatted.length <= 9) {
        return `+${formatted.substring(0, 2)} (${formatted.substring(2, 4)}) ${formatted.substring(4)}`;
      } else {
        return `+${formatted.substring(0, 2)} (${formatted.substring(2, 4)}) ${formatted.substring(4, 9)}-${formatted.substring(9)}`;
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatPhoneNumber(e.target.value);
      onChange(formatted);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Permite backspace, delete, tab, escape, enter
      if ([8, 9, 27, 13, 46].includes(e.keyCode)) {
        return;
      }
      // Permite Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
      if ((e.keyCode === 65 || e.keyCode === 67 || e.keyCode === 86 || e.keyCode === 88) && e.ctrlKey) {
        return;
      }
      // Bloqueia se não for número
      if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
        e.preventDefault();
      }
    };

    return (
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
          <span className="text-lg">🇧🇷</span>
        </div>
        <Input
          ref={ref}
          type="tel"
          value={value || '+55 '}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className={cn("pl-16", className)}
          placeholder="+55 (11) 99999-9999"
          {...props}
        />
      </div>
    );
  }
);

PhoneInput.displayName = "PhoneInput";