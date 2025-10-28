export default function LoginPage() {
  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Iniciar sesión</h1>
      <form action="/auth/login" method="post" className="space-y-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm opacity-80">Email, Nombre o Discord ID</span>
          <input
            name="identifier"
            placeholder="usuario@correo.com · mi-nombre · 1234567890"
            className="bg-transparent border border-slate-700 rounded px-2 py-1"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm opacity-80">Contraseña</span>
          <input
            name="password"
            type="password"
            className="bg-transparent border border-slate-700 rounded px-2 py-1"
            required
          />
        </label>
        <button className="border border-slate-700 rounded px-3 py-1">
          Ingresar
        </button>
      </form>
      <p className="text-xs mt-4 opacity-70">
        El registro y asignación de contraseñas se realiza exclusivamente desde el panel de administración.
      </p>
    </div>
  )
}
