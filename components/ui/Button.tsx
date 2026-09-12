import Link from 'next/link'
import type { ComponentPropsWithRef, ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white shadow-xs hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-600/50',
  secondary:
    'bg-raised text-ink-800 ring-1 ring-inset ring-ink-300 shadow-xs hover:bg-ink-50 active:bg-ink-100',
  ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 active:bg-ink-200',
  danger: 'bg-red-600 text-white shadow-xs hover:bg-red-700 active:bg-red-800',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px] gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-md',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-lg',
}

const BASE =
  'inline-flex select-none items-center justify-center font-medium transition-colors ' +
  'disabled:cursor-not-allowed disabled:opacity-60'

interface CommonProps {
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
}

// ComponentPropsWithRef, not …WithoutRef: React 19 passes `ref` as an ordinary
// prop, and callers need it to move focus into dialogs.
type ButtonProps = CommonProps & Omit<ComponentPropsWithRef<'button'>, 'className' | 'children'>

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {children}
    </button>
  )
}

type LinkButtonProps = CommonProps & { href: string } & Omit<
    ComponentPropsWithoutRef<'a'>,
    'className' | 'children' | 'href'
  >

/** Same surface as Button, for navigation rather than actions. */
export function LinkButton({
  variant = 'primary',
  size = 'md',
  className,
  children,
  href,
  ...rest
}: LinkButtonProps) {
  return (
    <Link href={href} className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {children}
    </Link>
  )
}
