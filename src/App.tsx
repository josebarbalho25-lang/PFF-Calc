// ═══════════════════════════════════════════════════════════════════════════
//  App.tsx — a calculadora: entradas à esquerda, seção e aproveitamento à
//  direita, as janelas do (?) por cima
// ---------------------------------------------------------------------------
//  A geometria e as propriedades saem na hora (milissegundo). As faixas
//  finitas levam perto de um segundo e rodam num trabalhador em segundo
//  plano (`ui/usarCriticos.ts`); o quadro de aproveitamento espera por elas
//  (fica esmaecido) e se refaz sozinho quando chegam. Esforço e comprimento
//  não mexem nas faixas — a curva é da seção — então trocar um esforço
//  refaz só a conta da norma, na hora.
//
//  A janela 3D carrega só quando abre: o three.js é metade do peso do
//  programa, e quem só confere perfil não precisa dele.
// ═══════════════════════════════════════════════════════════════════════════

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { EntradaInvalida, verificar } from './motor/norma';
import { superficieDeInteracao } from './motor/norma/interacao';
import { GeometriaInvalida, montarSecao } from './motor/secao/familias';
import { propriedades } from './motor/secao/propriedades';
import { designacao } from './relatorio/designacao';
import { exportarPdf, imprimirNoServidor } from './relatorio/exportarPdf';
import { MemoriaCalculo } from './relatorio/MemoriaCalculo';
import { nomeDoPdf, paginaDaMemoria } from './relatorio/paginaDaMemoria';
import { num } from './relatorio/formatos';
import { Contencao } from './ui/Contencao';
import { EditorDoDesenho } from './ui/desenho/EditorDoDesenho';
import { guardarEntrada, guardarIdentificacao, janelaDoEndereco, lerEntrada, lerIdentificacao, type EstadoDaEntrada, type Identificacao } from './ui/guardarEntrada';
import { PainelEsforcos } from './ui/PainelEsforcos';
import { usarBarraDaJanela } from './ui/barraDaJanela';
import { PainelPerfil } from './ui/PainelPerfil';
import { PainelResultados } from './ui/PainelResultados';
import { PainelConfiguracao } from './ui/PainelConfiguracao';
import { guardarProjetista, lerProjetista, projetistaDoEndereco, type Projetista } from './ui/projetista';
import { usarCriticos } from './ui/usarCriticos';
import { desenhoDaSecao } from './visualizacao/geometriaDaSecao';
import type { ChaveDaAjuda } from './visualizacao/modais/JanelaDidatica';

/**
 * ⚠️ A JANELA 3D É CARREGADA DE NOVO A CADA FALHA (lição da 8800): o `lazy`
 * guarda a promessa do primeiro carregamento, e uma falha passageira travaria
 * todo (?) seguinte até recarregar a página.
 */
function carregarJanela() {
  return lazy(() => import('./visualizacao/modais/JanelaDidatica'));
}

// O 3D da interação também vem à parte: o three.js não pesa na abertura da tela.
const DiagramaInteracao3D = lazy(() => import('./visualizacao/DiagramaInteracao3D'));

const PALAVRA = { atende: 'Atende', avaliar: 'Avaliar', naoAtende: 'Não atende' } as const;

export function App() {
  const [entrada, setEntrada] = useState<EstadoDaEntrada>(lerEntrada);
  const [ajuda, setAjuda] = useState<ChaveDaAjuda | null>(() => {
    const j = janelaDoEndereco();
    return j && j !== 'memoria' && j !== 'configuracao' ? (j as ChaveDaAjuda) : null;
  });
  const [identificacao, setIdentificacao] = useState<Identificacao>(lerIdentificacao);
  const [projetista, setProjetista] = useState<Projetista>(() => projetistaDoEndereco() ?? lerProjetista());
  usarBarraDaJanela();
  useEffect(() => guardarProjetista(projetista), [projetista]);
  // A memória recebe o projetista da configuração: um lugar só para quem assina.
  const idDaMemoria = useMemo<Identificacao>(
    () => ({ ...identificacao, responsavel: projetista.nome, titulo: projetista.titulo, registro: projetista.crea }),
    [identificacao, projetista],
  );
  const [memoria, setMemoria] = useState(() => janelaDoEndereco() === 'memoria');
  const [exportando, setExportando] = useState(false);
  const [recado, setRecado] = useState<{ texto: string; erro: boolean } | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const JanelaDidatica = useMemo(carregarJanela, [tentativa]);
  useEffect(() => guardarEntrada(entrada), [entrada]);
  useEffect(() => guardarIdentificacao(identificacao), [identificacao]);

  const geo = useMemo(() => {
    try {
      const sec = montarSecao(entrada.perfil);
      const pr = propriedades(sec);
      return { sec, pr, desenho: desenhoDaSecao(sec, pr), erro: null };
    } catch (err) {
      if (err instanceof GeometriaInvalida) return { erro: err.message };
      throw err;
    }
  }, [entrada.perfil]);

  const criticos = usarCriticos(entrada.perfil);
  // Entrada que a norma recusa (fy zero, comprimento negativo) vira recado na
  // barra de estado; antes a exceção apagava a tela inteira, e a entrada
  // guardada repetia o branco a cada recarga (achado B2, 01/11/2026).
  const { resultado, erroDaNorma } = useMemo(() => {
    if (geo.erro !== null || criticos.estado !== 'pronto') return { resultado: null, erroDaNorma: null };
    try {
      return { resultado: verificar({ ...entrada, aco: entrada.aco, criticos: criticos.criticos, anexoF: entrada.anexoF.ligado ? entrada.anexoF : undefined }), erroDaNorma: null };
    } catch (err) {
      if (err instanceof EntradaInvalida) return { resultado: null, erroDaNorma: err.message };
      throw err;
    }
  }, [geo, criticos, entrada]);

  // A superfície do 9.9 com as resistências de cada sinal (seis rodadas do mesmo `verificar`).
  const superficie = useMemo(() => {
    if (!resultado || criticos.estado !== 'pronto') return null;
    try {
      return superficieDeInteracao({ ...entrada, criticos: criticos.criticos });
    } catch (err) {
      if (err instanceof EntradaInvalida) return null;
      throw err;
    }
  }, [resultado, criticos, entrada]);

  const nome = designacao(entrada.perfil);

  async function exportar() {
    if (!resultado) return;
    setExportando(true);
    setRecado(null);
    const html = paginaDaMemoria(resultado, idDaMemoria);
    const r = await exportarPdf(() => imprimirNoServidor(html), nomeDoPdf(resultado, idDaMemoria));
    setExportando(false);
    if (!r.ok) setRecado({ texto: r.erro, erro: true });
    else if (r.gravado) setRecado({ texto: 'PDF gravado', erro: false });
  }
  const pior = resultado?.lista.filter((vf) => !vf.naoVerificada).reduce((a, b) => (b.razao > a.razao || Number.isNaN(b.razao) ? b : a));

  return (
    <div className="app">
      <header className="topbar">
        {/* as marcas dele, só na tela (a memória sai limpa); sem o arquivo, somem */}
        {/* o glifo sem fundo: branco no Escuro, azul da marca no Claro e no Papel (o CSS mostra um) */}
        <img className="glifo-calculadora branco" src={`${import.meta.env.BASE_URL}glifo-calculadora-branco.png`} alt="" onError={(ev) => (ev.currentTarget.style.display = 'none')} />
        <img className="glifo-calculadora azul" src={`${import.meta.env.BASE_URL}glifo-calculadora-azul.png`} alt="" onError={(ev) => (ev.currentTarget.style.display = 'none')} />
        <span className="marca-app">NBR 14762 · PFF Calc</span>
        <div className="titulo">
          <h1>Calculadora de perfis formados a frio</h1>
          <span className="sub">
            {nome} · {entrada.aco.nome} · {entrada.metodo}
          </span>
        </div>
        <div className="direita">
          {resultado && (
            <>
              <span className={`pilula situacao-geral ${resultado.situacao}`}>{PALAVRA[resultado.situacao]}</span>
              <span className="razao-geral mono">{num(resultado.razaoMaxima, 3)}</span>
            </>
          )}
          {/* a engrenagem é o último item, na ponta direita, como na 8800 */}
          <PainelConfiguracao projetista={projetista} mudarProjetista={setProjetista} />
        </div>
      </header>

      <main className="colunas">
        <aside className="coluna-esquerda">
          <div className="painel-entradas">
            <PainelPerfil
              perfil={entrada.perfil}
              mudarPerfil={(perfil) => setEntrada((e) => ({ ...e, perfil }))}
              aco={entrada.aco}
              mudarAco={(aco) => setEntrada((e) => ({ ...e, aco }))}
            />
            <PainelEsforcos
              esforcos={entrada.esforcos}
              comprimentos={entrada.comprimentos}
              metodo={entrada.metodo}
              anexoF={entrada.anexoF}
              mudarAnexoF={(anexoF) => setEntrada((e) => ({ ...e, anexoF }))}
              mudarEsforcos={(esforcos) => setEntrada((e) => ({ ...e, esforcos }))}
              mudarComprimentos={(comprimentos) => setEntrada((e) => ({ ...e, comprimentos }))}
              mudarMetodo={(metodo) => setEntrada((e) => ({ ...e, metodo }))}
              abrirAjuda={setAjuda}
            />
          </div>
        </aside>
        <section className="coluna-direita">
          {/* A seção desenhada é a entrada: o editor fica em cima, de pé mesmo
              quando o desenho ainda não fecha (o erro vai para a barra dele). */}
          {entrada.perfil.familia === 'Desenho' && (
            <div className="caixa-do-desenho">
              <EditorDoDesenho
                desenho={entrada.perfil.desenho ?? { nos: [], trechos: [] }}
                t={entrada.perfil.t}
                ri={entrada.perfil.ri}
                mudar={(desenho) => setEntrada((e) => ({ ...e, perfil: { ...e.perfil, desenho } }))}
              />
            </div>
          )}
          {geo.erro === null ? (
            <PainelResultados
              resultado={resultado}
              sec={geo.sec}
              pr={geo.pr}
              desenho={geo.desenho}
              nome={nome}
              acoes={
                resultado && (
                  <>
                    <button type="button" className="btn-fantasma" onClick={() => setMemoria(true)}>
                      Memória de cálculo completa
                    </button>
                    <button type="button" className="btn-primario" onClick={exportar} disabled={exportando}>
                      {exportando ? 'Gerando PDF…' : 'Exportar relatório PDF'}
                    </button>
                    {recado && <span className={`recado${recado.erro ? ' erro' : ''}`}>{recado.texto}</span>}
                  </>
                )
              }
            />
          ) : (
            entrada.perfil.familia !== 'Desenho' && <div className="secao-erro">{geo.erro}</div>
          )}
          {superficie && (
            <fieldset className="cad-bloco bloco-interacao">
              <legend>Interação N–Mx–My · 9.9</legend>
              <Contencao aoFalhar={() => undefined}>
                <Suspense fallback={null}>
                  <DiagramaInteracao3D superficie={superficie} />
                </Suspense>
              </Contencao>
            </fieldset>
          )}
        </section>
      </main>

      <footer className="statusbar">
        <span className="campo-estado">ABNT NBR 14762:2010</span>
        <span className="campo-estado">
          <i>E</i> <span className="valor">20 000</span> kN/cm²
        </span>
        <span className="campo-estado">
          <i>G</i> <span className="valor">7 700</span> kN/cm²
        </span>
        {criticos.estado === 'calculando' && <span className="campo-estado">faixas finitas…</span>}
        {criticos.estado === 'erro' && <span className="campo-estado alarme">{criticos.erro}</span>}
        {geo.erro !== null && <span className="campo-estado alarme">{geo.erro}</span>}
        {erroDaNorma !== null && <span className="campo-estado alarme">{erroDaNorma}</span>}
        <div className="direita">
          {pior && (
            <span className={`campo-estado${pior.situacao === 'naoAtende' ? ' alarme' : ''}`}>
              {pior.titulo} <span className="valor">{num(pior.razao, 3)}</span>
              {pior.governa ? ` · ${pior.governa}` : ''}
            </span>
          )}
          {/* o logo dele dentro do próprio link do site, como na 8800: clicar nele abre o site */}
          <a className="campo-estado site" href="https://proestruturas3d.com.br" target="_blank" rel="noopener noreferrer">
            <img className="logo-autor" src={`${import.meta.env.BASE_URL}logo-autor.png`} alt="" onError={(ev) => (ev.currentTarget.style.display = 'none')} />
            proestruturas3d.com.br
          </a>
        </div>
      </footer>

      {memoria && resultado && (
        <Contencao aoFalhar={() => setMemoria(false)}>
          <MemoriaCalculo resultado={resultado} identificacao={idDaMemoria} mudarIdentificacao={(id) => setIdentificacao({ ...id, responsavel: '', registro: '', titulo: undefined })} fechar={() => setMemoria(false)} />
        </Contencao>
      )}
      {ajuda && resultado && criticos.estado === 'pronto' && (
        <Contencao
          aoFalhar={() => {
            setAjuda(null);
            setTentativa((t) => t + 1);
          }}
        >
          <Suspense fallback={null}>
            <JanelaDidatica
              chave={ajuda}
              trocar={setAjuda}
              fechar={() => setAjuda(null)}
              resultado={resultado}
              criticos={criticos.criticos}
              nome={nome}
              usarCb={(Cb) => setEntrada((e) => ({ ...e, comprimentos: { ...e.comprimentos, Cb } }))}
            />
          </Suspense>
        </Contencao>
      )}
    </div>
  );
}
