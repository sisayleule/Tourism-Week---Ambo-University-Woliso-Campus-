import React from 'react';
import { NavLink } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

export const Legal: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="border-b border-stone-200 dark:border-stone-800 pb-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#0F3D2E] dark:text-[#D9A441] mb-1 uppercase tracking-wider">
          <ShieldCheck className="h-4 w-4" />
          <span>Institutional Policies</span>
        </div>
        <h1 className="font-display text-3xl font-bold text-stone-900 dark:text-stone-100">
          Privacy Policy & Terms of Public Participation
        </h1>
      </div>

      <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm text-stone-700 dark:text-stone-300 space-y-6 leading-relaxed">
        <section className="space-y-2">
          <h2 className="font-display font-bold text-lg text-stone-900 dark:text-stone-100">
            1. Public Access & Zero Data Collection Policy
          </h2>
          <p>
            The Ambo University Woliso Campus Tourism Week website is intentionally engineered as an open, public informational resource. We do not require visitors to register accounts, purchase tickets, log in, or install tracking cookies.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-lg text-stone-900 dark:text-stone-100">
            2. Inquiries and Sponsorship Communications
          </h2>
          <p>
            Any contact details voluntarily submitted via the Contact or Sponsorship forms are transmitted strictly to the Department of Tourism and Hotel Management organizing committee to facilitate correspondence regarding the festival. Information is never sold, leased, or distributed to commercial third parties.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-lg text-stone-900 dark:text-stone-100">
            3. Photographic and Cultural Documentation
          </h2>
          <p>
            Public celebrations taking place on campus grounds and Woliso municipal thoroughfares may be photographed by accredited university media crews to preserve departmental academic archives.
          </p>
        </section>

        <div className="pt-6 border-t border-stone-200 dark:border-stone-800">
          <NavLink
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#0F3D2E] dark:text-[#D9A441] hover:underline"
          >
            ← Return to Homepage
          </NavLink>
        </div>
      </div>
    </div>
  );
};
