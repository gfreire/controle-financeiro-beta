'use client'

import Link from 'next/link'
import TransferForm from '@/components/transactions/forms/TransferForm'

export default function NewTransferPage() {
  return (
    <main className="container">
      <Link href="/transactions/new" className="link">
        ← Voltar
      </Link>
      <TransferForm />
    </main>
  )
}
