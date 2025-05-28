import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPolicyComponent,
});

function PrivacyPolicyComponent() {
  const context = Route.useRouteContext();
  const config = context().config;

  const githubUrl = () => (config.GITHUB_REPO ? `https://github.com/${config.GITHUB_REPO}` : "");
  const supportEmail = () => config.SUPPORT_EMAIL || "";

  return (
    <div class="mx-auto max-w-4xl px-4 py-12">
      <div class="mb-8">
        <h1 class="mb-4 font-bold text-3xl md:text-4xl">Privacy Policy</h1>
        <p class="text-slate-300">Last updated: {new Date().toLocaleDateString()}</p>
      </div>

      <div class="space-y-8 text-slate-200">
        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">1. Data Controller and Contact Information</h2>
          <div class="space-y-4">
            <div>
              <h3 class="mb-2 font-medium text-lg text-white">Responsible Party (Controller)</h3>
              <p>
                The data controller for this website is the operator of Tune Perfect, a non-commercial open-source project. You can contact
                us at{" "}
                <a href={`mailto:${supportEmail()}`} class="text-blue-400 underline hover:text-blue-300">
                  {supportEmail()}
                </a>{" "}
                or through our{" "}
                <a href={githubUrl()} target="_blank" rel="noopener noreferrer" class="text-blue-400 underline hover:text-blue-300">
                  GitHub repository
                </a>
                .
              </p>
            </div>
            <div>
              <h3 class="mb-2 font-medium text-lg text-white">Data Protection Officer</h3>
              <p>
                If you have questions about data protection, you can contact us at{" "}
                <a href={`mailto:${supportEmail()}`} class="text-blue-400 underline hover:text-blue-300">
                  {supportEmail()}
                </a>
                .
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">2. General Information About Data Processing</h2>
          <div class="space-y-4">
            <div>
              <h3 class="mb-2 font-medium text-lg text-white">Scope of Personal Data Processing</h3>
              <p>
                We process personal data of our users only to the extent necessary to provide a functional website and our gaming services.
                Tune Perfect is a non-commercial, open-source project that does not generate revenue. The processing of personal data takes
                place regularly only with the consent of the user. An exception applies in cases where prior consent cannot be obtained for
                factual reasons and the processing of the data is permitted by law.
              </p>
            </div>
            <div>
              <h3 class="mb-2 font-medium text-lg text-white">Legal Basis for Data Processing</h3>
              <p>
                Insofar as we obtain consent from the data subject for personal data processing operations, Art. 6 para. 1 lit. a EU General
                Data Protection Regulation (GDPR) serves as the legal basis.
              </p>
              <p class="mt-2">
                When processing personal data that is necessary for the performance of providing our free gaming service, Art. 6 para. 1
                lit. b GDPR serves as the legal basis.
              </p>
              <p class="mt-2">
                When processing personal data that is necessary for compliance with a legal obligation, Art. 6 para. 1 lit. c GDPR serves as
                the legal basis.
              </p>
              <p class="mt-2">
                When processing personal data that is necessary to protect the vital interests of the data subject or another natural
                person, Art. 6 para. 1 lit. d GDPR serves as the legal basis.
              </p>
              <p class="mt-2">
                If processing is necessary to safeguard a legitimate interest (such as maintaining the security and functionality of our
                free service) and if the interests, fundamental rights and freedoms of the data subject do not outweigh this interest, Art.
                6 para. 1 lit. f GDPR serves as the legal basis for processing.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">3. Server Log Files</h2>
          <p>
            The website provider automatically collects and stores information in so-called server log files, which your browser
            automatically transmits to us. These are:
          </p>
          <ul class="mt-2 list-disc space-y-2 pl-6">
            <li>Browser type and browser version</li>
            <li>Operating system used</li>
            <li>Referrer URL</li>
            <li>Host name of the accessing computer</li>
            <li>Time of the server request</li>
            <li>IP address</li>
          </ul>
          <p class="mt-4">
            This data is not merged with other data sources. The basis for data processing is Art. 6 para. 1 lit. f GDPR, which allows the
            processing of data to fulfill a contract or for measures preliminary to a contract.
          </p>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">4. Information We Collect</h2>
          <div class="space-y-4">
            <div>
              <h3 class="mb-2 font-medium text-lg text-white">Account Information</h3>
              <ul class="list-disc space-y-2 pl-6">
                <li>Email address (required for account creation and verification)</li>
                <li>Username (optional, for your profile display)</li>
                <li>Password (securely hashed and stored)</li>
                <li>Profile image (optional)</li>
              </ul>
              <p class="mt-2 text-slate-300 text-sm">Legal basis: Art. 6 para. 1 lit. b GDPR (performance of contract)</p>
            </div>
            <div>
              <h3 class="mb-2 font-medium text-lg text-white">OAuth Information</h3>
              <ul class="list-disc space-y-2 pl-6">
                <li>When you sign in with Discord or Google, we store your account ID from those services</li>
                <li>We do not store your passwords from third-party services</li>
              </ul>
              <p class="mt-2 text-slate-300 text-sm">Legal basis: Art. 6 para. 1 lit. b GDPR (performance of contract)</p>
            </div>
            <div>
              <h3 class="mb-2 font-medium text-lg text-white">Game Data</h3>
              <ul class="list-disc space-y-2 pl-6">
                <li>Your game scores and high scores</li>
                <li>Lobby participation data</li>
                <li>Game session information</li>
              </ul>
              <p class="mt-2 text-slate-300 text-sm">Legal basis: Art. 6 para. 1 lit. b GDPR (performance of contract)</p>
            </div>
            <div>
              <h3 class="mb-2 font-medium text-lg text-white">Technical Information</h3>
              <ul class="list-disc space-y-2 pl-6">
                <li>User agent information (for security purposes)</li>
                <li>Session tokens (for keeping you logged in)</li>
                <li>Account creation and update timestamps</li>
                <li>IP addresses (for security and fraud prevention)</li>
              </ul>
              <p class="mt-2 text-slate-300 text-sm">
                Legal basis: Art. 6 para. 1 lit. f GDPR (legitimate interests in security and fraud prevention)
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">5. How We Use Your Information</h2>
          <ul class="list-disc space-y-2 pl-6">
            <li>To create and manage your account</li>
            <li>To provide the karaoke gaming experience</li>
            <li>To save your game progress and high scores</li>
            <li>To enable multiplayer lobby functionality</li>
            <li>To send account verification emails</li>
            <li>To maintain the security of your account and prevent fraud</li>
            <li>To comply with legal obligations</li>
            <li>To improve our services based on usage patterns</li>
          </ul>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">6. Data Storage and Security</h2>
          <ul class="list-disc space-y-2 pl-6">
            <li>Your data is stored securely in our database with appropriate technical and organizational measures</li>
            <li>Passwords are hashed using industry-standard encryption (argon2id)</li>
            <li>We use secure tokens for authentication</li>
            <li>Email verification is required for account activation</li>
            <li>Access to personal data is restricted to authorized personnel only</li>
            <li>We regularly review and update our security measures</li>
          </ul>
        </section>

        <section>
          <h2 class="mb-4 font-semibent text-white text-xl">7. Data Sharing and Third Parties</h2>
          <p class="mb-2">We do not sell, trade, or share your personal information with third parties, except:</p>
          <ul class="list-disc space-y-2 pl-6">
            <li>When required by law or legal process</li>
            <li>To protect our rights, property, and safety, or that of our users</li>
            <li>With your explicit consent</li>
            <li>With service providers who assist us in operating our website (under strict data processing agreements)</li>
          </ul>
          <p class="mt-4">
            Any third-party service providers are carefully selected and contractually bound to process data only according to our
            instructions and in compliance with GDPR. As a non-commercial project, we have no financial incentive to share your data.
          </p>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">8. International Data Transfers</h2>
          <p>
            If we transfer personal data to countries outside the European Economic Area (EEA), we ensure appropriate safeguards are in
            place, such as:
          </p>
          <ul class="mt-2 list-disc space-y-2 pl-6">
            <li>Adequacy decisions by the European Commission</li>
            <li>Standard contractual clauses approved by the European Commission</li>
            <li>Binding corporate rules</li>
            <li>Certification schemes</li>
          </ul>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">9. Your Rights Under GDPR</h2>
          <p class="mb-2">Under the General Data Protection Regulation, you have the following rights:</p>
          <ul class="list-disc space-y-2 pl-6">
            <li>
              <strong>Right of access (Art. 15 GDPR):</strong> You can request information about your personal data we process
            </li>
            <li>
              <strong>Right to rectification (Art. 16 GDPR):</strong> You can request correction of inaccurate personal data
            </li>
            <li>
              <strong>Right to erasure (Art. 17 GDPR):</strong> You can request deletion of your personal data
            </li>
            <li>
              <strong>Right to restriction of processing (Art. 18 GDPR):</strong> You can request limitation of processing
            </li>
            <li>
              <strong>Right to data portability (Art. 20 GDPR):</strong> You can request your data in a portable format
            </li>
            <li>
              <strong>Right to object (Art. 21 GDPR):</strong> You can object to processing based on legitimate interests
            </li>
            <li>
              <strong>Right to withdraw consent:</strong> Where processing is based on consent, you can withdraw it at any time
            </li>
          </ul>
          <p class="mt-4">
            To exercise these rights, please contact us at{" "}
            <a href={`mailto:${supportEmail()}`} class="text-blue-400 underline hover:text-blue-300">
              {supportEmail()}
            </a>
            .
          </p>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">10. Data Retention</h2>
          <p class="mb-2">
            We retain your data for as long as your account is active or as needed to provide you services. When you delete your account:
          </p>
          <ul class="list-disc space-y-2 pl-6">
            <li>Your personal information is permanently deleted within 30 days</li>
            <li>Your game scores may be anonymized for statistical purposes</li>
            <li>Some data may be retained for legal compliance if required by law</li>
            <li>Backup copies are deleted according to our backup retention schedule (maximum 90 days)</li>
          </ul>
          <p class="mt-4">
            We review our data retention practices regularly and delete data when it is no longer necessary for the purposes for which it
            was collected. As a non-commercial project, we have no business interest in retaining your data longer than necessary.
          </p>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">11. Cookies and Tracking</h2>
          <div class="space-y-4">
            <div>
              <h3 class="mb-2 font-medium text-lg text-white">Essential Cookies</h3>
              <p>
                We use session cookies to keep you logged in and ensure proper functionality of our service. These are necessary for the
                operation of our website.
              </p>
              <p class="mt-2 text-slate-300 text-sm">
                Legal basis: Art. 6 para. 1 lit. f GDPR (legitimate interest in website functionality)
              </p>
            </div>
            <div>
              <h3 class="mb-2 font-medium text-lg text-white">Analytics and Performance</h3>
              <p>
                We may use analytics cookies to understand how our website is used and to improve our services. We only use privacy-friendly
                analytics that do not track individual users.
              </p>
              <p class="mt-2 text-slate-300 text-sm">
                Legal basis: Art. 6 para. 1 lit. f GDPR (legitimate interest in website improvement)
              </p>
            </div>
            <div>
              <h3 class="mb-2 font-medium text-lg text-white">Cookie Control</h3>
              <p>
                You can control cookies through your browser settings. However, disabling certain cookies may affect the functionality of
                our website.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">12. Children's Privacy</h2>
          <p>
            Tune Perfect is not intended for children under 16 years of age. We do not knowingly collect personal information from children
            under 16. If we become aware that we have collected personal data from a child under 16 without parental consent, we will take
            steps to delete such information.
          </p>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">13. Automated Decision Making and Profiling</h2>
          <p>
            We do not use automated decision-making or profiling that would have legal effects or similarly significantly affect you. Any
            automated processing we perform (such as game scoring) is purely functional and does not involve profiling of personal
            characteristics.
          </p>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">14. Right to Lodge a Complaint</h2>
          <p>
            You have the right to lodge a complaint with a supervisory authority if you believe that the processing of your personal data
            violates the GDPR. You can contact your local data protection authority or the authority in the country where you believe the
            violation occurred.
          </p>
          <p class="mt-2">
            For Germany, you can contact the Federal Commissioner for Data Protection and Freedom of Information (Bundesbeauftragte für den
            Datenschutz und die Informationsfreiheit) or your local state data protection authority.
          </p>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">15. Changes to This Policy</h2>
          <p>
            We may update this privacy policy from time to time to reflect changes in our practices or for other operational, legal, or
            regulatory reasons. We will notify you of any material changes by posting the new policy on this page and updating the "Last
            updated" date. For significant changes, we may also send you a notification via email.
          </p>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">16. Contact Us</h2>
          <p>If you have any questions about this privacy policy or our data practices, please contact us:</p>
          <ul class="mt-2 list-disc space-y-2 pl-6">
            <li>
              Email:{" "}
              <a href={`mailto:${supportEmail()}`} class="text-blue-400 underline hover:text-blue-300">
                {supportEmail()}
              </a>
            </li>
            <li>
              GitHub:{" "}
              <a href={githubUrl()} target="_blank" rel="noopener noreferrer" class="text-blue-400 underline hover:text-blue-300">
                {githubUrl()}
              </a>
            </li>
          </ul>
          <p class="mt-4">
            We will respond to your inquiry within one month, or sooner if possible. In complex cases, we may extend this period by two
            additional months, in which case we will inform you of the extension and the reasons for it.
          </p>
        </section>
      </div>
    </div>
  );
}
