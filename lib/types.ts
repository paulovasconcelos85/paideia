export type Status = 'quero' | 'comprar' | 'lendo' | 'lido' | 'reler' | 'abandonado'

export interface Eixo {
  id: number
  nome: string
  icon: string
  cor: string
  total_planejado: number
}

export interface Livro {
  id: string
  user_id: string
  titulo: string
  autor: string | null
  eixo_id: number | null
  status: Status
  nota: number | null
  data_inicio: string | null
  data_conclusao: string | null
  paginas: number | null
  fichamento: string | null
  observacoes: string | null
  prioridade: number
  created_at: string
  updated_at: string
  eixos?: Eixo
}

export interface Citacao {
  id: string
  user_id: string
  livro_id: string | null
  texto: string
  pagina: number | null
  tags: string[] | null
  created_at: string
  livros?: Pick<Livro, 'id' | 'titulo' | 'autor'>
}

export interface Profile {
  id: string
  email: string | null
  name: string | null
  avatar_url: string | null
  anthropic_api_key: string | null
  ai_perfil: string | null
  ai_instrucoes: string | null
}

export interface DashboardStats {
  total: number
  lidos: number
  lendo: number
  aComprar: number
  mediaNotas: number | null
  porEixo: { eixo: Eixo; lidos: number }[]
}
