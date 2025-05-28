export default function Footer() {
  return (
    <footer class="border-white/10 border-t bg-[#101024]/80 backdrop-blur-lg">
      <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
        <div class="flex items-center gap-4 text-sm text-slate-400">
          <span>© {new Date().getFullYear()} Tune Perfect</span>
        </div>
        <div class="flex items-center gap-4 text-sm">
          <a 
            href="/privacy-policy" 
            class="text-slate-400 transition-colors hover:text-white"
          >
            Privacy Policy
          </a>
          <a 
            href="/terms-of-service" 
            class="text-slate-400 transition-colors hover:text-white"
          >
            Terms of Service
          </a>
        </div>
      </div>
    </footer>
  );
} 