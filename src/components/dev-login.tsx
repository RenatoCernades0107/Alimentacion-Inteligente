"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

/**
 * Solo en desarrollo: entrar con un usuario de prueba (email + contraseña) sin configurar Google.
 * Si el usuario no existe, se crea.
 */
export function DevLogin({ next }: { next: string }) {
  const [email, setEmail] = useState("padre@test.dev");
  const [error, setError] = useState("");

  async function signIn() {
    setError("");
    const supabase = createClient();
    const password = "dev-password-123";
    let { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const name = email.split("@")[0];
      ({ error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } }));
    }
    if (error) return setError(error.message);
    location.href = next;
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-2 rounded-xl border border-dashed p-3 text-left">
      <p className="text-xs font-medium text-muted-foreground">Dev login (solo desarrollo)</p>
      <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
      <Button variant="secondary" onClick={signIn}>Entrar como {email.split("@")[0]}</Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
