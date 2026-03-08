'use client'

import Link from 'next/link'
import ExpenseForm from '@/components/transactions/forms/ExpenseForm'

export default function NewExpensePage() {
  return (
    <main className="container">
      <Link href="/transactions/new" className="link">
        ← Voltar
      </Link>
      <ExpenseForm />
    </main>
  )
}
