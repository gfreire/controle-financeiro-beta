'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { listAccounts, testAccountImpact } from '@/services/accounts.service'
import { createTransfer } from '@/services/transactions.service'
import { Account } from '@/domain/account'
import { normalizeText } from '@/utils/normalize'
import { formatCurrency } from '@/utils/formatCurrency'

export default function TransferForm() {
  const router = useRouter()

  const today = new Date().toISOString().slice(0, 10)

  const [accounts, setAccounts] = useState<Account[]>([])

  const [date, setDate] = useState(today)
  const [originAccountId, setOriginAccountId] = useState('')
  const [destinationAccountId, setDestinationAccountId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingSubmit, setPendingSubmit] = useState(false)

  useEffect(() => {
    listAccounts().then(setAccounts)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!originAccountId || !destinationAccountId || !amount) return

    try {
      setLoading(true)

      const numericAmount = Number(amount)
      if (isNaN(numericAmount) || numericAmount <= 0) {
        setError('Valor inválido')
        return
      }

      if (originAccountId === destinationAccountId) {
        setError('Contas devem ser diferentes')
        return
      }

      const impact = await testAccountImpact(originAccountId, numericAmount)

      if (impact.type === 'DINHEIRO' && impact.willExceed) {
        setError(`Saldo insuficiente. Disponível: ${formatCurrency(impact.available)}`)
        return
      }

      if (impact.type === 'CARTAO_CREDITO' && impact.willExceed) {
        setError(`Limite insuficiente. Disponível: ${formatCurrency(impact.available)}`)
        return
      }

      if (impact.type === 'CONTA_CORRENTE' && impact.willExceed && !pendingSubmit) {
        setError(`Atenção: saldo ficará negativo. Disponível atual: ${formatCurrency(impact.available)}`)
        setPendingSubmit(true)
        return
      }

      await createTransfer({
        type: 'TRANSFERENCIA',
        date,
        amount: numericAmount,
        description: normalizeText(description) ?? undefined,
        originAccountId,
        destinationAccountId,
      })

      setSuccess(true)
      setTimeout(() => router.push('/transactions'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar transferência')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="container">
      {success && (
        <div className="success-overlay">
          <div className="success-box">Transferência criada com sucesso</div>
        </div>
      )}

      {error && <div className="error field">{error}</div>}

      <h1 className="title">Nova transferência</h1>

      <div className="field">
        <label>Data</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="field">
        <label>Conta de origem</label>
        <select className="select" value={originAccountId} onChange={(e) => setOriginAccountId(e.target.value)}>
          <option value="">Selecione</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Conta de destino</label>
        <select className="select" value={destinationAccountId} onChange={(e) => setDestinationAccountId(e.target.value)}>
          <option value="">Selecione</option>
          {accounts.map((a) => (
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

      <button type="submit" className="button" disabled={loading || !originAccountId || !destinationAccountId || !amount}>
        {loading ? 'Salvando...' : 'Salvar'}
      </button>
    </form>
  )
}
