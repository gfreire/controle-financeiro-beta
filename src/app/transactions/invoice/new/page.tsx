'use client'

import Link from 'next/link'
import InvoicePaymentForm from '@/components/transactions/forms/InvoicePaymentForm'

export default function NewInvoicePaymentPage() {
  return (
    <main className="container">
      <Link href="/transactions/new" className="link">
        ← Voltar
      </Link>
      <InvoicePaymentForm />
    </main>
  )
}
