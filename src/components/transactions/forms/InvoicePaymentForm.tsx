'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { listAccounts, testAccountImpact } from '@/services/accounts.service'
import { createInvoicePayment } from '@/services/transactions.service'
import { Account } from '@/domain/account'
import { normalizeText } from '@/utils/normalize'
import { formatCurrency } from '@/utils/formatCurrency'

export default function InvoicePaymentForm() {
  const router = useRouter()

  const today = new Date().toISOString().slice(0, 10)

  const [accounts, setAccounts] = useState<Account[]>([])

  const [date, setDate] = useState(today)
  const [originAccountId, setOriginAccountId] = useState('')
  const [cardAccountId, setCardAccountId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingSubmit, setPendingSubmit] = useState(false)

  useEffect(() => {
    listAccounts().then(setAccounts)
  }, [])

  const sourceAccounts = useMemo(
    () => accounts.filter((a) => a.type !== 'CARTAO_CREDITO'),
    [accounts]
  )

  const cardAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'CARTAO_CREDITO'),
    [accounts]
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!originAccountId || !cardAccountId || !amount) return

    try {
      setLoading(true)

      const numericAmount = Number(amount)
      if (isNaN(numericAmount) || numericAmount <= 0) {
        setError('Valor inválido')
        return
      }

      if (originAccountId === cardAccountId) {
        setError('Contas devem ser diferentes')
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

      await createInvoicePayment({
        date,
        amount: numericAmount,
        description: normalizeText(description) ?? undefined,
        originAccountId,
        cardAccountId,
      })

      setSuccess(true)
      setTimeout(() => router.push('/transactions'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar pagamento de fatura')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="container">
      {success && (
        <div className="success-overlay">
          <div className="success-box">Pagamento registrado com sucesso</div>
        </div>
      )}

      {error && <div className="error field">{error}</div>}

      <h1 className="title">Novo pagamento de fatura</h1>

      <div className="field">
        <label>Data</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="field">
        <label>Conta de origem</label>
        <select className="select" value={originAccountId} onChange={(e) => setOriginAccountId(e.target.value)}>
          <option value="">Selecione</option>
          {sourceAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Cartão</label>
        <select className="select" value={cardAccountId} onChange={(e) => setCardAccountId(e.target.value)}>
          <option value="">Selecione</option>
          {cardAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
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

      <button type="submit" className="button" disabled={loading || !originAccountId || !cardAccountId || !amount}>
        {loading ? 'Salvando...' : 'Salvar'}
      </button>
    </form>
  )
}
