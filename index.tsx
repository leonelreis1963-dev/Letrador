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
  
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(3);
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(-1);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const [isConfigError, setIsConfigError] = useState(false);


  useEffect(() => {
    // Check for API key on initial load.
    const apiKey = process.env.VITE_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      setIsConfigError(true);
    }

    try {
      const savedFavorites = localStorage.getItem('lyrics-favorites');
      if (savedFavorites) {
        setFavorites(JSON.parse(savedFavorites));
      }
    } catch (e) {
      console.error('Falha ao carregar favoritos do localStorage', e);
    }
  }, []);

  // FIX: Corrected the malformed try-catch block.
  // The original code had a syntax error that prematurely closed the component's function scope,
  // causing all subsequent functions and hooks to be declared out of scope,
  // which resulted in numerous "Cannot find name" errors.
  useEffect(() => {
    try {
      localStorage.setItem('lyrics-favorites', JSON.stringify(favorites));
    } catch (e) {
      console.error('Falha ao salvar favoritos no localStorage', e);
    }
  }, [favorites]);

  useEffect(() => {
    let scrollInterval: number | undefined;

    if (isScrolling && lyricsContainerRef.current) {
      const el = lyricsContainerRef.current;
      scrollInterval = window.setInterval(() => {
        if (!lyricsContainerRef.current) return;

        // Stop scrolling at the end
        if (el.scrollTop >= el.scrollHeight - el.clientHeight) {
          setIsScrolling(false);
          setCurrentLineIndex(-1);
          return;
        }

        el.scrollTop += 1;

        // Highlight logic
        const activeZone = el.scrollTop + el.clientHeight / 4; // Highlight a bit higher up
        const lines = Array.from(el.children) as HTMLElement[];
        
        let newCurrentIndex = lines.findIndex(line => line.offsetTop + line.offsetHeight > activeZone);
        
        // If findIndex returns -1 towards the end, highlight the last line.
        if (newCurrentIndex === -1 && lines.length > 0) {
            newCurrentIndex = lines.length - 1;
        }

        setCurrentLineIndex(prevIndex => {
            if (newCurrentIndex !== -1 && newCurrentIndex !== prevIndex) {
                return newCurrentIndex;
            }
            return prevIndex;
        });

      }, 150 - scrollSpeed * 12);
    } else {
        // When not scrolling, no line should be active
        setCurrentLineIndex(-1);
    }

    return () => {
      if (scrollInterval) {
        clearInterval(scrollInterval);
      }
    };
  }, [isScrolling, scrollSpeed, lyrics]);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!searchTerm.trim()) {
      setError('Por favor, digite o nome da música e do artista.');
      return;
    }
    
    setIsScrolling(false);
    if(lyricsContainerRef.current) {
        lyricsContainerRef.current.scrollTop = 0;
    }
    
    setIsLoading(true);
    setError('');
    setLyrics('');
    setSources([]);
    setInitialState(false);
    setCurrentLineIndex(-1);

    try {
      // Vercel requires client-side env vars to be prefixed with VITE_
      // This will check for the Vercel key, and fall back to the AI Studio key.
      const apiKey = process.env.VITE_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        // This case is handled by the main config error screen, but as a fallback.
        setIsConfigError(true);
        setIsLoading(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Para a música "${searchTerm}", use a busca para encontrar a letra completa. Retorne a resposta ESTRITAMENTE como um objeto JSON com uma única chave: "lyrics". Exemplo de resposta: {"lyrics": "..."}. Se não encontrar, retorne: {"error": "Não foi possível encontrar la música."}`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{googleSearch: {}}],
        },
      });
      
      // FIX: Extract and display grounding sources, as required by guidelines.
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
        detailedError = `${detailedError} (Detalhes: ${err.message})`;
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
    setIsScrolling(false);
    setCurrentLineIndex(-1);
    if(lyricsContainerRef.current) {
        lyricsContainerRef.current.scrollTop = 0;
    }
    setView('search');
  };

  const toggleKaraoke = () => {
    if (!lyrics) return;
    setIsScrolling(!isScrolling);
  };

  return (
    <div className="app-container">
      <header>
        <h1>LETRADOR</h1>
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
            <p>A chave de API do Google AI não foi encontrada.</p>
            <p>Para que o aplicativo funcione na Vercel, você precisa configurar uma variável de ambiente:</p>
            <div className="code-block">
                <code>VITE_API_KEY</code>
            </div>
            <p>Por favor, adicione esta variável nas configurações do seu projeto na Vercel com a sua chave de API como valor.</p>
            <a 
                href="https://vercel.com/docs/projects/environment-variables" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="info-link"
            >
                Aprenda a adicionar variáveis de ambiente na Vercel
            </a>
          </div>
        ) : view === 'search' ? (
          <>
            <form onSubmit={handleSearch} className="search-form">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Digite o nome da música e artista..."
                className="search-input"
                aria-label="Nome da música e artista"
              />
              <button type="submit" className="search-button" disabled={isLoading}>
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
                        <div className="karaoke-controls">
                          <button onClick={toggleKaraoke} className="play-pause-button" aria-label={isScrolling ? "Pausar" : "Iniciar"} disabled={!lyrics}>
                            {isScrolling ? '⏸' : '▶'}
                          </button>
                          <label htmlFor="speed-slider">Velocidade</label>
                          <input
                            type="range"
                            id="speed-slider"
                            min="1"
                            max="10"
                            value={scrollSpeed}
                            onChange={(e) => setScrollSpeed(Number(e.target.value))}
                            aria-label="Ajustar velocidade da rolagem"
                          />
                        </div>
                        <button onClick={toggleFavorite} className={`favorite-button ${isFavorite(searchTerm) ? 'favorited' : ''}`} aria-label="Adicionar aos favoritos" disabled={!lyrics}>
                           {isFavorite(searchTerm) ? '★ Favorito' : '☆ Adicionar aos Favoritos'}
                        </button>
                     </div>
                  </div>
                  <div className="lyrics-text-container" ref={lyricsContainerRef}>
                    {lyrics.split('\n').map((line, index) => (
                      <p
                        key={index}
                        className={`lyrics-line ${index === currentLineIndex ? 'active' : ''}`}
                      >
                        {line || '\u00A0'}
                      </p>
                    ))}
                  </div>
                  {/* FIX: Display grounding sources */}
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