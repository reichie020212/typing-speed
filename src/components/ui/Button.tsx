import { type ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const base =
  'inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  primary:
    'bg-[color:var(--accent)] text-[color:var(--bg)] hover:brightness-110 focus-visible:brightness-110',
  ghost:
    'bg-transparent text-[color:var(--fg)] border border-[color:var(--border)] hover:bg-[color:var(--surface)]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', className = '', children, ...rest },
  ref,
) {
  return (
    <button ref={ref} className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
});
