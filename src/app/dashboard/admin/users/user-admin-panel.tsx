"use client";

import { useActionState } from "react";
import { addUser, removeUser } from "./actions";

type AllowedUser = { email: string; is_admin: boolean; added_at: string };

export function UserAdminPanel({ users, currentEmail }: { users: AllowedUser[]; currentEmail: string }) {
  return (
    <div className="max-w-[640px] mx-auto flex flex-col gap-5">
      <AddUserForm />
      <UserList users={users} currentEmail={currentEmail} />
    </div>
  );
}

function AddUserForm() {
  const [state, formAction, pending] = useActionState(addUser, undefined);

  return (
    <div className="bg-surface border border-border rounded-2xl p-6">
      <div className="text-sm font-bold text-text mb-4">Tambah User</div>
      {/* key resets the uncontrolled form (clears the email input) after a successful submit */}
      <form action={formAction} key={state?.success ? "submitted" : "idle"} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label htmlFor="email" className="block text-[13px] font-semibold text-text-label mb-1.5">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="nama@esb.co.id"
            className="w-full box-border px-3.5 py-2.5 rounded-[10px] border border-border-form text-sm outline-none focus:border-accent"
          />
        </div>

        <label className="flex items-center gap-2 text-[13px] text-text-secondary mb-2.5 cursor-pointer select-none">
          <input type="checkbox" name="isAdmin" className="w-[15px] h-[15px] accent-accent cursor-pointer" />
          Jadikan admin
        </label>

        <button
          type="submit"
          disabled={pending}
          className="py-2.5 px-4 rounded-[10px] border-none bg-accent text-white text-sm font-semibold cursor-pointer disabled:opacity-60"
        >
          {pending ? "Menambahkan..." : "Tambah"}
        </button>
      </form>

      {state?.error && (
        <div className="text-[13px] text-negative mt-3" role="alert">
          {state.error}
        </div>
      )}
      {state?.success && <div className="text-[13px] text-positive mt-3">User berhasil ditambahkan.</div>}
    </div>
  );
}

function UserList({ users, currentEmail }: { users: AllowedUser[]; currentEmail: string }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6">
      <div className="text-sm font-bold text-text mb-4">User Terdaftar ({users.length})</div>
      <div className="flex flex-col">
        {users.map((u) => (
          <UserRow key={u.email} user={u} isSelf={u.email === currentEmail.toLowerCase()} />
        ))}
      </div>
    </div>
  );
}

function UserRow({ user, isSelf }: { user: AllowedUser; isSelf: boolean }) {
  const [state, formAction, pending] = useActionState(removeUser, undefined);

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-border-hairline last:border-b-0">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-text truncate">{user.email}</div>
        <div className="text-xs text-text-tertiary">
          {user.is_admin && <span className="text-accent font-semibold">Admin</span>}
          {user.is_admin && " · "}
          Ditambahkan {new Date(user.added_at).toLocaleDateString("id-ID")}
        </div>
      </div>

      {isSelf ? (
        <span className="text-xs text-text-tertiary shrink-0">Kamu</span>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="email" value={user.email} />
          <button
            type="submit"
            disabled={pending}
            className="text-xs text-negative font-semibold cursor-pointer bg-transparent border-none shrink-0 disabled:opacity-60"
          >
            {pending ? "Menghapus..." : "Hapus"}
          </button>
        </form>
      )}
      {state?.error && <div className="text-xs text-negative">{state.error}</div>}
    </div>
  );
}
