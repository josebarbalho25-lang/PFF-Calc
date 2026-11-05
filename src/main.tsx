import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './estilo/tokens.css';
import './estilo/base.css';
import './estilo/componentes.css';
import './estilo/calculadora.css';
import { App } from './App';
import { ContencaoDaRaiz } from './ui/ContencaoDaRaiz';
import { aplicarTemaGuardado } from './ui/tema';

aplicarTemaGuardado();

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <ContencaoDaRaiz>
      <App />
    </ContencaoDaRaiz>
  </StrictMode>,
);
