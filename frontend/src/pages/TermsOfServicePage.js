import React from "react";

import LegalLayout from "../components/LegalLayout";

const TermsOfServicePage = () => (
  <LegalLayout
    kind="terms"
    title="Terms of Service"
    intro={
      "Welcome to Moodify. By using our application you agree to these Terms of Service. Please read them carefully — they set out what you can expect from us and what we ask of you."
    }
    sections={[
      {
        title: "Acceptance of Terms",
        body: (
          <p>
            By creating an account or otherwise using Moodify, you agree to be
            bound by these terms. If you don't agree, please stop using the
            service.
          </p>
        ),
      },
      {
        title: "Using the Service",
        body: (
          <ul>
            <li>
              Be at least 13 years old. Users under 18 should have a parent or
              guardian's consent.
            </li>
            <li>
              Provide accurate registration information and keep your
              credentials confidential.
            </li>
            <li>
              Use the service for personal, non-commercial purposes unless we
              agree in writing otherwise.
            </li>
          </ul>
        ),
      },
      {
        title: "Acceptable Use",
        body: (
          <>
            <p>
              You agree <strong>not</strong> to:
            </p>
            <ul>
              <li>
                Attempt to bypass authentication, rate limits, or other
                technical protections.
              </li>
              <li>
                Submit illegal, abusive, or infringing content through any of
                the mood-detection inputs.
              </li>
              <li>
                Scrape, mirror, or otherwise reuse the service to power a
                competing product.
              </li>
              <li>
                Probe the inference endpoints with adversarial payloads designed
                to incur compute cost.
              </li>
            </ul>
          </>
        ),
      },
      {
        title: "Recommendations & Third-Party Services",
        body: (
          <>
            <p>
              Music recommendations are powered by{" "}
              <a href="https://deezer.com" target="_blank" rel="noreferrer">
                Deezer
              </a>
              's free, public Search API. Tapping a track opens it in Deezer's
              web player. Deezer's own terms apply to playback; Moodify is not
              responsible for content or availability on that side.
            </p>
            <p>
              Mood detection is performed by self-trained machine-learning
              models. Results are best-effort and should not be used for
              medical, psychiatric, or any high-stakes decisions.
            </p>
          </>
        ),
      },
      {
        title: "Your Content",
        body: (
          <p>
            Text, audio, and image inputs you submit are processed in-memory by
            our inference service and are <strong>not retained</strong> after
            the response is built. The detected mood and the resulting
            recommendations are stored against your account so the app can
            personalize over time; you can wipe them at any time from your
            Profile.
          </p>
        ),
      },
      {
        title: "Service Availability",
        body: (
          <p>
            The Django API runs on Vercel and the inference service runs on
            Modal with scale-to-zero. Cold starts may add up to a couple of
            seconds to the first request after idle. We don't guarantee an
            uptime SLA on the free deploy.
          </p>
        ),
      },
      {
        title: "Termination",
        body: (
          <p>
            You can delete your account at any time from Profile → Settings →
            "Delete account". We may suspend or terminate accounts that violate
            these terms or that abuse the inference endpoints in a way that puts
            the service at risk.
          </p>
        ),
      },
      {
        title: "Disclaimer of Warranties",
        body: (
          <p>
            Moodify is provided "as is" without warranties of any kind. We make
            no guarantees about the accuracy of mood detection, availability of
            any specific track, or fitness for a particular purpose.
          </p>
        ),
      },
      {
        title: "Limitation of Liability",
        body: (
          <p>
            To the maximum extent permitted by law, Moodify and its maintainer
            are not liable for any indirect, incidental, consequential, or
            punitive damages arising out of your use of the service.
          </p>
        ),
      },
      {
        title: "Changes to these Terms",
        body: (
          <p>
            We may update these terms occasionally. Continued use after a change
            constitutes acceptance of the new terms; material changes will be
            announced in the app.
          </p>
        ),
      },
      {
        title: "Contact",
        body: (
          <p>
            Questions about these terms?{" "}
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

export default TermsOfServicePage;
