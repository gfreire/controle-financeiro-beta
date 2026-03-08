export type TransactionType =
  | 'ENTRADA'
  | 'SAIDA'
  | 'TRANSFERENCIA'

export type PaymentMethod =
  | 'DINHEIRO'
  | 'CONTA_CORRENTE'
  | 'CARTAO_CREDITO'

/* =========================
   BASE TRANSACTION (DOMAIN)
========================= */

export type Transaction = {
  id: string
  type: TransactionType

  originAccountId: string | null
  destinationAccountId: string | null

  amount: number
  description: string | null
  date: string

  categoryId: string | null
  subcategoryId: string | null

  createdAt: string
}

/* =========================
   TIMELINE ITEM (LISTAGEM)
========================= */

export type TimelineItemType =
  | 'ENTRADA'
  | 'SAIDA'
  | 'TRANSFERENCIA'

export type TimelineItem = {
  id: string
  type: TimelineItemType

  description: string | null
  amount: number

  // data original da movimentação ou compra
  date: string

  // competência (para futuras evoluções)
  competence: string | null

  // contas envolvidas
  originAccountName: string | null
  originAccountType: string | null

  destinationAccountName: string | null
  destinationAccountType: string | null

  // categoria (subcategoria só para saída)
  categoryName: string | null
  subcategoryName: string | null

  // cartão
  installments: number | null
}

/* =========================
   CREATE INPUT
========================= */

export type CreateTransactionInput =
  | CreateIncomeInput
  | CreateExpenseInput
  | CreateTransferInput

type BaseInput = {
  type: TransactionType
  amount: number
  date: string
  description?: string
}

export type CreateIncomeInput = BaseInput & {
  type: 'ENTRADA'
  destinationAccountId: string
  categoryId?: string | null
}

export type CreateExpenseInput =
  | (BaseInput & {
      type: 'SAIDA'
      paymentMethod: 'DINHEIRO' | 'CONTA_CORRENTE'
      originAccountId: string
      categoryId?: string | null
      subcategoryId?: string | null
    })
  | (BaseInput & {
      type: 'SAIDA'
      paymentMethod: 'CARTAO_CREDITO'
      originAccountId: string
      installments: number
      firstInstallmentMonth: string
      parcelValues: number[]
      categoryId?: string | null
      subcategoryId?: string | null
    })

export type CreateTransferInput = BaseInput & {
  type: 'TRANSFERENCIA'
  originAccountId: string
  destinationAccountId: string
}

export type CreateInvoicePaymentInput = {
  date: string
  amount: number
  description?: string
  originAccountId: string
  cardAccountId: string
}

/* =========================
   UPDATE INPUT
========================= */

export type UpdateTransactionInput =
  | (CreateIncomeInput & { id: string })
  | (CreateExpenseInput & { id: string })
  | (CreateTransferInput & { id: string })

export function validateUpdateTransaction(
  input: UpdateTransactionInput
) {
  if (!input.id) {
    throw new Error('Id da transação é obrigatório')
  }

  // reaproveita validação base
  validateCreateTransaction(input)
}

/* =========================
   VALIDATION
========================= */

export function validateCreateTransaction(
  input: CreateTransactionInput
) {
  if (!input.type) {
    throw new Error('Tipo da movimentação é obrigatório')
  }

  if (!input.date) {
    throw new Error('Data é obrigatória')
  }

  if (input.amount <= 0) {
    throw new Error('Valor deve ser maior que zero')
  }

  if (input.type === 'ENTRADA') {
    if (!input.destinationAccountId) {
      throw new Error('Conta de destino é obrigatória')
    }
  }

  if (input.type === 'SAIDA') {
    if (!input.originAccountId) {
      throw new Error('Conta de origem é obrigatória')
    }

    if (input.paymentMethod === 'CARTAO_CREDITO') {
      if (!input.installments || input.installments <= 0) {
        throw new Error('Número de parcelas inválido')
      }

      if (!input.firstInstallmentMonth) {
        throw new Error('Mês da primeira parcela é obrigatório')
      }

      if (
        !Array.isArray(input.parcelValues) ||
        input.parcelValues.length !== input.installments
      ) {
        throw new Error('Parcelas inconsistentes')
      }

      const totalParcelas = input.parcelValues.reduce(
        (acc, v) => acc + v,
        0
      )

      if (totalParcelas !== input.amount) {
        throw new Error('Soma das parcelas diferente do valor total')
      }
    }
  }

  if (input.type === 'TRANSFERENCIA') {
    if (!input.originAccountId || !input.destinationAccountId) {
      throw new Error('Transferência exige conta de origem e destino')
    }

    if (input.originAccountId === input.destinationAccountId) {
      throw new Error('Contas devem ser diferentes')
    }
  }
}

export function validateCreateInvoicePayment(
  input: CreateInvoicePaymentInput
) {
  if (!input.date) {
    throw new Error('Data é obrigatória')
  }

  if (input.amount <= 0) {
    throw new Error('Valor deve ser maior que zero')
  }

  if (!input.originAccountId) {
    throw new Error('Conta de origem é obrigatória')
  }

  if (!input.cardAccountId) {
    throw new Error('Conta do cartão é obrigatória')
  }

  if (input.originAccountId === input.cardAccountId) {
    throw new Error('Contas devem ser diferentes')
  }
}
