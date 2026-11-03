import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/account')({
  component: AccountRedirect,
})

function AccountRedirect() {
  return <Navigate to="/dashboard" replace />
}
