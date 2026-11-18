import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, MapPinOff } from 'lucide-react';
import { LOGO_FULL } from '../components/layout/Navbar';

export const NotFound: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-8">

      {/* Full Tourism Week logo centred */}
      <div className="flex justify-center">
        <div className="bg-white dark:bg-[#FAF7F0]/95 rounded-2xl px-6 py-4 border border-stone-200 dark:border-white/10 inline-block">
          <img
            src={LOGO_FULL}
            alt="Tourism Week, Ambo University Woliso Campus"
            className="h-24 w-auto object-contain mx-auto"
          />
        </div>
      </div>

      {/* Icon */}
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0F3D2E]/10 dark:bg-[#D9A441]/10 text-[#0F3D2E] dark:text-[#D9A441]">
        <MapPinOff className="h-8 w-8" aria-hidden="true" />
      </div>

      <div className="space-y-2">
        <h1 className="font-editorial text-4xl font-extrabold text-stone-900 dark:text-stone-100">
          404 — Page Not Found
        </h1>
        <p className="text-base text-stone-600 dark:text-stone-400 max-w-md mx-auto">
          The festival page or schedule resource you are searching for does not exist or may have been relocated.
        </p>
      </div>

      <div className="pt-2">
        <NavLink
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0F3D2E] text-white font-semibold text-sm hover:bg-[#0A2A20] transition-colors shadow-sm"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          <span>Return to Homepage</span>
        </NavLink>
      </div>
    </div>
  );
};
