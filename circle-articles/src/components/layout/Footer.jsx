export default function Footer() {
  return (
    <footer className="border-t border-border mt-12 py-8 text-center text-txt3 text-sm">
      <div className="max-w-screen-lg mx-auto px-4">
        © {new Date().getFullYear()} Circle. All rights reserved.
      </div>
    </footer>
  );
}