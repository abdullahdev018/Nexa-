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
    <LegalLayout title="Privacy Policy" updated="26 September 2026" signedIn={Boolean(user)}>
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
            <strong>Your marketing work:</strong> your Brand Kit and products, and the campaigns,
            content, video plans, ads and calendar items you create — so they are there to edit,
            reuse and build on. These belong to your workspace and are visible only to its members.
          </li>
          <li>
            <strong>Results you import:</strong> the rows you import into Analytics (dates,
            platforms, reach, clicks, leads, conversions and spend). The file itself is not kept.
          </li>
          <li>
            <strong>Credits and usage:</strong> a record of every credit granted and spent, and of
            each AI request — which feature, which model, how many tokens, and whether it
            succeeded — so your credit history is accurate. The record holds no message text.
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
          To generate anything — a reply, a campaign, a post, a video plan, ads or insights — what
          you asked for is sent to our model provider, together with the details it needs: the
          earlier turns of a conversation, your Brand Kit and products, the campaign it belongs to,
          or the totals of the results you imported. It is processed to produce the response and is
          not used to train models. Nothing is sold, and nothing is shared with advertisers.
        </p>
        <p>
          Nexa is not connected to any social media or ad account, so nothing you create is sent to
          Instagram, TikTok, Meta, Google or any other platform by us.
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
            Delete your entire account from the Account page. Your conversations, settings and
            sessions are removed with it, permanently — and so is every workspace you own, with
            its brands, campaigns, content, video plans, ads, calendar, imported results and credit
            history.
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
