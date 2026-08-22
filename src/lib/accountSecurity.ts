import { supabase } from './supabase'
export async function setAccountPassword(password:string){if(password.length<8)throw new Error('رمز ورود باید حداقل ۸ کاراکتر باشد');const {error}=await supabase.auth.updateUser({password});if(error)throw error}
export async function enableTwoFactor(){const {data,error}=await supabase.auth.mfa.enroll({factorType:'totp',friendlyName:'SiraChat Authenticator'});if(error)throw error;return data}
export async function verifyTwoFactor(factorId:string,code:string){const {data:c,error:e}=await supabase.auth.mfa.challenge({factorId});if(e)throw e;const {data,error}=await supabase.auth.mfa.verify({factorId,challengeId:c.id,code});if(error)throw error;return data}
