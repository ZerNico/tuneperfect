;

export const Route = createFileRoute({
  component: TermsOfServiceComponent,
});

function TermsOfServiceComponent() {
  const context = Route.useRouteContext();
  const config = context().config;

  const githubUrl = () => (config.GITHUB_REPO ? `https://github.com/${config.GITHUB_REPO}` : "");
  const supportEmail = () => config.SUPPORT_EMAIL || "";

  return (
    <div class="mx-auto max-w-4xl px-4 py-12">
      <div class="mb-8">
        <h1 class="mb-4 font-bold text-3xl md:text-4xl">Terms of Service</h1>
        <p class="text-slate-300">Last updated: {new Date().toLocaleDateString()}</p>
      </div>

      <div class="space-y-8 text-slate-200">
        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">1. Welcome to Tune Perfect!</h2>
          <p>
            By using Tune Perfect, you're agreeing to these terms. We've tried to keep them fair and straightforward. If something doesn't
            seem right to you, feel free to reach out to us!
          </p>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">2. What Tune Perfect Offers</h2>
          <p class="mb-2">Tune Perfect is an open-source karaoke gaming application that lets you:</p>
          <ul class="list-disc space-y-2 pl-6">
            <li>Sing along to songs with real-time pitch detection</li>
            <li>Have fun competing with friends in multiplayer lobbies</li>
            <li>Track your scores and celebrate achievements</li>
            <li>Create and manage your user account</li>
            <li>Join online gaming sessions with other players</li>
          </ul>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">3. Your Account</h2>
          <div class="space-y-4">
            <div>
              <h3 class="mb-2 font-medium text-lg text-white">Setting Up Your Account</h3>
              <ul class="list-disc space-y-2 pl-6">
                <li>Please provide accurate information when creating your account</li>
                <li>Keep your login details secure - they're your key to the game!</li>
                <li>We'll need you to verify your email address to get started</li>
                <li>One account per person helps keep things fair for everyone</li>
              </ul>
            </div>
            <div>
              <h3 class="mb-2 font-medium text-lg text-white">Taking Care of Your Account</h3>
              <ul class="list-disc space-y-2 pl-6">
                <li>You're responsible for what happens with your account</li>
                <li>Let us know right away if you notice any suspicious activity</li>
                <li>Please keep your account to yourself - sharing can cause issues</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">4. Playing Nice Together</h2>
          <p class="mb-2">To keep Tune Perfect fun for everyone, please don't:</p>
          <ul class="list-disc space-y-2 pl-6">
            <li>Break any laws or regulations</li>
            <li>Be mean to other players - we're all here to have fun!</li>
            <li>Use offensive or inappropriate usernames or content</li>
            <li>
              Try to hack or exploit the game - if you find bugs, please report them on{" "}
              <a href={githubUrl()} target="_blank" rel="noopener noreferrer" class="text-blue-400 underline hover:text-blue-300">
                GitHub
              </a>
              !
            </li>
            <li>Create multiple accounts or use bots</li>
            <li>Disrupt the game experience for others</li>
            <li>Upload anything harmful or malicious</li>
          </ul>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">5. Your Scores and Achievements</h2>
          <ul class="list-disc space-y-2 pl-6">
            <li>We store your game scores and achievements to track your progress</li>
            <li>If we detect cheating, we might need to reset scores to keep things fair</li>
            <li>Your high scores might be shown to other players - time to show off!</li>
            <li>While we do our best, we can't guarantee score data will always be perfect</li>
          </ul>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">6. Multiplayer Fun</h2>
          <ul class="list-disc space-y-2 pl-6">
            <li>Lobby availability depends on server capacity and technical factors</li>
            <li>We temporarily store lobby data during your gaming session</li>
            <li>Please be respectful to other players in multiplayer games</li>
          </ul>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">7. Open Source and Licensing</h2>
          <ul class="list-disc space-y-2 pl-6">
            <li>Tune Perfect is open source and released under the MIT License</li>
            <li>
              You're free to view, modify, and contribute to the source code on{" "}
              <a href={githubUrl()} target="_blank" rel="noopener noreferrer" class="text-blue-400 underline hover:text-blue-300">
                GitHub
              </a>
            </li>
            <li>The MIT License gives you broad permissions to use and modify the software</li>
            <li>Song content may be subject to separate copyright restrictions</li>
          </ul>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">8. Your Privacy Matters</h2>
          <p>
            We care about your privacy and try to collect only what we need to make the game work well. Please check out our Privacy Policy
            to see how we handle your information. By playing Tune Perfect, you're okay with how we manage data as described there.
          </p>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">9. Keeping the Lights On</h2>
          <ul class="list-disc space-y-2 pl-6">
            <li>We work hard to keep Tune Perfect running smoothly, but sometimes things happen</li>
            <li>Occasionally we need to do maintenance that might interrupt your game</li>
            <li>We might add new features or change existing ones - we'll try to give you a heads up</li>
            <li>While we do our best, we can't be responsible for lost progress due to technical issues</li>
          </ul>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">10. When Things Go Wrong</h2>
          <p class="mb-2">We might need to suspend accounts if someone:</p>
          <ul class="list-disc space-y-2 pl-6">
            <li>Repeatedly breaks these terms</li>
            <li>Does something illegal or fraudulent</li>
            <li>Consistently bothers or harasses other players</li>
            <li>Tries to compromise the security of the game</li>
          </ul>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">11. The Fine Print</h2>
          <ul class="list-disc space-y-2 pl-6">
            <li>Tune Perfect is provided as-is - we're doing our best but can't promise perfection</li>
            <li>Pitch detection and scoring do their best but might not always be spot-on</li>
            <li>We can't guarantee compatibility with every device or setup</li>
            <li>You use the game at your own discretion</li>
          </ul>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">12. Liability Limits</h2>
          <p>
            While we strive to provide a great experience, we can't be held responsible for indirect damages, lost profits, or data loss
            that might result from using Tune Perfect. This is pretty standard for software services and helps us keep the game free and
            open.
          </p>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">13. Updates to These Terms</h2>
          <p>
            Sometimes we might need to update these terms. When we do, we'll post the changes here and let you know about any big updates.
            If you keep using Tune Perfect after we make changes, that means you're cool with the new terms.
          </p>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">14. Legal Stuff</h2>
          <p>
            These terms follow applicable laws, and any disputes would be handled through appropriate legal channels. We hope it never comes
            to that though!
          </p>
        </section>

        <section>
          <h2 class="mb-4 font-semibold text-white text-xl">15. Get in Touch</h2>
          <p>
            Got questions about these terms? Found a bug? Want to contribute? <br />
            Reach out to us through our{" "}
            <a href={githubUrl()} target="_blank" rel="noopener noreferrer" class="text-blue-400 underline hover:text-blue-300">
              GitHub repository
            </a>{" "}
            or email us at{" "}
            <a href={`mailto:${supportEmail()}`} class="text-blue-400 underline hover:text-blue-300">
              {supportEmail()}
            </a>
            <br />
            We'd love to hear from you!
          </p>
        </section>
      </div>
    </div>
  );
}
