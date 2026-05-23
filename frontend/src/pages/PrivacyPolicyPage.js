import React from "react";

import LegalLayout from "../components/LegalLayout";

const PrivacyPolicyPage = () => (
  <LegalLayout
    kind="privacy"
    title="Privacy Policy"
    intro={
      "At Moodify, we value your privacy and are committed to protecting your personal information. This policy explains how we collect, use, and safeguard your data when you use our application."
    }
    sections={[
      {
        title: "Data Collection",
        body: (
          <>
            <p>We collect the following types of information:</p>
            <ul>
              <li>
                <strong>Personal Information:</strong> Username, email
                address, and (hashed) password — only what's required to
                create and protect your account.
              </li>
              <li>
                <strong>Mood &amp; Listening History:</strong> The moods you
                analyze, recommendations you save, and tracks you open. Used
                to personalize future recommendations on your account only.
              </li>
              <li>
                <strong>Inference Inputs:</strong> Text snippets, voice
                clips, or photos you submit for mood detection. Processed
                in-memory by our inference service and{" "}
                <strong>not retained</strong> after the response is built.
              </li>
            </ul>
          </>
        ),
      },
      {
        title: "How We Use Your Data",
        body: (
          <>
            <ul>
              <li>To authenticate you and keep your account secure.</li>
              <li>
                To personalize your mood-based recommendations via a small
                on-the-fly recency-weighted model that runs per request.
              </li>
              <li>
                To diagnose problems and improve the service in aggregate —
                we never inspect individual accounts unless required by law.
              </li>
            </ul>
          </>
        ),
      },
      {
        title: "Where Your Data Lives",
        body: (
          <>
            <p>
              Your account and history are stored in a managed MongoDB
              Atlas cluster. The Django API runs on Vercel; the ML
              inference service runs on Modal. Each request to the
              recommender hits Deezer's free, keyless Search API for the
              track list; no listening data is shared with third parties.
            </p>
          </>
        ),
      },
      {
        title: "Cookies &amp; Local Storage",
        body: (
          <>
            <p>
              We use <strong>localStorage</strong> in your browser to keep
              your JWT access + refresh tokens so you stay signed in across
              tabs. We do <strong>not</strong> use third-party analytics or
              advertising cookies.
            </p>
          </>
        ),
      },
      {
        title: "Your Choices",
        body: (
          <>
            <ul>
              <li>
                <strong>View your data:</strong> Your Profile page shows
                everything we have for you.
              </li>
              <li>
                <strong>Clear individual histories:</strong> Mood, listening
                and saved-recommendations histories each have a one-tap
                "Clear all" action.
              </li>
              <li>
                <strong>Delete your account:</strong> Settings → "Delete
                account" permanently removes your account and every record
                tied to it.
              </li>
            </ul>
          </>
        ),
      },
      {
        title: "Security",
        body: (
          <>
            <p>
              Passwords are stored using PBKDF2 hashing — never in plain
              text. All traffic is TLS-encrypted in transit. Auth uses
              short-lived JWT access tokens with silent refresh; tokens
              live only in your browser's localStorage.
            </p>
          </>
        ),
      },
      {
        title: "Children's Privacy",
        body: (
          <p>
            Moodify is not directed at children under 13. We do not
            knowingly collect personal information from anyone under 13.
          </p>
        ),
      },
      {
        title: "Changes to this Policy",
        body: (
          <p>
            We may update this policy from time to time. Material changes
            will be announced in the app and reflected here with a new "Last
            updated" date.
          </p>
        ),
      },
      {
        title: "Contact",
        body: (
          <p>
            Questions, concerns, or data-removal requests:{" "}
            <a href="mailto:hoangson091104@gmail.com">
              hoangson091104@gmail.com
            </a>
            .
          </p>
        ),
      },
    ]}
  />
);

export default PrivacyPolicyPage;
