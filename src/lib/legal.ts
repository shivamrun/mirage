import { siteConfig } from "@/lib/metadata";

export const legalLastUpdated = "September 10, 2026";

export const privacySections = [
  {
    title: "Information We Collect",
    body: [
      `${siteConfig.name} may collect account information such as your email address, authentication details, and profile information you choose to provide.`,
      "When you submit the contact form, we collect the name, email address, company, message, and any other details you include so we can review and respond to your request.",
      "We may also collect basic technical information such as device, browser, session, and log data needed to keep the service secure and reliable.",
    ],
  },
  {
    title: "How We Use Information",
    body: [
      "We use collected information to provide the service, authenticate users, protect accounts, respond to messages, improve reliability, and maintain administrative records.",
      "We do not sell personal information. We only share information with service providers or authorities when needed to operate the service, comply with law, or protect rights and safety.",
    ],
  },
  {
    title: "Retention",
    body: [
      "We keep information only as long as reasonably needed for the purposes described here, including security, support, legal, and operational requirements.",
      "Contact submissions and account records may be retained until they are no longer needed or you request deletion where applicable.",
    ],
  },
  {
    title: "Your Choices",
    body: [
      "You may request access, correction, or deletion of your personal information by contacting us. Some information may be retained where required for security, legal compliance, or legitimate operational needs.",
      "You are responsible for keeping your account credentials confidential and for using a current email address for account communications.",
    ],
  },
  {
    title: "Security",
    body: [
      "We use reasonable technical and administrative safeguards to protect information. No method of storage or transmission is completely secure, so we cannot guarantee absolute security.",
    ],
  },
] as const;

export const termsSections = [
  {
    title: "Using the Service",
    body: [
      `By creating an account or using ${siteConfig.name}, you agree to use the service only for lawful purposes and in a way that does not interfere with other users or the operation of the platform.`,
      "You are responsible for the activity on your account and for keeping your login credentials secure.",
    ],
  },
  {
    title: "Accounts",
    body: [
      "You must provide accurate account information and maintain access to the email address associated with your account.",
      "We may suspend or restrict access if we believe an account is being misused, creates security risk, or violates these terms.",
    ],
  },
  {
    title: "Content and Submissions",
    body: [
      "You retain responsibility for content you submit, including contact messages and profile information. Do not submit confidential, unlawful, or third-party information unless you have the right to do so.",
      "You grant us the limited permission needed to process, store, display, and use your submissions to operate and improve the service.",
    ],
  },
  {
    title: "Service Changes",
    body: [
      "We may update, suspend, or discontinue parts of the service as the product evolves. We will try to avoid unnecessary disruption, but availability is not guaranteed.",
    ],
  },
  {
    title: "Disclaimers and Liability",
    body: [
      "The service is provided as is and as available. To the fullest extent permitted by law, we disclaim warranties and limit liability for indirect, incidental, special, consequential, or punitive damages.",
      "Nothing in these terms limits rights or obligations that cannot be limited under applicable law.",
    ],
  },
] as const;

export const cookieSections = [
  {
    title: "How Cookies Are Used",
    body: [
      `${siteConfig.name} may use cookies and similar storage technologies to keep you signed in, remember security-related choices, operate authentication flows, and understand basic service performance.`,
      "Some cookies are essential for account and security features. Without them, parts of the service may not function correctly.",
    ],
  },
  {
    title: "Analytics and Preferences",
    body: [
      "If analytics or preference tools are enabled, they may use cookies or local storage to measure aggregate usage or remember choices you make in the product.",
      "We avoid using cookies in ways that are unrelated to operating, securing, or improving the service.",
    ],
  },
  {
    title: "Managing Cookies",
    body: [
      "Most browsers let you block, delete, or limit cookies. Changing cookie settings may affect sign-in, account security, and other product functionality.",
    ],
  },
] as const;

export const acceptableUseSections = [
  {
    title: "Allowed Use",
    body: [
      `Use ${siteConfig.name} in a lawful, respectful, and responsible way. The service is intended for ordinary account, contact, and administrative workflows.`,
    ],
  },
  {
    title: "Prohibited Activity",
    body: [
      "Do not attempt to disrupt, probe, overload, reverse engineer, scrape, or bypass security controls for the service.",
      "Do not upload, transmit, or submit content that is unlawful, harmful, abusive, deceptive, infringing, or designed to compromise systems or data.",
      "Do not impersonate others, misrepresent your affiliation, or use the service to send spam or unauthorized communications.",
    ],
  },
  {
    title: "Enforcement",
    body: [
      "We may remove content, restrict access, suspend accounts, or take other action when we believe activity violates this policy or creates risk for the service, users, or third parties.",
    ],
  },
] as const;
