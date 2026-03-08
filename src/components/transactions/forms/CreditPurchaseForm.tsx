'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { listAccounts, testAccountImpact } from '@/services/accounts.service'
import { createCreditPurchase } from '@/services/transactions.service'
import { listCategories, listSubcategories } from '@/services/categories.service'
import { Account } from '@/domain/account'
import { Category, Subcategory } from '@/domain/category'
import { normalizeText } from '@/utils/normalize'
import { formatCurrency } from '@/utils/formatCurrency'

export default function CreditPurchaseForm() {
  const router = useRouter()

  const today = new Date().toISOString().slice(0, 10)
  const initialMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])

  const [date, setDate] = useState(today)
  const [originAccountId, setOriginAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [installments, setInstallments] = useState('1')
  const [firstInstallmentMonth, setFirstInstallmentMonth] = useState(initialMonth)
  const [parcelValues, setParcelValues] = useState<string[]>([])

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listAccounts().then(setAccounts)
    listCategories().then(setCategories)
    listSubcategories().then(setSubcategories)
  }, [])

  const cardAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'CARTAO_CREDITO'),
    [accounts]
  )

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'SAIDA'),
    [categories]
  )

  const expenseSubcategories = useMemo(
    () => subcategories.filter((s) => s.categoryId === categoryId),
    [subcategories, categoryId]
  )

  function regenerateParcels(totalStr: string, qtyStr: string) {
    const total = Number(totalStr)
    const qty = Number(qtyStr)

    if (!total || !qty || qty <= 0) {
      setParcelValues([])
      return
    }

    const totalCents = Math.round(total * 100)
    const base = Math.floor(totalCents / qty)
    const remainder = totalCents - base * qty

    const next = Array.from({ length: qty }).map((_, i) => {
      const cents = i === 0 ? base + remainder : base
      return (cents / 100).toFixed(2)
    })

    setParcelValues(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!originAccountId || !amount) return

    try {
      setLoading(true)

      const numericAmount = Number(amount)
      const numericInstallments = Number(installments)

      if (isNaN(numericAmount) || numericAmount <= 0) {
        setError('Valor inválido')
        return
      }

      if (isNaN(numericInstallments) || numericInstallments <= 0) {
        setError('Número de parcelas inválido')
        return
      }

      const impact = await testAccountImpact(originAccountId, numericAmount)
      if (impact.type === 'CARTAO_CREDITO' && impact.willExceed) {
        setError(`Limite insuficiente. Disponível: ${formatCurrency(impact.available)}`)
        return
      }

      await createCreditPurchase({
        type: 'SAIDA',
        paymentMethod: 'CARTAO_CREDITO',
        date,
        amount: numericAmount,
        description: normalizeText(description) ?? undefined,
        originAccountId,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        installments: numericInstallments,
        firstInstallmentMonth,
        parcelValues: parcelValues.map((v) => Number(v)),
      })

      setSuccess(true)
      setTimeout(() => router.push('/transactions'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar compra no cartão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="container">
      {success && (
        <div className="success-overlay">
          <div className="success-box">Compra criada com sucesso</div>
        </div>
      )}

      {error && <div className="error field">{error}</div>}

      <h1 className="title">Nova compra no cartão</h1>

      <div className="field">
        <label>Data</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="field">
        <label>Cartão</label>
        <select className="select" value={originAccountId} onChange={(e) => setOriginAccountId(e.target.value)}>
          <option value="">Selecione</option>
          {cardAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Categoria</label>
        <select
          className="select"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value)
            setSubcategoryId('')
          }}
        >
          <option value="">Selecione</option>
          {expenseCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {categoryId && (
        <div className="field">
          <label>Subcategoria</label>
          <select className="select" value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)}>
            <option value="">Selecione</option>
            {expenseSubcategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
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
        <input
          className="input"
          type="number"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value)
            regenerateParcels(e.target.value, installments)
          }}
        />
      </div>

      <div className="field">
        <label>Número de parcelas</label>
        <input
          className="input"
          type="number"
          min={1}
          value={installments}
          onChange={(e) => {
            setInstallments(e.target.value)
            regenerateParcels(amount, e.target.value)
          }}
        />
      </div>

      <div className="field">
        <label>Mês da primeira parcela</label>
        <input className="input" type="month" value={firstInstallmentMonth} onChange={(e) => setFirstInstallmentMonth(e.target.value)} />
      </div>

      {parcelValues.length > 0 && (
        <div className="field">
          <label>Parcelas</label>
          {parcelValues.map((value, i) => (
            <div key={i} className="parcel-row">
              <input
                className="input"
                type="number"
                value={value}
                onChange={(e) => {
                  const next = [...parcelValues]
                  next[i] = e.target.value
                  setParcelValues(next)

                  const total = next.reduce((acc, v) => {
                    const num = Number(v)
                    return acc + (isNaN(num) ? 0 : num)
                  }, 0)

                  setAmount(total ? total.toFixed(2) : '')
                }}
              />
            </div>
          ))}
        </div>
      )}

      <button type="submit" className="button" disabled={loading || !originAccountId || !amount}>
        {loading ? 'Salvando...' : 'Salvar'}
      </button>
    </form>
  )
}
