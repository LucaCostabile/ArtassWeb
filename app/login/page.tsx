import Title from '@/components/Title'

export default function LoginPage() {
  return (
    <div className="max-w-md mx-auto">
      <div className="mb-4">
        <Title>Iniciar sesión</Title>
      </div>
      <form action="/auth/login" method="post" className="space-y-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm opacity-80">Email, Nombre o Discord ID</span>
          <input
            name="identifier"
            placeholder="usuario@correo.com · mi-nombre · 1234567890"
            className="bg-transparent border border-stone-700 rounded px-2 py-1"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm opacity-80">Contraseña</span>
          <input
            name="password"
            type="password"
            className="bg-transparent border border-stone-700 rounded px-2 py-1"
            required
          />
        </label>
        <button className="border border-stone-700 rounded px-3 py-1">
          Ingresar
        </button>
      </form>
      <p className="text-xs mt-4 opacity-70">
        El registro y asignación de contraseñas se realiza exclusivamente desde el panel de administración.
      </p>
    </div>
  )
}
