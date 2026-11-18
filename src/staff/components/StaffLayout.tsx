/**
 * StaffLayout.tsx — Shell for all authenticated organizer pages.
 *
 * Desktop (≥1024 px): fixed sidebar (240 px) + scrollable content area.
 * Mobile (<1024 px):  sticky top bar + full-screen drawer + bottom tab bar.
 *
 * Sidebar has three groups:
 *   EVENT     — Dashboard, This Year's Event, Program, Live Control
 *   CONTENT   — Announcements, News, Gallery, Sponsors, Committee, Website Text
 *   INBOX & SETTINGS — Messages (unread badge), Website Settings, My Profile
 *
 * Role badge always says "Organizer" regardless of the account's DB role.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  CalendarPlus,
  Radio,
  Megaphone,
  Newspaper,
  Images,
  Handshake,
  Users2,
  UserCircle,
  SlidersHorizontal,
  MessageSquare,
  FileText,
  BookOpen,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  ShieldCheck,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { usePortal } from '../context/PortalContext'
import { InactivityWarning } from './InactivityWarning'
import { StaffMeta } from './StaffMeta'
import { WebsiteSyncBar } from './WebsiteSyncBar'

// ─── Nav item types ───────────────────────────────────────────────────────────

interface NavItem {
  label:       string
  /** Short label shown in the mobile bottom tab bar (≤8 chars fits at 320px). */
  shortLabel?: string
  to:          string
  icon:        React.ReactNode
  badge?:      number
}

interface NavGroup {
  label: string
  items: NavItem[]
}

// ─── Unread messages count ────────────────────────────────────────────────────

function useUnreadMessagesCount() {
  const { client } = usePortal()
  return useQuery({
    queryKey: ['staff', 'messages', 'unread-count'],
    queryFn: async () => {
      const { count, error } = await client
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('handled', false)
      if (error) return 0
      return count ?? 0
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}

// ─── Theme toggle hook ────────────────────────────────────────────────────────

function useTheme() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  )
  const toggle = useCallback(() => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('tourism_theme', next ? 'dark' : 'light')
  }, [dark])
  return { dark, toggle }
}

// ─── Focus-trap helper ────────────────────────────────────────────────────────

const FOCUSABLE_SEL = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function trapFocus(containerEl: HTMLElement, e: KeyboardEvent) {
  const els = Array.from(containerEl.querySelectorAll<HTMLElement>(FOCUSABLE_SEL));
  if (!els.length) return;
  const first = els[0];
  const last  = els[els.length - 1];
  if (e.key === 'Tab') {
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
}

// ─── Nav link ─────────────────────────────────────────────────────────────────

function SideNavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/staff'}
      onClick={onClick}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] focus-visible:ring-offset-1',
          isActive
            ? 'bg-[#0F3D2E] text-white'
            : 'text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] hover:text-[var(--text-main)]',
        ].join(' ')
      }
    >
      <span className="shrink-0 w-5 h-5 flex items-center justify-center" aria-hidden="true">
        {item.icon}
      </span>
      <span className="truncate flex-1">{item.label}</span>
      {item.badge && item.badge > 0 ? (
        <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      ) : null}
    </NavLink>
  )
}

// ─── Sidebar content ──────────────────────────────────────────────────────────

function SidebarContent({ groups, onNavClick }: { groups: NavGroup[]; onNavClick?: () => void }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { dark, toggle } = useTheme()
  const { t } = useTranslation()

  const initials = (profile?.full_name ?? 'O')
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const handleLogout = async () => {
    await signOut()
    navigate('/staff/login', { replace: true })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-[var(--border-subtle)] shrink-0">
        <Link
          to="/staff"
          className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] rounded-lg"
          onClick={onNavClick}
        >
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#0F3D2E] text-[#D9A441]">
            <ShieldCheck size={16} aria-hidden="true" />
          </span>
          <div>
            <span className="font-display text-sm font-bold text-[var(--text-main)] leading-tight block">
              Organizer Portal
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-[#D9A441]">
              Tourism Week
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Organizer portal navigation">
        {groups.map(group => (
          <div key={group.label}>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => (
                <SideNavLink key={item.to} item={item} onClick={onNavClick} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: user card + theme toggle + sign out */}
      <div className="px-3 py-4 border-t border-[var(--border-subtle)] shrink-0 space-y-2">
        <Link
          to="/staff/profile"
          onClick={onNavClick}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--bg-section-alt)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]"
          aria-label="My profile"
        >
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#D9A441] text-[#0F3D2E] text-xs font-bold shrink-0">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-main)] truncate">
              {profile?.full_name ?? 'Organizer'}
            </p>
            <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-[var(--text-muted)]">
              Organizer
            </span>
          </div>
        </Link>

        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] hover:text-[var(--text-main)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]"
          aria-label={t('staff.layout.themeToggle')}
        >
          {dark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
          <span>{t('staff.layout.themeToggle')}</span>
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]"
        >
          <LogOut size={16} aria-hidden="true" />
          <span>{t('staff.layout.logout')}</span>
        </button>
      </div>
    </div>
  )
}

// ─── Main layout ──────────────────────────────────────────────────────────────

export function StaffLayout() {
  const { t } = useTranslation()
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { dark, toggle } = useTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef   = useRef<HTMLDivElement>(null)
  const menuBtnRef  = useRef<HTMLButtonElement>(null)

  const { data: unreadCount = 0 } = useUnreadMessagesCount()

  // ── Build nav groups ────────────────────────────────────────────────────────
  const groups: NavGroup[] = [
    {
      label: 'EVENT',
      items: [
        { label: 'Dashboard',         shortLabel: 'Home',    to: '/staff',         icon: <LayoutDashboard size={16} /> },
        { label: "This Year's Event",  shortLabel: 'Event',   to: '/staff/setup',   icon: <CalendarPlus size={16} /> },
        { label: 'Program',           shortLabel: 'Program', to: '/staff/events',  icon: <CalendarDays size={16} /> },
        { label: 'Live Control',      to: '/staff/live',    icon: <Radio size={16} /> },
        { label: 'Editions',          to: '/staff/editions',icon: <BookOpen size={16} /> },
      ],
    },
    {
      label: 'CONTENT',
      items: [
        { label: 'Announcements',  shortLabel: 'News',    to: '/staff/announcements', icon: <Megaphone size={16} /> },
        { label: 'News',           to: '/staff/news',          icon: <Newspaper size={16} /> },
        { label: 'Gallery',        to: '/staff/gallery',       icon: <Images size={16} /> },
        { label: 'Sponsors',       to: '/staff/sponsors',      icon: <Handshake size={16} /> },
        { label: 'Committee',      to: '/staff/committee',     icon: <Users2 size={16} /> },
        { label: 'Website Text',   to: '/staff/site',          icon: <FileText size={16} /> },
      ],
    },
    {
      label: 'INBOX & SETTINGS',
      items: [
        { label: 'Messages',          shortLabel: 'Inbox',   to: '/staff/messages',  icon: <MessageSquare size={16} />, badge: unreadCount },
        { label: 'Website Settings',  to: '/staff/settings',  icon: <SlidersHorizontal size={16} /> },
        { label: 'My Profile',        to: '/staff/profile',   icon: <UserCircle size={16} /> },
      ],
    },
  ]

  // Mobile bottom nav — first 5 most-used items
  const bottomNav: NavItem[] = [
    groups[0].items[0], // Dashboard
    groups[0].items[1], // This Year's Event
    groups[0].items[2], // Program
    groups[1].items[0], // Announcements
    groups[2].items[0], // Messages (with badge)
  ]

  // Close drawer on outside click
  useEffect(() => {
    if (!drawerOpen) return
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [drawerOpen])

  // Close drawer on Escape + focus trap + body-scroll lock
  useEffect(() => {
    if (!drawerOpen) return

    // Lock body scroll
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus first focusable element in drawer
    const focusTimer = window.setTimeout(() => {
      const first = drawerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SEL)
      first?.focus()
    }, 50)

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false)
        menuBtnRef.current?.focus()
        return
      }
      if (drawerRef.current) trapFocus(drawerRef.current, e)
    }
    document.addEventListener('keydown', handler)
    return () => {
      document.body.style.overflow = prevOverflow
      clearTimeout(focusTimer)
      document.removeEventListener('keydown', handler)
    }
  }, [drawerOpen])

  const initials = (profile?.full_name ?? 'O')
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const handleLogout = async () => {
    await signOut()
    navigate('/staff/login', { replace: true })
  }

  return (
    <>
      <StaffMeta />
      <InactivityWarning />

      <div className="flex min-h-screen bg-[var(--bg-canvas)] text-[var(--text-main)]">

        {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
        <aside
          className="hidden lg:flex flex-col w-60 shrink-0 border-r border-[var(--border-subtle)] bg-[var(--surface-card)] fixed inset-y-0 left-0 z-30"
          aria-label="Sidebar navigation"
        >
          <SidebarContent groups={groups} />
        </aside>

        {/* ── Mobile: drawer overlay ───────────────────────────────────────── */}
        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
        )}

        <div
          ref={drawerRef}
          id="staff-nav-drawer"
          className={[
            'lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-[var(--surface-card)] border-r border-[var(--border-subtle)] transition-transform duration-300',
            drawerOpen ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation drawer"
          aria-hidden={!drawerOpen}
          inert={!drawerOpen ? true : undefined}
        >
          <button
            onClick={() => { setDrawerOpen(false); menuBtnRef.current?.focus(); }}
            className="absolute top-4 right-4 p-2 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]"
            aria-label={t('staff.layout.closeMenu')}
          >
            <X size={20} aria-hidden="true" />
          </button>
          <SidebarContent groups={groups} onNavClick={() => setDrawerOpen(false)} />
        </div>

        {/* ── Main content column ──────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 lg:ml-60">

          {/* Mobile top bar */}
          <header className="lg:hidden sticky top-0 z-20 flex items-center gap-3 px-4 h-14 bg-[var(--surface-card)] border-b border-[var(--border-subtle)] shrink-0">
            <button
              onClick={() => setDrawerOpen(true)}
              ref={menuBtnRef}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]"
              aria-label={t('staff.layout.openMenu')}
              aria-expanded={drawerOpen}
              aria-controls="staff-nav-drawer"
            >
              <Menu size={20} aria-hidden="true" />
            </button>

            <Link
              to="/staff"
              className="flex-1 font-display text-sm font-bold text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] rounded"
            >
              Organizer Portal
            </Link>

            <button
              onClick={toggle}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-section-alt)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]"
              aria-label={t('staff.layout.themeToggle')}
            >
              {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            </button>

            <button
              onClick={handleLogout}
              className="relative flex items-center justify-center w-8 h-8 rounded-full bg-[#D9A441] text-[#0F3D2E] text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441] focus-visible:ring-offset-2"
              aria-label={`${profile?.full_name ?? 'Organizer'} — ${t('staff.layout.logout')}`}
              title={t('staff.layout.logout')}
            >
              {initials}
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </header>

          {/* Website sync status bar */}
          <WebsiteSyncBar />

          {/* Page content — pb accounts for bottom nav + safe area on mobile */}
          <main
            id="main-content"
            className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:pb-8"
            style={{ paddingBottom: 'max(calc(64px + env(safe-area-inset-bottom, 0px)), 1.5rem)' }}
          >
            <Outlet />
          </main>

          {/* Mobile bottom navigation (5 items — short labels fit at 320 px) */}
          <nav
            className="lg:hidden fixed bottom-0 inset-x-0 z-20 flex items-stretch bg-[var(--surface-card)] border-t border-[var(--border-subtle)]"
            style={{
              height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
            aria-label="Mobile bottom navigation"
          >
            {bottomNav.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/staff'}
                className={({ isActive }) =>
                  [
                    'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors relative min-h-[56px] px-1',
                    isActive
                      ? 'text-[#0F3D2E] dark:text-[#D9A441]'
                      : 'text-[var(--text-muted)]',
                  ].join(' ')
                }
                aria-label={item.label}
              >
                <span className="relative w-5 h-5 flex items-center justify-center" aria-hidden="true">
                  {item.icon}
                  {item.badge && item.badge > 0 ? (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold leading-none">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  ) : null}
                </span>
                {/* Use shortLabel when defined — keeps text under 52px at 10px font */}
                <span className="truncate w-full text-center leading-tight">
                  {item.shortLabel ?? item.label}
                </span>
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </>
  )
}
