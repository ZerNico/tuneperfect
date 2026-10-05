import { createFileRoute } from "@tanstack/solid-router";

import Glow from "~/components/glow";
import Tag from "~/components/ui/tag";

export const Route = createFileRoute("/terms-of-service")({
  component: TermsOfServiceComponent,
});

function TermsOfServiceComponent() {
  const context = Route.useRouteContext();
  const config = context().config;

  const githubUrl = () => (config.GITHUB_REPO ? `https://github.com/${config.GITHUB_REPO}` : "");
  const supportEmail = () => config.SUPPORT_EMAIL || "";

  return (
    <div class="relative mx-auto max-w-3xl px-5 pt-32 pb-24">
      <Glow mode="title" class="-inset-x-[30%] top-0 h-[40rem]" strength={0.7} />
      <div class="mb-14 flex flex-col items-start gap-4">
        <Tag>Legal</Tag>
        <h1 class="text-4xl font-bold md:text-6xl">Terms of Service</h1>
        <p class="text-white/50">Last updated: June 8th, 2025</p>
      </div>

      <div class="space-y-12 leading-relaxed text-white/75">
        <section>
          <h2 class="mb-4 text-2xl font-bold text-white">1. Welcome to Tune Perfect!</h2>
          <p>
            By using Tune Perfect, you're agreeing to these terms. We've tried to keep them fair and straightforward. If
            something doesn't seem right to you, feel free to reach out to us!
          </p>
        </section>

        <section>
          <h2 class="mb-4 text-2xl font-bold text-white">2. What Tune Perfect Offers</h2>
          <p class="mb-2">Tune Perfect is an open-source karaoke gaming application that lets you:</p>
          <ul class="list-disc space-y-2 pl-6 marker:text-white/40">
            <li>Sing along to songs with real-time pitch detection</li>
            <li>Have fun competing with friends in multiplayer lobbies</li>
            <li>Track your scores and celebrate achievements</li>
            <li>Create and manage your user account</li>
            <li>Join online gaming sessions with other players</li>
          </ul>
        </section>

        <section>
          <h2 class="mb-4 text-2xl font-bold text-white">3. Your Account</h2>
          <div class="space-y-4">
            <div>
              <h3 class="mb-2 text-lg font-bold text-white">Setting Up Your Account</h3>
              <ul class="list-disc space-y-2 pl-6 marker:text-white/40">
                <li>Please provide accurate information when creating your account</li>
                <li>Keep your login details secure - they're your key to the game!</li>
                <li>We'll need you to verify your email address to get started</li>
                <li>One account per person helps keep things fair for everyone</li>
              </ul>
            </div>
            <div>
              <h3 class="mb-2 text-lg font-bold text-white">Taking Care of Your Account</h3>
              <ul class="list-disc space-y-2 pl-6 marker:text-white/40">
                <li>You're responsible for what happens with your account</li>
                <li>Let us know right away if you notice any suspicious activity</li>
                <li>Please keep your account to yourself - sharing can cause issues</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 class="mb-4 text-2xl font-bold text-white">4. Playing Nice Together</h2>
          <p class="mb-2">To keep Tune Perfect fun for everyone, please don't:</p>
          <ul class="list-disc space-y-2 pl-6 marker:text-white/40">
            <li>Break any laws or regulations</li>
            <li>Be mean to other players - we're all here to have fun!</li>
            <li>Use offensive or inappropriate usernames or content</li>
            <li>
              Try to hack or exploit the game - if you find bugs, please report them on{" "}
              <a
                href={githubUrl()}
                target="_blank"
                rel="noopener noreferrer"
                class="font-bold text-sky-400 underline-offset-4 hover:underline"
              >
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
          <h2 class="mb-4 text-2xl font-bold text-white">5. Your Scores and Achievements</h2>
          <ul class="list-disc space-y-2 pl-6 marker:text-white/40">
            <li>We store your game scores and achievements to track your progress</li>
            <li>If we detect cheating, we might need to reset scores to keep things fair</li>
            <li>Your high scores might be shown to other players - time to show off!</li>
            <li>While we do our best, we can't guarantee score data will always be perfect</li>
          </ul>
        </section>

        <section>
          <h2 class="mb-4 text-2xl font-bold text-white">6. Multiplayer Fun</h2>
          <ul class="list-disc space-y-2 pl-6 marker:text-white/40">
            <li>Lobby availability depends on server capacity and technical factors</li>
            <li>We temporarily store lobby data during your gaming session</li>
            <li>Please be respectful to other players in multiplayer games</li>
          </ul>
        </section>

        <section>
          <h2 class="mb-4 text-2xl font-bold text-white">7. Open Source and Licensing</h2>
          <ul class="list-disc space-y-2 pl-6 marker:text-white/40">
            <li>Tune Perfect is open source and released under the MIT License</li>
            <li>
              You're free to view, modify, and contribute to the source code on{" "}
              <a
                href={githubUrl()}
                target="_blank"
                rel="noopener noreferrer"
                class="font-bold text-sky-400 underline-offset-4 hover:underline"
              >
                GitHub
              </a>
            </li>
            <li>The MIT License gives you broad permissions to use and modify the software</li>
            <li>Song content may be subject to separate copyright restrictions</li>
          </ul>
        </section>

        <section>
          <h2 class="mb-4 text-2xl font-bold text-white">8. Your Privacy Matters</h2>
          <p>
            We care about your privacy and try to collect only what we need to make the game work well. Please check out
            our Privacy Policy to see how we handle your information. By playing Tune Perfect, you're okay with how we
            manage data as described there.
          </p>
        </section>

        <section>
          <h2 class="mb-4 text-2xl font-bold text-white">9. Keeping the Lights On</h2>
          <ul class="list-disc space-y-2 pl-6 marker:text-white/40">
            <li>We work hard to keep Tune Perfect running smoothly, but sometimes things happen</li>
            <li>Occasionally we need to do maintenance that might interrupt your game</li>
            <li>We might add new features or change existing ones - we'll try to give you a heads up</li>
            <li>While we do our best, we can't be responsible for lost progress due to technical issues</li>
          </ul>
        </section>

        <section>
          <h2 class="mb-4 text-2xl font-bold text-white">10. When Things Go Wrong</h2>
          <p class="mb-2">We might need to suspend accounts if someone:</p>
          <ul class="list-disc space-y-2 pl-6 marker:text-white/40">
            <li>Repeatedly breaks these terms</li>
            <li>Does something illegal or fraudulent</li>
            <li>Consistently bothers or harasses other players</li>
            <li>Tries to compromise the security of the game</li>
          </ul>
        </section>

        <section>
          <h2 class="mb-4 text-2xl font-bold text-white">11. The Fine Print</h2>
          <ul class="list-disc space-y-2 pl-6 marker:text-white/40">
            <li>Tune Perfect is provided as-is - we're doing our best but can't promise perfection</li>
            <li>Pitch detection and scoring do their best but might not always be spot-on</li>
            <li>We can't guarantee compatibility with every device or setup</li>
            <li>You use the game at your own discretion</li>
          </ul>
        </section>

        <section>
          <h2 class="mb-4 text-2xl font-bold text-white">12. Liability Limits</h2>
          <p>
            While we strive to provide a great experience, we can't be held responsible for indirect damages, lost
            profits, or data loss that might result from using Tune Perfect. This is pretty standard for software
            services and helps us keep the game free and open.
          </p>
        </section>

        <section>
          <h2 class="mb-4 text-2xl font-bold text-white">13. Updates to These Terms</h2>
          <p>
            Sometimes we might need to update these terms. When we do, we'll post the changes here and let you know
            about any big updates. If you keep using Tune Perfect after we make changes, that means you're cool with the
            new terms.
          </p>
        </section>

        <section>
          <h2 class="mb-4 text-2xl font-bold text-white">14. Legal Stuff</h2>
          <p>
            These terms follow applicable laws, and any disputes would be handled through appropriate legal channels. We
            hope it never comes to that though!
          </p>
        </section>

        <section>
          <h2 class="mb-4 text-2xl font-bold text-white">15. Get in Touch</h2>
          <p>
            Got questions about these terms? Found a bug? Want to contribute? <br />
            Reach out to us through our{" "}
            <a
              href={githubUrl()}
              target="_blank"
              rel="noopener noreferrer"
              class="font-bold text-sky-400 underline-offset-4 hover:underline"
            >
              GitHub repository
            </a>{" "}
            or email us at{" "}
            <a href={`mailto:${supportEmail()}`} class="font-bold text-sky-400 underline-offset-4 hover:underline">
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
