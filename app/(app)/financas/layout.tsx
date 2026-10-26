import FinancasTabs from './financas-tabs'

export default function FinancasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Finanças da família</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mordomia do que Deus confiou: saber o que entra, o que sai e quanto sobra para o futuro
        </p>
      </div>
      <FinancasTabs />
      {children}
    </div>
  )
}
