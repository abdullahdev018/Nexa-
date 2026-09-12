import bcrypt from 'bcryptjs'

/**
 * Cost 12 is the current sensible default: roughly 250ms on modern server
 * hardware, which is slow enough to make offline cracking expensive and fast
 * enough that a login does not feel stalled.
 */
const COST = 12

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

/**
 * Burns roughly the same time as a real comparison. Called when no account
 * exists for an email, so that response timing does not reveal which addresses
 * are registered.
 */
export async function fakeVerify(): Promise<void> {
  await bcrypt.compare(
    'not-a-real-password',
    '$2b$12$K8Z9YQZ5r5xHqQ1yF7nOyOJ0xJ7yQ9Z5r5xHqQ1yF7nOyOJ0xJ7yQ',
  )
}
