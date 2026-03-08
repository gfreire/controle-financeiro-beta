import { supabase } from '@/lib/supabase'
import {
  CreateExpenseInput,
  CreateIncomeInput,
  CreateInvoicePaymentInput,
  CreateTransactionInput,
  CreateTransferInput,
  TimelineItem,
  UpdateTransactionInput,
  validateCreateInvoicePayment,
  validateCreateTransaction,
  validateUpdateTransaction,
} from '@/domain/transaction'
import Decimal from 'decimal.js'
import { normalizeText } from '@/utils/normalize'

type DBTimelineRow = {
  id: string
  type: 'ENTRADA' | 'SAIDA' | 'TRANSFERENCIA'
  description: string | null
  amount: number | string
  date: string
  competence: string | null
  origin_account_name: string | null
  origin_account_type: string | null
  destination_account_name: string | null
  destination_account_type: string | null
  category_name: string | null
  subcategory_name: string | null
  installments: number | null
}

type CardParcelaRow = {
  compra_cartao_id: string
  competencia: string
  valor: number
  user_id: string
}

async function getUserId(): Promise<string> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id

  if (!userId) {
    throw new Error('Usuário não autenticado')
  }

  return userId
}

function mapTimelineRow(row: DBTimelineRow): TimelineItem {
  return {
    id: row.id,
    type: row.type,
    description: row.description,
    amount: new Decimal(row.amount ?? 0).toDecimalPlaces(2).toNumber(),
    date: row.date,
    competence: row.competence,
    originAccountName: row.origin_account_name,
    originAccountType: row.origin_account_type,
    destinationAccountName: row.destination_account_name,
    destinationAccountType: row.destination_account_type,
    categoryName: row.category_name,
    subcategoryName: row.subcategory_name,
    installments: row.installments,
  }
}

function buildCardParcels(params: {
  purchaseId: string
  userId: string
  firstInstallmentMonth: string
  parcelValues: number[]
}): CardParcelaRow[] {
  const { purchaseId, userId, firstInstallmentMonth, parcelValues } = params
  const [year, month] = firstInstallmentMonth.split('-').map(Number)

  return parcelValues.map((value, index) => {
    const competence = new Date(year, month - 1 + index, 1)

    const formatted = `${competence.getFullYear()}-${String(
      competence.getMonth() + 1
    ).padStart(2, '0')}-01`

    return {
      compra_cartao_id: purchaseId,
      competencia: formatted,
      valor: value,
      user_id: userId,
    }
  })
}

function parseFirstInstallmentMonthFromDate(date: string): string {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function validateParcelsSum(amount: number, parcelValues: number[]): void {
  const totalFromParcels = parcelValues.reduce(
    (sum: Decimal, v) => sum.plus(new Decimal(v)),
    new Decimal(0)
  )

  if (!totalFromParcels.equals(new Decimal(amount))) {
    throw new Error('Soma das parcelas diferente do valor total')
  }
}

async function createCardPurchaseInternal(params: {
  userId: string
  amount: number
  date: string
  description?: string
  cardAccountId: string
  categoryId?: string | null
  subcategoryId?: string | null
  installments: number
  firstInstallmentMonth: string
  parcelValues: number[]
}): Promise<void> {
  const {
    userId,
    amount,
    date,
    description,
    cardAccountId,
    categoryId,
    subcategoryId,
    installments,
    firstInstallmentMonth,
    parcelValues,
  } = params

  if (!installments || installments < 1) {
    throw new Error('Número de parcelas inválido')
  }

  if (!firstInstallmentMonth) {
    throw new Error('Mês da primeira parcela obrigatório')
  }

  if (!parcelValues || parcelValues.length !== installments) {
    throw new Error('Parcelas inválidas')
  }

  validateParcelsSum(amount, parcelValues)

  const { data: purchase, error: purchaseError } = await supabase
    .from('compras_cartao')
    .insert({
      conta_cartao_id: cardAccountId,
      data_compra: date,
      descricao: normalizeText(description) ?? '',
      valor_total: amount,
      numero_parcelas: installments,
      categoria_id: categoryId ?? null,
      subcategoria_id: subcategoryId ?? null,
      user_id: userId,
    })
    .select('id')
    .single()

  if (purchaseError || !purchase) {
    throw new Error('Erro ao criar compra no cartão')
  }

  const parcels = buildCardParcels({
    purchaseId: purchase.id,
    userId,
    firstInstallmentMonth,
    parcelValues,
  })

  const { error: parcelError } = await supabase
    .from('parcelas_cartao')
    .insert(parcels)

  if (parcelError) {
    throw new Error('Erro ao gerar parcelas')
  }
}

export async function createExpense(
  input: Extract<
    CreateExpenseInput,
    { type: 'SAIDA'; paymentMethod: 'DINHEIRO' | 'CONTA_CORRENTE' }
  >
): Promise<void> {
  validateCreateTransaction(input)

  const userId = await getUserId()

  const { error } = await supabase.from('movimentacoes').insert({
    tipo: 'SAIDA',
    valor: input.amount,
    data: input.date,
    descricao: normalizeText(input.description),
    conta_origem_id: input.originAccountId,
    conta_destino_id: null,
    categoria_id: input.categoryId ?? null,
    subcategoria_id: input.subcategoryId ?? null,
    user_id: userId,
  })

  if (error) throw new Error('Erro ao criar saída')
}

export async function createIncome(
  input: CreateIncomeInput
): Promise<void> {
  validateCreateTransaction(input)

  const userId = await getUserId()

  const { error } = await supabase.from('movimentacoes').insert({
    tipo: 'ENTRADA',
    valor: input.amount,
    data: input.date,
    descricao: normalizeText(input.description),
    conta_destino_id: input.destinationAccountId,
    conta_origem_id: null,
    categoria_id: input.categoryId ?? null,
    subcategoria_id: null,
    user_id: userId,
  })

  if (error) throw new Error('Erro ao criar entrada')
}

export async function createCreditPurchase(
  input: Extract<
    CreateExpenseInput,
    { type: 'SAIDA'; paymentMethod: 'CARTAO_CREDITO' }
  >
): Promise<void> {
  validateCreateTransaction(input)

  const userId = await getUserId()

  await createCardPurchaseInternal({
    userId,
    amount: input.amount,
    date: input.date,
    description: input.description,
    cardAccountId: input.originAccountId,
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId,
    installments: input.installments,
    firstInstallmentMonth: input.firstInstallmentMonth,
    parcelValues: input.parcelValues,
  })
}

export async function createInvoicePayment(
  input: CreateInvoicePaymentInput
): Promise<void> {
  validateCreateInvoicePayment(input)

  const userId = await getUserId()

  const normalizedDescription =
    normalizeText(input.description) ?? 'Pagamento de fatura'

  const { data: movement, error: movementError } = await supabase
    .from('movimentacoes')
    .insert({
      tipo: 'SAIDA',
      valor: input.amount,
      data: input.date,
      descricao: normalizedDescription,
      conta_origem_id: input.originAccountId,
      conta_destino_id: null,
      categoria_id: null,
      subcategoria_id: null,
      user_id: userId,
    })
    .select('id')
    .single()

  if (movementError || !movement) {
    throw new Error('Erro ao registrar pagamento de fatura')
  }

  try {
    await createCardPurchaseInternal({
      userId,
      amount: -Math.abs(input.amount),
      date: input.date,
      description: normalizedDescription,
      cardAccountId: input.cardAccountId,
      installments: 1,
      firstInstallmentMonth: parseFirstInstallmentMonthFromDate(input.date),
      parcelValues: [-Math.abs(input.amount)],
    })
  } catch {
    await supabase
      .from('movimentacoes')
      .delete()
      .eq('id', movement.id)
      .eq('user_id', userId)

    throw new Error('Erro ao registrar pagamento de fatura')
  }
}

export async function createTransfer(
  input: CreateTransferInput
): Promise<void> {
  validateCreateTransaction(input)

  const userId = await getUserId()

  const { error } = await supabase.from('movimentacoes').insert({
    tipo: 'TRANSFERENCIA',
    valor: input.amount,
    data: input.date,
    descricao: normalizeText(input.description),
    conta_origem_id: input.originAccountId,
    conta_destino_id: input.destinationAccountId,
    categoria_id: null,
    subcategoria_id: null,
    user_id: userId,
  })

  if (error) throw new Error('Erro ao criar transferência')
}

export async function createTransaction(
  input: CreateTransactionInput
): Promise<void> {
  if (input.type === 'TRANSFERENCIA') {
    return createTransfer(input)
  }

  if (input.type === 'ENTRADA') {
    return createIncome(input)
  }

  if (input.type === 'SAIDA') {
    if (input.paymentMethod === 'CARTAO_CREDITO') {
      return createCreditPurchase(input)
    }

    return createExpense(input)
  }

  throw new Error('Tipo inválido')
}

export async function listTimeline(): Promise<TimelineItem[]> {
  const userId = await getUserId()

  const { data, error } = await supabase
    .from('vw_timeline')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (error) {
    throw new Error('Erro ao carregar timeline')
  }

  return (data ?? []).map(mapTimelineRow)
}

export async function getTransactionById(id: string) {
  const userId = await getUserId()

  const { data: mov } = await supabase
    .from('movimentacoes')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (mov) {
    return {
      id: mov.id,
      type: mov.tipo,
      date: mov.data,
      amount: Number(mov.valor),
      description: mov.descricao ?? undefined,
      originAccountId: mov.conta_origem_id ?? undefined,
      destinationAccountId: mov.conta_destino_id ?? undefined,
      categoryId: mov.categoria_id ?? undefined,
      subcategoryId: mov.subcategoria_id ?? undefined,
      paymentMethod:
        mov.tipo === 'SAIDA' ? 'DINHEIRO' : undefined,
    }
  }

  const { data: purchase } = await supabase
    .from('compras_cartao')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (purchase) {
    const { data: parcelas } = await supabase
      .from('parcelas_cartao')
      .select('*')
      .eq('compra_cartao_id', id)
      .eq('user_id', userId)
      .order('competencia', { ascending: true })

    return {
      id: purchase.id,
      type: 'SAIDA',
      date: purchase.data_compra,
      amount: Number(purchase.valor_total),
      description: purchase.descricao ?? undefined,
      originAccountId: purchase.conta_cartao_id,
      categoryId: purchase.categoria_id ?? undefined,
      subcategoryId: purchase.subcategoria_id ?? undefined,
      paymentMethod: 'CARTAO_CREDITO',
      installments: purchase.numero_parcelas,
      firstInstallmentMonth:
        parcelas && parcelas.length > 0
          ? parcelas[0].competencia.slice(0, 7)
          : undefined,
      parcelValues: parcelas
        ? parcelas.map((p) => Number(p.valor))
        : [],
    }
  }

  throw new Error('Transação não encontrada')
}

export async function updateTransaction(
  input: UpdateTransactionInput
): Promise<void> {
  validateUpdateTransaction(input)

  const userId = await getUserId()
  const { id, type } = input

  if (type === 'ENTRADA') {
    const { error } = await supabase
      .from('movimentacoes')
      .update({
        valor: input.amount,
        data: input.date,
        descricao: normalizeText(input.description),
        conta_destino_id: input.destinationAccountId,
        categoria_id: input.categoryId ?? null,
      })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw new Error('Erro ao atualizar entrada')
    return
  }

  if (type === 'SAIDA' && input.paymentMethod !== 'CARTAO_CREDITO') {
    const { error } = await supabase
      .from('movimentacoes')
      .update({
        valor: input.amount,
        data: input.date,
        descricao: normalizeText(input.description),
        conta_origem_id: input.originAccountId,
        categoria_id: input.categoryId ?? null,
        subcategoria_id: input.subcategoryId ?? null,
      })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw new Error('Erro ao atualizar saída')
    return
  }

  if (type === 'SAIDA' && input.paymentMethod === 'CARTAO_CREDITO') {
    const {
      amount,
      date,
      description,
      originAccountId,
      categoryId,
      subcategoryId,
      installments,
      firstInstallmentMonth,
      parcelValues,
    } = input

    validateParcelsSum(amount, parcelValues)

    const { error: updateError } = await supabase
      .from('compras_cartao')
      .update({
        valor_total: amount,
        data_compra: date,
        descricao: normalizeText(description) ?? '',
        numero_parcelas: installments,
        conta_cartao_id: originAccountId,
        categoria_id: categoryId ?? null,
        subcategoria_id: subcategoryId ?? null,
      })
      .eq('id', id)
      .eq('user_id', userId)

    if (updateError) {
      throw new Error('Erro ao atualizar compra no cartão')
    }

    await supabase
      .from('parcelas_cartao')
      .delete()
      .eq('compra_cartao_id', id)
      .eq('user_id', userId)

    if (
      installments &&
      installments > 0 &&
      firstInstallmentMonth &&
      parcelValues
    ) {
      const parcels = buildCardParcels({
        purchaseId: id,
        userId,
        firstInstallmentMonth,
        parcelValues,
      })

      const { error: parcelError } = await supabase
        .from('parcelas_cartao')
        .insert(parcels)

      if (parcelError) {
        throw new Error('Erro ao atualizar parcelas')
      }
    }

    return
  }

  if (type === 'TRANSFERENCIA') {
    const { error } = await supabase
      .from('movimentacoes')
      .update({
        valor: input.amount,
        data: input.date,
        descricao: normalizeText(input.description),
        conta_origem_id: input.originAccountId,
        conta_destino_id: input.destinationAccountId,
      })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw new Error('Erro ao atualizar transferência')
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  const userId = await getUserId()

  const { data: mov, error: movError } = await supabase
    .from('movimentacoes')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (movError) {
    throw new Error('Erro ao verificar movimentação')
  }

  if (mov) {
    const { error } = await supabase
      .from('movimentacoes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      throw new Error('Erro ao deletar movimentação')
    }

    return
  }

  const { data: purchase, error: purchaseError } = await supabase
    .from('compras_cartao')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (purchaseError) {
    throw new Error('Erro ao verificar compra no cartão')
  }

  if (purchase) {
    const { error: parcelError } = await supabase
      .from('parcelas_cartao')
      .delete()
      .eq('compra_cartao_id', id)
      .eq('user_id', userId)

    if (parcelError) {
      throw new Error('Erro ao deletar parcelas')
    }

    const { error: purchaseDeleteError } = await supabase
      .from('compras_cartao')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (purchaseDeleteError) {
      throw new Error('Erro ao deletar compra no cartão')
    }

    return
  }

  throw new Error('Registro não encontrado para exclusão')
}
