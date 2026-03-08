'use client'

import Link from 'next/link'
import IncomeForm from '@/components/transactions/forms/IncomeForm'

export default function NewIncomePage() {
  return (
    <main className="container">
      <Link href="/transactions/new" className="link">
        ← Voltar
      </Link>
      <IncomeForm />
    </main>
  )
}
