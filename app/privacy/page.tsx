import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/auth/session'
import { LegalLayout } from '@/components/legal/LegalLayout'

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'How Nexa AI handles your data.',
}

export default async function PrivacyPage() {
  const user = await getCurrentUser()

  return (
    <LegalLayout title="Privacy Policy" updated="12 September 2026" signedIn={Boolean(user)}>
      <p>
        This page describes what Nexa AI collects, why, and what you can do about it. It is written
        to describe how the product actually works rather than to cover every eventuality in legal
        language.
      </p>

      <section>
        <h2>What we store</h2>
        <ul>
          <li>
            <strong>Your account:</strong> the name and email address you sign up with, and a hash
            of your password. We never store your password itself.
          </li>
          <li>
            <strong>Your conversations:</strong> the messages you send and the replies Nexa
            generates, so your history is there when you come back.
          </li>
          <li>
            <strong>Your settings:</strong> your default model, custom instructions, and what you
            told us about your work during setup.
          </li>
          <li>
            <strong>Sessions:</strong> a hashed session token, and the browser and IP address a
            session was created from, so you can tell your own sessions apart.
          </li>
        </ul>
      </section>

      <section>
        <h2>What we do not store</h2>
        <p>
          Files you attach are sent to the model provider to answer your question and are then
          discarded. Only the file name, type and size are kept, so your conversation still shows
          what was attached. The file contents themselves are not written to our database.
        </p>
      </section>

      <section>
        <h2>Who your messages are shared with</h2>
        <p>
          To generate a reply, your message and the earlier turns in that conversation are sent to
          our model provider. They are processed to produce the response and are not used to train
          models. Nothing is sold, and nothing is shared with advertisers.
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          Nexa sets one cookie: a session cookie that keeps you signed in. It is HTTP-only, so page
          scripts cannot read it, and it is sent only to this site. There are no advertising or
          analytics cookies.
        </p>
      </section>

      <section>
        <h2>Your control</h2>
        <ul>
          <li>Delete any conversation from the sidebar. It is removed immediately.</li>
          <li>
            Delete your entire account from the Account page. Your conversations, messages, settings
            and sessions are removed with it, permanently.
          </li>
          <li>Change your password at any time, which signs out every other device.</li>
        </ul>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          Passwords are hashed with bcrypt. Session cookies carry a random token, and only a hash of
          that token is stored, so a database leak does not hand over live sessions. Your API
          traffic never contains a model provider key — those stay on the server.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          If this policy changes in a way that affects what we collect or who it is shared with, the
          date at the top of this page changes with it.
        </p>
      </section>
    </LegalLayout>
  )
}
