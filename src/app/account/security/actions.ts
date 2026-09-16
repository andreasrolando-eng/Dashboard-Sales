"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type EnrollResult = { error: string } | { factorId: string; qrCode: string; secret: string };

export async function enrollTotp(): Promise<EnrollResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });

  if (error || !data) {
    return { error: error?.message ?? "Gagal memulai pendaftaran MFA." };
  }

  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export async function confirmTotpEnrollment(_prevState: unknown, formData: FormData) {
  const factorId = String(formData.get("factorId") ?? "");
  const code = String(formData.get("code") ?? "").trim();

  if (!factorId || !code) {
    return { error: "Kode wajib diisi." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });

  if (error) {
    // Enrollment sits unverified in Supabase until confirmed -- clean it up
    // so a wrong code doesn't leave an orphaned factor blocking re-enroll.
    await supabase.auth.mfa.unenroll({ factorId });
    return { error: "Kode salah. Scan ulang QR code lalu masukkan kode terbaru." };
  }

  revalidatePath("/account/security");
  return { success: true };
}

export async function unenrollTotp(_prevState: unknown, formData: FormData) {
  const factorId = String(formData.get("factorId") ?? "");
  if (!factorId) {
    return { error: "Factor tidak ditemukan." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });

  if (error) {
    return { error: "Gagal menonaktifkan MFA." };
  }

  revalidatePath("/account/security");
  return { success: true };
}
