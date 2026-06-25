export default function Footer() {
  return (
    <footer className="border-t border-border mt-12 py-8 text-txt3 text-sm">
      <div className="max-w-screen-lg mx-auto px-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-txt">Circle Blog</p>
          <p>© {new Date().getFullYear()} Circle. All rights reserved.</p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 text-sm">
          <a href="/about" className="hover:text-accent transition-colors">
            About
          </a>
          <a href="/privacy-policy" className="hover:text-accent transition-colors">
            Privacy Policy
          </a>
          <a href="/contact" className="hover:text-accent transition-colors">
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}