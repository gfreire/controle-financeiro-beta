'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { listAccounts, testAccountImpact } from '@/services/accounts.service'
import { createExpense } from '@/services/transactions.service'
import { listCategories, listSubcategories } from '@/services/categories.service'
import { Account } from '@/domain/account'
import { Category, Subcategory } from '@/domain/category'
import { normalizeText } from '@/utils/normalize'
import { formatCurrency } from '@/utils/formatCurrency'

type PaymentMethod = 'DINHEIRO' | 'CONTA_CORRENTE'

export default function ExpenseForm() {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)

  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])

  const [date, setDate] = useState(today)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('DINHEIRO')
  const [originAccountId, setOriginAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingSubmit, setPendingSubmit] = useState(false)

  useEffect(() => {
    listAccounts().then(setAccounts)
    listCategories().then(setCategories)
    listSubcategories().then(setSubcategories)
  }, [])

  const availableAccounts = useMemo(
    () => accounts.filter((a) => a.type === paymentMethod),
    [accounts, paymentMethod]
  )

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'SAIDA'),
    [categories]
  )

  const expenseSubcategories = useMemo(
    () => subcategories.filter((s) => s.categoryId === categoryId),
    [subcategories, categoryId]
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!originAccountId || !amount) return

    try {
      setLoading(true)

      const numericAmount = Number(amount)
      if (isNaN(numericAmount) || numericAmount <= 0) {
        setError('Valor inválido')
        return
      }

      const impact = await testAccountImpact(originAccountId, numericAmount)

      if (impact.type === 'DINHEIRO' && impact.willExceed) {
        setError(`Saldo insuficiente. Disponível: ${formatCurrency(impact.available)}`)
        return
      }

      if (impact.type === 'CONTA_CORRENTE' && impact.willExceed && !pendingSubmit) {
        setError(`Atenção: saldo ficará negativo. Disponível atual: ${formatCurrency(impact.available)}`)
        setPendingSubmit(true)
        return
      }

      await createExpense({
        type: 'SAIDA',
        paymentMethod,
        date,
        amount: numericAmount,
        description: normalizeText(description) ?? undefined,
        originAccountId,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
      })

      setSuccess(true)
      setTimeout(() => router.push('/transactions'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar despesa')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="container">
      {success && (
        <div className="success-overlay">
          <div className="success-box">Despesa criada com sucesso</div>
        </div>
      )}
      {error && <div className="error field">{error}</div>}

      <h1 className="title">Nova despesa</h1>

      <div className="field">
        <label>Data</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="field">
        <label>Forma</label>
        <select
          className="select"
          value={paymentMethod}
          onChange={(e) => {
            setPaymentMethod(e.target.value as PaymentMethod)
            setOriginAccountId('')
          }}
        >
          <option value="DINHEIRO">Dinheiro</option>
          <option value="CONTA_CORRENTE">Débito / Pix</option>
        </select>
      </div>

      <div className="field">
        <label>Conta</label>
        <select className="select" value={originAccountId} onChange={(e) => setOriginAccountId(e.target.value)}>
          <option value="">Selecione</option>
          {availableAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Categoria</label>
        <select className="select" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setSubcategoryId('') }}>
          <option value="">Selecione</option>
          {expenseCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {categoryId && (
        <div className="field">
          <label>Subcategoria</label>
          <select className="select" value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)}>
            <option value="">Selecione</option>
            {expenseSubcategories.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="field">
        <label>Descrição</label>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="field">
        <label>Valor</label>
        <input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>

      <button type="submit" className="button" disabled={loading || !originAccountId || !amount}>
        {loading ? 'Salvando...' : 'Salvar'}
      </button>
    </form>
  )
}
