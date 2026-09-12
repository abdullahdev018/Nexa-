import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/auth/session'
import { LegalLayout } from '@/components/legal/LegalLayout'

export const metadata: Metadata = {
  title: 'Terms',
  description: 'Terms of service for Nexa AI.',
}

export default async function TermsPage() {
  const user = await getCurrentUser()

  return (
    <LegalLayout title="Terms of Service" updated="12 September 2026" signedIn={Boolean(user)}>
      <p>
        These terms cover your use of Nexa AI. By creating an account you agree to them.
      </p>

      <section>
        <h2>Your account</h2>
        <ul>
          <li>You must be able to form a binding contract to use Nexa.</li>
          <li>
            You are responsible for keeping your password safe and for activity under your account.
          </li>
          <li>One person per account. Do not share credentials.</li>
        </ul>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>Do not use Nexa to:</p>
        <ul>
          <li>Break the law, or help anyone else do so.</li>
          <li>Generate content that harasses, defames or endangers people.</li>
          <li>
            Attempt to extract credentials, attack the service, or circumvent rate limits and
            account boundaries.
          </li>
          <li>Resell access, or present Nexa&apos;s output as a human-authored professional opinion.</li>
        </ul>
        <p>
          We may suspend an account that does these things, and we will tell you why where we can.
        </p>
      </section>

      <section>
        <h2>Content</h2>
        <p>
          You keep ownership of what you write. You are responsible for what you send and for how
          you use what Nexa produces. We claim no ownership of your conversations.
        </p>
      </section>

      <section>
        <h2>Accuracy</h2>
        <p>
          Nexa generates text with a language model. It can be wrong, out of date, or confidently
          mistaken. Check anything that matters — particularly legal, medical, financial and safety
          information — against a source you trust. Nexa is not professional advice.
        </p>
      </section>

      <section>
        <h2>Availability</h2>
        <p>
          We aim to keep Nexa running but do not guarantee uninterrupted service. Features may
          change, and rate limits apply so one account cannot degrade the service for everyone else.
        </p>
      </section>

      <section>
        <h2>Ending your use</h2>
        <p>
          You can delete your account at any time from the Account page, which removes your data
          permanently. We may close an account that breaches these terms.
        </p>
      </section>

      <section>
        <h2>Liability</h2>
        <p>
          Nexa is provided as is. To the extent the law allows, we are not liable for indirect or
          consequential loss arising from your use of it.
        </p>
      </section>
    </LegalLayout>
  )
}
