/**
 * StaffRouter.tsx — All /staff/* routes for the ORGANIZER portal.
 *
 * Both organizer and admin-role accounts use this single portal.
 * canDelete is true for everyone — delete protection is enforced by RLS.
 *
 * /admin and /admin/* redirect to /staff/login (handled in App.tsx too,
 * but duplicated here as a safety net for direct navigation).
 */

import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider }           from './auth/AuthProvider'
import { RequireStaff }           from './auth/guards'
import { StaffLayout }            from './components/StaffLayout'
import { ToastProvider }          from './components/Toast'
import { ConfirmPasswordProvider } from './components/ConfirmPasswordModal'
import { PortalProvider }         from './context/PortalContext'
import { supabaseStaff }          from '../lib/supabaseStaff'

// Auth pages (no layout)
import { Login }          from './pages/Login'
import { ForgotPassword } from './pages/ForgotPassword'
import { SetPassword }    from './pages/SetPassword'
import { ResetPassword }  from './pages/ResetPassword'

// Core pages
import { Dashboard }             from './pages/Dashboard'
import { Profile }               from './pages/Profile'
import { EventsListPage }        from './pages/events/EventsListPage'
import { EventFormPage }         from './pages/events/EventFormPage'
import { AgendaPage }            from './pages/events/AgendaPage'
import { LivePage }              from './pages/LivePage'
import { AnnouncementsListPage } from './pages/announcements/AnnouncementsListPage'
import { AnnouncementFormPage }  from './pages/announcements/AnnouncementFormPage'
import { NewsPage }              from './pages/NewsPage'
import { NewsFormPage }          from './pages/news/NewsFormPage'
import { GalleryPage }           from './pages/GalleryPage'
import { SponsorsPage }          from './pages/SponsorsPage'
import { CommitteePage }         from './pages/CommitteePage'
import { SetupListPage }         from './pages/setup/SetupListPage'
import { SetupWizardPage }       from './pages/setup/SetupWizardPage'

// Now available to all organizers
import { MessagesPage }          from './pages/MessagesPage'
import { SiteContentPage }       from './pages/SiteContentPage'
import { SectionEditorPage }     from './pages/SectionEditorPage'

// Moved from admin-only to available to everyone
import { EditionsPage }          from './pages/admin/EditionsPage'
import { WebsiteSettingsPage }   from './pages/settings/WebsiteSettingsPage'

export default function StaffRouter() {
  return (
    <AuthProvider>
      <Routes>
        {/* ── Unauthenticated auth pages ────────────────────────────────── */}
        <Route path="login"           element={<Login />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="set-password"    element={<SetPassword />} />
        <Route path="reset-password"  element={<ResetPassword />} />

        {/* ── Authenticated organizer pages ────────────────────────────── */}
        <Route
          element={
            <RequireStaff>
              <PortalProvider
                client={supabaseStaff}
                basePath="/staff"
                canDelete={true}
              >
                <ConfirmPasswordProvider>
                  <ToastProvider>
                    <StaffLayout />
                  </ToastProvider>
                </ConfirmPasswordProvider>
              </PortalProvider>
            </RequireStaff>
          }
        >
          <Route index element={<Dashboard />} />

          {/* EVENT group */}
          <Route path="setup"            element={<SetupListPage />} />
          <Route path="setup/:editionId" element={<SetupWizardPage />} />
          <Route path="editions"         element={<EditionsPage />} />
          <Route path="events"           element={<EventsListPage />} />
          <Route path="events/new"       element={<EventFormPage />} />
          <Route path="events/agenda"    element={<AgendaPage />} />
          <Route path="events/:id"       element={<EventFormPage />} />
          <Route path="live"             element={<LivePage />} />

          {/* CONTENT group */}
          <Route path="announcements"     element={<AnnouncementsListPage />} />
          <Route path="announcements/new" element={<AnnouncementFormPage />} />
          <Route path="announcements/:id" element={<AnnouncementFormPage />} />
          <Route path="news"              element={<NewsPage />} />
          <Route path="news/new"          element={<NewsFormPage />} />
          <Route path="news/:id"          element={<NewsFormPage />} />
          <Route path="gallery"           element={<GalleryPage />} />
          <Route path="sponsors"          element={<SponsorsPage />} />
          <Route path="committee"         element={<CommitteePage />} />

          {/* Website Text */}
          <Route path="site"             element={<SiteContentPage />} />
          <Route path="site/:key"        element={<SectionEditorPage />} />

          {/* INBOX & SETTINGS group */}
          <Route path="messages"         element={<MessagesPage />} />
          <Route path="settings"         element={<WebsiteSettingsPage />} />

          {/* Profile */}
          <Route path="profile"          element={<Profile />} />

          {/* ── Legacy /admin/* redirects (belt-and-suspenders) ──────── */}
          <Route path="admin"                   element={<Navigate to="/staff" replace />} />
          <Route path="admin/*"                 element={<Navigate to="/staff" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
