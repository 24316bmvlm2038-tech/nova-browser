/**
 * Legal text, kept in one place so the in-app sheets, the signup checkbox and
 * the standalone pages can never drift apart.
 *
 * This describes what the app actually does: everything runs on the user's own
 * machine, so most of the usual data-collection language does not apply. It is
 * a starting point written to match the code, not legal advice — have a lawyer
 * review it before you ship this to other people.
 */

export const LEGAL_VERSION = '2026-08-24';

export interface LegalSection {
  heading: string;
  body: string[];
}

export interface LegalDoc {
  id: 'terms' | 'privacy' | 'cookies';
  title: string;
  updated: string;
  summary: string;
  sections: LegalSection[];
}

export const TERMS: LegalDoc = {
  id: 'terms',
  title: 'Terms of Service',
  updated: LEGAL_VERSION,
  summary:
    'Can Ai runs on your own computer. You are responsible for how you use it and for anything you connect it to.',
  sections: [
    {
      heading: 'What this software is',
      body: [
        'Can Ai is software you run yourself. It talks to a language model on your machine through Ollama, searches the public web, reads public social and news feeds, and can generate images through an image model you provide.',
        'There is no hosted Can Ai service. Nobody operates a server on your behalf, and no company holds your account.',
      ],
    },
    {
      heading: 'Your account',
      body: [
        'Accounts exist so the app can keep your session and settings separate on a shared computer. They are stored in a database file on your own disk.',
        'You are responsible for keeping your password safe. If you lose access to that file, the account is gone — there is no recovery service.',
      ],
    },
    {
      heading: 'Acceptable use',
      body: [
        'Do not use Can Ai to break the law, to infringe copyright, or to harass anyone.',
        'Respect the terms of the services it reads. Reddit, Hacker News, Bluesky, Mastodon, Google News and any search provider you configure each have their own rules, and hammering them with automated requests can get your IP blocked.',
        'Do not present generated images as photographs of real events or real people.',
      ],
    },
    {
      heading: 'Prices and information are not advice',
      body: [
        'Prices shown by the scanner are asking prices extracted from search results. They are not offers, not verified, and often stale. Always click through and check before buying.',
        'Language models state false things confidently. Nothing the app tells you is verified, including summaries of news and prices. Check anything that matters.',
      ],
    },
    {
      heading: 'Third-party services',
      body: [
        'When you configure an API key — a search provider, an image provider, Google sign-in, an SMTP server — your use of that service is governed by that provider’s terms, not these.',
        'Costs incurred at those providers are yours.',
      ],
    },
    {
      heading: 'No warranty',
      body: [
        'The software is provided as is, without warranty of any kind. To the extent the law allows, the authors are not liable for any loss arising from its use.',
      ],
    },
    {
      heading: 'Changes',
      body: [
        'These terms may change when the software changes. The version date at the top tells you which text you agreed to.',
      ],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  id: 'privacy',
  title: 'Privacy Policy',
  updated: LEGAL_VERSION,
  summary:
    'Your data stays on your computer. No analytics, no tracking, no accounts held by anyone else.',
  sections: [
    {
      heading: 'What is stored, and where',
      body: [
        'Your name, email address, password hash and session tokens are stored in a SQLite file on your own disk (.data/can-ai.db by default). Nothing is sent anywhere else.',
        'Passwords are hashed with scrypt and a per-user salt. The plaintext is never written to disk or logged. Session tokens are stored only as a SHA-256 hash, so a copy of the database file yields no usable sessions.',
        'Your chat history lives in the browser tab and is gone when you reload. It is not written to disk.',
      ],
    },
    {
      heading: 'What leaves your machine',
      body: [
        'Web searches go to whichever search provider you have configured — DuckDuckGo by default. That provider sees your search terms and your IP address.',
        'Live feeds are fetched from Reddit, Hacker News, Bluesky, Mastodon and Google News. Those services see that a request was made from your IP.',
        'News thumbnails are fetched from the publisher of each story, so those publishers see a request from your IP.',
        'Prompts you send to the language model, and photos you take with the scanner, go to Ollama on your own machine and no further.',
        'If you configure a hosted image provider such as Replicate, image prompts go to that provider. If you configure SMTP, verification emails go through that mail server.',
      ],
    },
    {
      heading: 'The camera',
      body: [
        'The scanner uses your camera only while the scanner screen is open, and only after you grant permission. Each photo is held in memory, sent to the vision model running on your machine, and discarded. Photos are never uploaded and never written to disk.',
      ],
    },
    {
      heading: 'What is not collected',
      body: [
        'There is no analytics, no telemetry, no crash reporting, no advertising, and no third-party tracking of any kind in this software.',
      ],
    },
    {
      heading: 'Google sign-in',
      body: [
        'If you sign in with Google, Google tells the app your account ID, email address, display name and profile picture URL. That is stored in the same local database. No access token is retained after sign-in.',
      ],
    },
    {
      heading: 'Deleting your data',
      body: [
        'Delete the database file and everything is gone: accounts, sessions and settings. There is no copy anywhere else and nobody to ask.',
      ],
    },
  ],
};

export const COOKIES: LegalDoc = {
  id: 'cookies',
  title: 'Cookie Policy',
  updated: LEGAL_VERSION,
  summary:
    'One cookie, to keep you signed in. No advertising or analytics cookies, so there is nothing to opt out of.',
  sections: [
    {
      heading: 'The cookies this app sets',
      body: [
        'canai_session — keeps you signed in. It holds a random token, not your identity, and is httpOnly so page scripts cannot read it. It expires after 30 days, or immediately when you log out.',
        'canai_oauth_state and canai_oauth_verifier — set only during Google sign-in, and deleted the moment it completes. They exist to prove the sign-in came back to the same browser that started it.',
      ],
    },
    {
      heading: 'Strictly necessary',
      body: [
        'All of these are strictly necessary: without them you cannot stay signed in, and Google sign-in cannot be completed safely. There are no optional cookies to turn off.',
      ],
    },
    {
      heading: 'Local storage',
      body: [
        'The app records your acknowledgement of this notice in your browser’s local storage so it does not ask again. That value never leaves your browser.',
      ],
    },
    {
      heading: 'Third-party cookies',
      body: [
        'This app sets no third-party cookies. Links open on other websites, and those sites set their own cookies under their own policies.',
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalDoc['id'], LegalDoc> = {
  terms: TERMS,
  privacy: PRIVACY,
  cookies: COOKIES,
};
