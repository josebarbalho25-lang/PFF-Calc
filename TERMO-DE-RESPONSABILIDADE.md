# Termo de responsabilidade e de uso

**PFF Calc — perfis de aço formados a frio, ABNT NBR 14762:2010**

Ao instalar, abrir ou usar este programa, você declara que leu e aceita este termo.

## 1. Software experimental

Este é um **software experimental, de apoio à verificação** de barras de perfis de aço
formados a frio aos estados-limites últimos da ABNT NBR 14762:2010. Ele é uma ferramenta
de auxílio ao cálculo e **não substitui o projeto estrutural nem o julgamento de um
engenheiro habilitado**.

## 2. Responsabilidade final do engenheiro responsável

**A responsabilidade final por qualquer verificação, dimensionamento, memória de cálculo
ou projeto feito com o auxílio deste programa é exclusivamente do engenheiro responsável**,
legalmente habilitado, que o utiliza e assina o trabalho. Cabe a ele:

- conferir todos os dados de entrada — perfil, aço, esforços solicitantes de cálculo,
  comprimentos de flambagem, fator Cb e, no Anexo F, as condições declaradas;
- conferir os resultados e a memória de cálculo contra a norma vigente;
- verificar tudo o que este programa não verifica (item 4).

## 3. Sem garantia

O programa é fornecido **no estado em que se encontra**, gratuitamente, **sem garantia de
qualquer natureza**, expressa ou implícita — inclusive de exatidão dos resultados,
ausência de erros ou adequação a um fim específico. O autor não responde por danos de
qualquer espécie, diretos ou indiretos, decorrentes do uso ou da impossibilidade de uso do
programa ou de seus resultados.

## 4. O que o programa NÃO verifica

- As ligações (seção 10 da norma), incluindo a própria solda dos dois Ue da barra composta.
- As forças concentradas na alma (Anexo D).
- Os furos na seção.
- O aumento da resistência ao escoamento pelo trabalho a frio.
- A viga mista (Anexo G) e a cantoneira fletida nos eixos principais de inércia.
- Estados-limites de serviço (flechas, vibração).
- A análise estrutural e a estabilidade global: os esforços de entrada devem vir de uma
  análise adequada, com os efeitos de segunda ordem e as imperfeições quando aplicáveis.
- Situação de incêndio e fadiga.

## 5. Hipóteses adotadas

- Os esforços de entrada são os solicitantes de cálculo, já majorados.
- Os comprimentos de flambagem e o fator Cb são informados pelo usuário. Comprimento zero
  significa barra travada continuamente naquela direção.
- No Anexo F, as condições que dependem da obra são declaradas pelo usuário; o programa
  confere as demais e, se alguma falhar, verifica pelo item 9.8.2.

## 6. Normas e dados

- A norma ABNT NBR 14762:2010 **não acompanha este programa** e deve ser consultada na sua
  edição oficial. O programa apenas cita os itens e as expressões da norma.
- As dimensões dos perfis do catálogo seguem a ABNT NBR 6355. Confira com o catálogo
  vigente do seu fornecedor.

## 7. Direitos e citação

O programa é de **José Barbalho** e é distribuído sob a licença MIT (arquivo `LICENSE`):
pode ser usado, copiado, modificado e redistribuído gratuitamente, **desde que o nome do
autor seja citado** — a nota de autoria e a licença devem acompanhar qualquer cópia ou
trabalho derivado do código.
