import { z } from 'zod'

/**
 * Shared between the API routes and the forms, so the browser and the server
 * enforce exactly the same rules and the messages never disagree.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required.')
  .max(254, 'That email is too long.')
  .email('Enter a valid email address.')
  .transform((value) => value.toLowerCase())

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  // bcrypt silently truncates at 72 bytes; rejecting longer input is honest
  // rather than accepting a password that is not fully checked.
  .max(72, 'Use at most 72 characters.')
  .regex(/[a-zA-Z]/, 'Include at least one letter.')
  .regex(/[0-9]/, 'Include at least one number.')

export const signupSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80, 'That name is too long.'),
  email: emailSchema,
  password: passwordSchema,
})

export const loginSchema = z.object({
  email: emailSchema,
  // Deliberately lax: an old account may predate the current rules, and the
  // only thing that matters at login is whether the hash matches.
  password: z.string().min(1, 'Enter your password.'),
})

export const onboardingSchema = z.object({
  role: z.string().trim().min(1, 'Tell us what you do.').max(80),
  useCases: z.array(z.string().max(40)).max(10),
  defaultModel: z.string().min(1).max(40),
})

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: passwordSchema,
})

export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>
