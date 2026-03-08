'use client'

import Link from 'next/link'

export default function NewTransactionPage() {
  return (
    <main className="container">
      <Link href="/transactions" className="link">
        ← Voltar para movimentações
      </Link>

      <h1 className="title">Novo registro</h1>

      <div className="list">
        <Link href="/transactions/expense/new" className="card">
          <div className="card-main">
            <strong>Despesa</strong>
            <span className="muted">Saída em dinheiro ou conta corrente</span>
          </div>
        </Link>

        <Link href="/transactions/income/new" className="card">
          <div className="card-main">
            <strong>Receita</strong>
            <span className="muted">Entrada de valores</span>
          </div>
        </Link>

        <Link href="/transactions/credit/new" className="card">
          <div className="card-main">
            <strong>Compra no cartão</strong>
            <span className="muted">Compra parcelada no cartão de crédito</span>
          </div>
        </Link>

        <Link href="/transactions/invoice/new" className="card">
          <div className="card-main">
            <strong>Pagamento de fatura</strong>
            <span className="muted">Abate saldo do cartão e registra saída</span>
          </div>
        </Link>

        <Link href="/transactions/transfer/new" className="card">
          <div className="card-main">
            <strong>Transferência</strong>
            <span className="muted">Entre contas</span>
          </div>
        </Link>
      </div>
    </main>
  )
}
