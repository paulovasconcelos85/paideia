import type { EtapaPlano, ItemPlano, Moeda } from './financas'

export interface ModeloPlano {
  id: string
  titulo: string
  descricao: string
  moeda: Moeda
  itens: ItemPlano[]
  etapas: EtapaPlano[]
}

const itens = (...nomes: string[]): ItemPlano[] => nomes.map(descricao => ({ descricao, valor: 0 }))
const etapas = (...textos: string[]): EtapaPlano[] => textos.map(texto => ({ texto, feito: false }))

// Os valores começam zerados: cada família pesquisa e preenche os próprios custos
export const MODELOS_PLANO: ModeloPlano[] = [
  {
    id: 'em-branco',
    titulo: 'Plano em branco',
    descricao: '',
    moeda: 'BRL',
    itens: [],
    etapas: [],
  },
  {
    id: 'reserva',
    titulo: 'Reserva de emergência',
    descricao: 'Seis meses de gastos essenciais em aplicação segura com liquidez diária.',
    moeda: 'BRL',
    itens: itens('Reserva de 6 meses de gastos essenciais'),
    etapas: etapas(
      'Abrir conta separada só para a reserva (Tesouro Selic ou CDB de liquidez diária)',
      'Programar transferência automática no dia do pagamento',
      'Atingir 1 mês de gastos (mini reserva)',
      'Atingir 3 meses',
      'Atingir 6 meses',
    ),
  },
  {
    id: 'dividas',
    titulo: 'Quitar dívidas',
    descricao: 'Sair do vermelho começando pelos juros mais altos.',
    moeda: 'BRL',
    itens: itens('Cartão de crédito', 'Cheque especial', 'Empréstimos'),
    etapas: etapas(
      'Listar todas as dívidas com saldo, juros e parcela',
      'Parar de usar cartão rotativo e cheque especial',
      'Renegociar as de juros mais altos (Serasa Limpa Nome, banco, portabilidade de consignado)',
      'Destinar 13º e férias para quitação',
      'Quitar a última dívida',
    ),
  },
  {
    id: 'renda-extra',
    titulo: 'Renda extra para o sonho',
    descricao: 'Uma segunda fonte de renda, com 100% do valor indo para o plano principal.',
    moeda: 'BRL',
    itens: itens('Meta de renda extra em 12 meses'),
    etapas: etapas(
      'Se for servidor público, conferir as vedações do cargo (servidores do Judiciário não podem advogar: Estatuto da OAB, art. 28)',
      'Listar o que sei fazer bem: Direito, Economia, ADS (programação, dados, automação)',
      'Escolher UMA oferta: automação de documentos para escritórios, planilhas e análise de dados para pequenos negócios, aulas ou mentorias',
      'Definir preço e um pacote simples',
      'Conseguir o primeiro cliente (rede de contatos, igreja, LinkedIn)',
      'Formalizar: servidor público em geral não pode ser MEI; como autônomo, recolher pelo carnê-leão e separar o imposto',
      'Programar a transferência de 100% da renda extra para o plano principal',
    ),
  },
  {
    id: 'pos-eua',
    titulo: 'Pós-graduação nos EUA',
    descricao: 'Mestrado ou LL.M. com a família, visto de estudante F-1.',
    moeda: 'USD',
    itens: itens(
      'Testes (TOEFL/IELTS, GRE/GMAT se exigido)',
      'Taxas de aplicação nas universidades',
      'Visto F-1 e taxa SEVIS (titular e dependentes F-2)',
      'Mensalidade (tuition) do programa',
      'Custo de vida de 1 ano (moradia, alimentação, transporte)',
      'Seguro saúde da família',
      'Passagens e mudança',
      'Reserva de chegada (depósitos, carro, móveis)',
    ),
    etapas: etapas(
      'Definir área: LL.M. (aproveita o Direito), economia ou tecnologia',
      'Listar 5 a 10 programas e seus custos totais (verificar a "proof of funds" exigida no I-20)',
      'Pesquisar bolsas: Fulbright, CAPES, bolsas da própria universidade, assistantships',
      'Fazer o TOEFL ou IELTS',
      'Verificar se o programa permite OPT (trabalho após o curso) e se é STEM (extensão de OPT)',
      'Aplicar aos programas',
      'Visto F-1 e F-2 da família',
    ),
  },
  {
    id: 'paralegal-eua',
    titulo: 'Trabalhar como paralegal nos EUA',
    descricao: 'Atuar na área jurídica nos EUA. O ponto crítico é a autorização de trabalho (visto).',
    moeda: 'USD',
    itens: itens(
      'Certificado de paralegal (programa aprovado pela ABA ou equivalente)',
      'Certificação profissional (ex.: NALA CP, NFPA)',
      'Validação de diplomas (credential evaluation)',
      'Teste de inglês',
      'Custos de visto e advogado de imigração',
      'Passagens e mudança',
      'Custo de vida até o primeiro salário (6 meses)',
      'Seguro saúde da família',
    ),
    etapas: etapas(
      'Consultar advogado de imigração: qual visto me permitiria trabalhar como paralegal?',
      'Pesquisar se paralegal se qualifica como "specialty occupation" para H-1B (em geral é difícil)',
      'Avaliar caminho via estudo: certificado ou LL.M. com F-1 e depois OPT',
      'Avaliar se Direito + Economia + ADS abre vagas mais favoráveis a visto (compliance, legal tech, análise de dados)',
      'Fazer validação dos diplomas',
      'Montar currículo no padrão americano e LinkedIn em inglês',
      'Aplicar a vagas ou programas',
    ),
  },
]
