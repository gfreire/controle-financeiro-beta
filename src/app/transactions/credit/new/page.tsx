'use client'

import Link from 'next/link'
import CreditPurchaseForm from '@/components/transactions/forms/CreditPurchaseForm'

export default function NewCreditPurchasePage() {
  return (
    <main className="container">
      <Link href="/transactions/new" className="link">
        ← Voltar
      </Link>
      <CreditPurchaseForm />
    </main>
  )
}
