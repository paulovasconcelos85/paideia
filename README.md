# Paideia Ekos

Biblioteca de formação intelectual cristã, reformada e conservadora.

## Stack

- **Next.js 15** (App Router)
- **Supabase** (Postgres + Auth)
- **Tailwind CSS** + **shadcn/ui**
- **TypeScript**
- **Vercel** (deploy)

---

## Setup local

### 1. Clonar e instalar

```bash
git clone https://github.com/SEU_USER/paideia-reformada
cd paideia-reformada
npm install
```

### 2. Variáveis de ambiente

Copie o arquivo de exemplo:

```bash
cp .env.local.example .env.local
```

Preencha com os valores do seu projeto Supabase:
- Acesse: https://supabase.com/dashboard → seu projeto → Settings → API
- Copie `Project URL` e `anon public key`

```env
NEXT_PUBLIC_SUPABASE_URL=https://XXXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...
```

### 3. Banco de dados

No Supabase Dashboard → SQL Editor, execute o arquivo:

```
supabase/schema.sql
```

Isso cria todas as tabelas, RLS, triggers e faz o seed dos eixos temáticos.

### 4. Google OAuth no Supabase

1. Acesse: Supabase → Authentication → Providers → Google
2. Ative o Google Provider
3. No [Google Cloud Console](https://console.cloud.google.com):
   - Crie um projeto (ou use existente)
   - Habilite "Google+ API" ou "Google Identity"
   - Crie credenciais OAuth 2.0 (Web application)
   - Authorized redirect URI: `https://SEU_PROJECT_ID.supabase.co/auth/v1/callback`
4. Cole o Client ID e Client Secret no Supabase

### 5. Rodar local

```bash
npm run dev
```

Acesse: http://localhost:3000

---

## Deploy no Vercel

### 1. Push para GitHub

```bash
git init
git add .
git commit -m "feat: MVP Paideia Ekos"
git remote add origin https://github.com/SEU_USER/paideia-reformada.git
git push -u origin main
```

**Importante:** use `vasconcelospaulorp@gmail.com` para os commits (não o email do TJAM).

### 2. Importar no Vercel

1. Acesse https://vercel.com/new
2. Importe o repositório
3. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

### 3. Atualizar redirect URI do Google

Após o deploy, adicione a URL do Vercel nas Authorized redirect URIs do Google Cloud:
```
https://SEU_PROJECT_ID.supabase.co/auth/v1/callback
```
(já deve estar — não precisa mudar, pois o redirect vai sempre pelo Supabase)

---

## Estrutura de arquivos

```
paideia-reformada/
├── app/
│   ├── (app)/                    # Rotas protegidas
│   │   ├── layout.tsx            # Layout com sidebar
│   │   ├── dashboard/page.tsx    # Dashboard com métricas
│   │   ├── biblioteca/           # CRUD de livros
│   │   ├── plano/page.tsx        # Plano mensal
│   │   └── citacoes/             # Registro de citações
│   ├── auth/callback/route.ts    # Callback OAuth
│   ├── login/page.tsx            # Tela de login
│   ├── layout.tsx
│   ├── globals.css
│   └── page.tsx                  # Redirect → /dashboard
├── components/
│   ├── sidebar.tsx
│   ├── eixo-progress-card.tsx
│   └── ui/toaster.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser client
│   │   └── server.ts             # Server client
│   ├── types.ts                  # Tipos TypeScript
│   └── utils.ts                  # Helpers
├── middleware.ts                  # Proteção de rotas
├── supabase/
│   └── schema.sql                # Schema + seed
└── .env.local.example
```

---

## Próximas features (pós-MVP)

- [ ] Fichamento por livro (texto longo, markdown)
- [ ] Página de detalhe do livro
- [ ] Editar/deletar livro
- [ ] Exportar biblioteca em PDF
- [ ] Dashboard com Chart.js (lidos por eixo)
- [ ] Plano mensal editável no banco
- [ ] App iOS (SwiftUI + mesma API Supabase)
- [ ] Tags nas citações com filtro
