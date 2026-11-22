/**
 * GlobalSaveConfirmation.tsx
 *
 * Mounts once inside StaffRouter. Listens to the saveEvents bus and shows
 * a "Saving… → Live on the website ✓" toast after every staff save without
 * requiring individual pages to wire anything.
 *
 * Pages that want finer control (e.g. inline status next to their own save
 * button) can use useLiveSaveConfirmation directly instead.
 */

import React, { useEffect } from 'react'
import { onSaved } from '../lib/saveEvents'
import { useLiveSaveConfirmation } from '../hooks/useLiveSaveConfirmation'
import { SaveConfirmationToast } from './SaveConfirmationToast'

export const GlobalSaveConfirmation: React.FC = () => {
  const confirmation = useLiveSaveConfirmation()

  useEffect(() => {
    const unsubscribe = onSaved(() => {
      confirmation.check()
    })
    return unsubscribe
  // confirmation.check is stable (useCallback), so this is safe
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <SaveConfirmationToast confirmation={confirmation} />
}
