/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from '@google/genai';

interface Favorite {
  term: string;
  lyrics: string;
}

const App: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [initialState, setInitialState] = useState(true);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [view, setView] = useState<'search' | 'favorites'>('search');
  const [sources, setSources] = useState<any[]>([]);
  
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const [isConfigError, setIsConfigError] = useState(false);


  useEffect(() => {
    // Check for API key on initial load.
    if (!process.env.API_KEY) {
      setIsConfigError(true);
    }

    try {
      const savedFavorites = localStorage.getItem('lyrics-favorites');
      if (savedFavorites) {
        setFavorites(JSON.parse(savedFavorites));
      }
    } 
    // FIX: Corrected invalid arrow function syntax in catch block.
    catch (e) {
      console.error('Falha ao carregar favoritos do localStorage', e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('lyrics-favorites', JSON.stringify(favorites));
    } catch (e) {
      console.error('Falha ao salvar favoritos no localStorage', e);
    }
  }, [favorites]);

  useEffect(() => {
    // This effect handles clearing the results when the search bar is emptied manually.
    if (!searchTerm.trim()) {
      setLyrics('');
      setError('');
      setSources([]);
      setInitialState(true);
      setIsLoading(false); // Make sure loading is also cancelled.
    }
  }, [searchTerm]);

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Prevent page reload
    if (!searchTerm.trim()) {
      return; // Do not search if the input is empty
    }

    if(lyricsContainerRef.current) {
        lyricsContainerRef.current.scrollTop = 0;
    }
    
    setIsLoading(true);
    setError('');
    setLyrics('');
    setSources([]);
    setInitialState(false);

    try {
      if (!process.env.API_KEY) {
        setIsConfigError(true);
        setIsLoading(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Sua tarefa é encontrar a letra OFICIAL e EXATA para a música "${searchTerm}". Use a busca do Google para encontrar a letra em fontes confiáveis como sites de letras de música conhecidos (ex: Letras.mus.br, Genius, Vagalume) ou sites oficiais de artistas. NÃO invente, resuma ou modifique a letra. A letra deve ser completa e formatada corretamente com quebras de linha. Retorne a resposta ESTRITAMENTE como um objeto JSON com a chave "lyrics" contendo a letra completa. Se não tiver certeza ou não conseguir encontrar a letra exata, retorne: {"error": "Não foi possível encontrar a letra exata para esta música. Verifique o nome e tente novamente."}`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{googleSearch: {}}],
        },
      });
      
      const groundingSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingSources) {
        setSources(groundingSources);
      }
      
      let resultText = response.text.trim();
      
      if (resultText.startsWith('```json')) {
        resultText = resultText.substring(7, resultText.length - 3).trim();
      }
      
      const result = JSON.parse(resultText);

      if (result.error || !result.lyrics) {
        setError(result.error || `Não foi possível encontrar a letra para "${searchTerm}". Por favor, verifique o nome e tente novamente.`);
      } else {
        setLyrics(result.lyrics);
      }
    } catch (err) {
      console.error("Erro na busca da letra:", err);
      let detailedError = 'Ocorreu um erro ao buscar a letra. Por favor, tente novamente mais tarde.';
      if (err instanceof Error) {
        // Check for specific, more helpful error messages
        if (err.message.includes('API key not valid')) {
            detailedError = 'Erro: A chave de API fornecida não é válida. Por favor, verifique se a copiou corretamente.';
        } else if (err.message.includes('API has not been used') || err.message.includes('enable the API')) {
            detailedError = 'Erro: A "Generative Language API" pode não estar ativada para este projeto. Por favor, ative-a no seu Google Cloud Console e tente novamente.';
        } else {
            detailedError = `${detailedError} (Detalhes: ${err.message})`;
        }
      }
      setError(detailedError);
    } finally {
      setIsLoading(false);
    }
  };

  const isFavorite = (term: string) => favorites.some((fav) => fav.term === term);

  const toggleFavorite = () => {
    if (!searchTerm || !lyrics) return;
    if (isFavorite(searchTerm)) {
      setFavorites(favorites.filter((fav) => fav.term !== searchTerm));
    } else {
      setFavorites([...favorites, { term: searchTerm, lyrics }]);
    }
  };
  
  const removeFavorite = (termToRemove: string) => {
    setFavorites(favorites.filter((fav) => fav.term !== termToRemove));
  };
  
  const viewFavorite = (favorite: Favorite) => {
    setSearchTerm(favorite.term);
    setLyrics(favorite.lyrics);
    setError('');
    setSources([]);
    setInitialState(false);
    if(lyricsContainerRef.current) {
        lyricsContainerRef.current.scrollTop = 0;
    }
    setView('search');
  };

  return (
    <div className="app-container">
      <header>
        <h1>LETRADOR ✨</h1>
        <nav className="navigation">
          <button onClick={() => setView('search')} disabled={view === 'search' || isConfigError}>
            Pesquisar
          </button>
          <button onClick={() => setView('favorites')} disabled={view === 'favorites' || isConfigError}>
            Favoritos ({favorites.length})
          </button>
        </nav>
      </header>
      <main>
        {isConfigError ? (
          <div className="config-error-container results-container">
            <h2>⚠️ Erro de Configuração</h2>
            <p>A chave de API (API Key) do Google AI não foi encontrada neste ambiente.</p>
            <p>
              <strong>Nesta plataforma, a chave de API é gerenciada e injetada automaticamente.</strong> Você não precisa configurá-la manualmente no código.
            </p>
            <p>
              Se este erro persistir, pode ser um problema temporário na plataforma. Tente recarregar a página ou verifique a configuração de API Key no seu projeto do Google AI Studio.
            </p>
            
            <div className="diagnostic-info">
              <h4>Informação de Diagnóstico</h4>
              <p>Status da variável que o aplicativo está procurando:</p>
              <ul>
                <li>Status de <code>API_KEY</code>: <strong>{process.env.API_KEY ? '✅ Encontrada' : '❌ Não encontrada'}</strong></li>
              </ul>
            </div>
          </div>
        ) : view === 'search' ? (
          <>
            <form className="search-form" onSubmit={handleSearch}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Digite o nome da música e artista..."
                className="search-input"
                aria-label="Nome da música e artista"
              />
              <button 
                type="submit" 
                className="search-button" 
                disabled={isLoading || !searchTerm.trim()}
              >
                {isLoading ? 'Buscando...' : 'Buscar'}
              </button>
            </form>
            <div className="results-container">
              {isLoading && (
                <div className="spinner-container" aria-label="Carregando">
                  <div className="spinner"></div>
                </div>
              )}
              {error && <p className="error-message">{error}</p>}
              {lyrics && (
                <div className="lyrics-display">
                  <div className="lyrics-header">
                     <h2>{searchTerm}</h2>
                     <div className="controls-wrapper">
                        <button onClick={toggleFavorite} className={`favorite-button ${isFavorite(searchTerm) ? 'favorited' : ''}`} aria-label="Adicionar aos favoritos" disabled={!lyrics}>
                           {isFavorite(searchTerm) ? '★ Favorito' : '☆ Adicionar aos Favoritos'}
                        </button>
                     </div>
                  </div>
                  <div className="lyrics-text-container" ref={lyricsContainerRef}>
                    {lyrics.split('\n').map((line, index) => (
                      <p
                        key={index}
                        className="lyrics-line"
                      >
                        {line || '\u00A0'}
                      </p>
                    ))}
                  </div>
                  {sources && sources.length > 0 && (
                    <div className="sources-container">
                      <h4>Fontes</h4>
                      <ul>
                        {sources.filter(s => s.web?.uri).map((source, index) => (
                          <li key={index}>
                            <a href={source.web.uri} target="_blank" rel="noopener noreferrer">
                              {source.web.title || source.web.uri}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {initialState && !isLoading && !error && !lyrics && (
                <p className="placeholder-text">A letra da música aparecerá aqui.</p>
              )}
            </div>
          </>
        ) : (
          <div className="favorites-container results-container">
            <h2>Músicas Favoritas</h2>
            {favorites.length > 0 ? (
              <ul className="favorites-list">
                {favorites.map((fav) => (
                  <li key={fav.term} className="favorite-item">
                    <span onClick={() => viewFavorite(fav)} className="favorite-term" role="button" tabIndex={0}>
                      {fav.term}
                    </span>
                    <button onClick={() => removeFavorite(fav.term)} className="remove-favorite-button">
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="placeholder-text">Você ainda não salvou nenhuma música.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);