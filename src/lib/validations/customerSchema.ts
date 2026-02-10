import { z } from "zod";

// Schema para validação de CPF/CNPJ
const cpfCnpjSchema = z.string().max(18).optional().or(z.literal(""));

// Schema para validação de telefone
const phoneSchema = z.string().max(20).optional().or(z.literal(""));

// Schema para validação de CEP
const cepSchema = z.string().max(10).optional().or(z.literal(""));

// Schema para validação de email
const emailSchema = z.string().email("Email inválido").max(255).optional().or(z.literal(""));

// Schema completo do formulário de cliente
export const customerFormSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(200, "Nome muito longo"),
  email: emailSchema,
  phone: phoneSchema,
  company: z.string().max(200, "Nome da empresa muito longo").optional().or(z.literal("")),
  address: z.string().max(500, "Endereço muito longo").optional().or(z.literal("")),
  city: z.string().max(100, "Cidade muito longa").optional().or(z.literal("")),
  state: z.string().max(2, "Use a sigla do estado (ex: SP)").optional().or(z.literal("")),
  cep: cepSchema,
  cpf_cnpj: cpfCnpjSchema,
  client_type: z.enum(["individual", "company"]),
  notes: z.string().max(2000, "Observações muito longas").optional().or(z.literal("")),
}).refine(
  (data) => data.phone?.trim() || data.email?.trim(),
  { message: "Informe pelo menos um contato (telefone ou email)", path: ["phone"] }
);

export type CustomerFormData = z.infer<typeof customerFormSchema>;

// Schema para validação da resposta da Brasil API
export const cnpjApiResponseSchema = z.object({
  razao_social: z.string().max(300).optional().nullable(),
  nome_fantasia: z.string().max(300).optional().nullable(),
  logradouro: z.string().max(300).optional().nullable(),
  numero: z.string().max(20).optional().nullable(),
  bairro: z.string().max(100).optional().nullable(),
  municipio: z.string().max(100).optional().nullable(),
  uf: z.string().max(2).optional().nullable(),
  cep: z.string().max(10).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  ddd_telefone_1: z.string().max(20).optional().nullable(),
}).passthrough(); // Permite campos extras da API

export function validateCnpjResponse(data: unknown) {
  try {
    return cnpjApiResponseSchema.parse(data);
  } catch {
    return null;
  }
}

// Sanitização de strings para evitar XSS
export function sanitizeString(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .trim()
    .slice(0, 500) // Limita tamanho
    .replace(/[<>]/g, ""); // Remove caracteres potencialmente perigosos
}
