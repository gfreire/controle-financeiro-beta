'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { listAccounts } from '@/services/accounts.service'
import { createIncome } from '@/services/transactions.service'
import { listCategories } from '@/services/categories.service'
import { Account } from '@/domain/account'
import { Category } from '@/domain/category'
import { normalizeText } from '@/utils/normalize'

export default function IncomeForm() {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)

  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const [date, setDate] = useState(today)
  const [destinationAccountId, setDestinationAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listAccounts().then(setAccounts)
    listCategories().then(setCategories)
  }, [])

  const availableAccounts = useMemo(
    () => accounts.filter((a) => a.type !== 'CARTAO_CREDITO'),
    [accounts]
  )

  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === 'ENTRADA'),
    [categories]
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!destinationAccountId || !amount) return

    try {
      setLoading(true)
      const numericAmount = Number(amount)

      if (isNaN(numericAmount) || numericAmount <= 0) {
        setError('Valor inválido')
        return
      }

      await createIncome({
        type: 'ENTRADA',
        date,
        amount: numericAmount,
        description: normalizeText(description) ?? undefined,
        destinationAccountId,
        categoryId: categoryId || null,
      })

      setSuccess(true)
      setTimeout(() => router.push('/transactions'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar receita')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="container">
      {success && (
        <div className="success-overlay">
          <div className="success-box">Receita criada com sucesso</div>
        </div>
      )}
      {error && <div className="error field">{error}</div>}

      <h1 className="title">Nova receita</h1>

      <div className="field">
        <label>Data</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="field">
        <label>Conta de destino</label>
        <select className="select" value={destinationAccountId} onChange={(e) => setDestinationAccountId(e.target.value)}>
          <option value="">Selecione</option>
          {availableAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Categoria</label>
        <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Selecione</option>
          {incomeCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Descrição</label>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="field">
        <label>Valor</label>
        <input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>

      <button type="submit" className="button" disabled={loading || !destinationAccountId || !amount}>
        {loading ? 'Salvando...' : 'Salvar'}
      </button>
    </form>
  )
}
