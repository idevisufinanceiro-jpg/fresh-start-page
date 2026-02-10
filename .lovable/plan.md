
# Plano: Implementar "Mês Pulado" nas Assinaturas

## Resumo
Adicionar a opção de marcar um mês de assinatura como "Pulado" (skipped), indicando que o serviço não foi prestado naquele mês. O valor desse mês não entrará no financeiro, não gerará previsão de recebimento e será visualmente diferenciado.

---

## Situações cobertas
- Cliente não pagou e você não prestou o serviço
- Indisponibilidade do cliente para receber o conteúdo/serviço
- Qualquer motivo onde o serviço não foi executado

---

## O que acontece quando um mês é "Pulado"
1. **Não gera entrada financeira** - Nenhum registro em `financial_entries`
2. **Não aparece em "Previsão de Entradas"** - O MonthlyForecast ignora meses pulados
3. **Não conta em "A Receber"** - Sai dos totais de receita pendente
4. **Visual diferenciado** - Badge cinza com ícone de "skip" para identificar

---

## Mudanças Técnicas

### 1. Migração de Banco de Dados
Adicionar coluna na tabela `subscription_payments`:

```sql
ALTER TABLE subscription_payments 
ADD COLUMN is_skipped BOOLEAN DEFAULT false;

ALTER TABLE subscription_payments 
ADD COLUMN skip_reason TEXT;
```

### 2. Componente `SubscriptionPaymentsDialog.tsx`
- Adicionar novo botão/opção "Pular Mês" com dropdown para selecionar o motivo
- Ao marcar como pulado:
  - Criar/atualizar registro com `is_skipped = true` e `payment_status = 'skipped'`
  - **Não** criar `financial_entry`
- Permitir reverter mês pulado para pendente novamente
- Visual: Badge cinza "Pulado" com ícone de skip

### 3. Hook `useMonthlyReceivables.ts`
- Filtrar meses com `is_skipped = true` ao calcular totais
- Não incluir meses pulados na lista de entradas a receber

### 4. Componente `MonthlyForecast.tsx`
- Ignorar meses marcados como `is_skipped` na previsão de entradas

### 5. `useFinancialData.ts` e `FinancialSummary.tsx`
- Excluir meses pulados dos cálculos de receita pendente de assinaturas

---

## Interface do Usuário

### Na tela de Pagamentos da Assinatura:
```
┌────────────────────────────────────┐
│  Janeiro       [Pendente]          │
│  R$ 500,00                         │
│  ┌─────────────┐ ┌───────────────┐ │
│  │ Marcar Pago │ │  Pular Mês ⏭  │ │
│  └─────────────┘ └───────────────┘ │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│  Fevereiro     [Pulado] ⏭          │
│  R$ 500,00 (não cobrado)           │
│  Motivo: Cliente indisponível      │
│  ┌──────────────────┐              │
│  │ Reverter p/ Pend │              │
│  └──────────────────┘              │
└────────────────────────────────────┘
```

### Motivos pré-definidos (dropdown):
- "Cliente não pagou"
- "Cliente indisponível"
- "Serviço não entregue"
- "Outro motivo"

---

## Resumo dos Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| Migração SQL | Adicionar `is_skipped` e `skip_reason` |
| `SubscriptionPaymentsDialog.tsx` | UI para pular/reverter mês |
| `useMonthlyReceivables.ts` | Filtrar meses pulados |
| `MonthlyForecast.tsx` | Ignorar meses pulados |
| `useFinancialData.ts` | Excluir pulados dos totais |
| `FinancialSummary.tsx` | Já usa dados do hook, atualiza automaticamente |

---

## Observações
- Meses já pagos **não** podem ser marcados como pulados (botão desabilitado)
- Ao reverter um mês pulado, ele volta para "Pendente" e entra nas previsões novamente
- O histórico de meses pulados fica salvo para referência futura
