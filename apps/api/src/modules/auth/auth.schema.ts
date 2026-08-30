import { z } from 'zod';
import {
  RegisterInputSchema,
  LoginInputSchema,
  AuthResponseSchema,
  MerchantRoleEnum,
  type RegisterInput,
  type LoginInput,
  type AuthResponse,
  type AuthTokenPayload
} from '@agent-sauda/domain';

export {
  RegisterInputSchema,
  LoginInputSchema,
  AuthResponseSchema,
  MerchantRoleEnum,
  type RegisterInput,
  type LoginInput,
  type AuthResponse,
  type AuthTokenPayload
};

export const SwitchMerchantSchema = z.object({
  merchantId: z.string().uuid('Invalid merchant ID format')
});
export type SwitchMerchantInput = z.infer<typeof SwitchMerchantSchema>;
